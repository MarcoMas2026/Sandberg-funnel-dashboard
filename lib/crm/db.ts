import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { CRM_EVENT_TYPES } from "./events";

// Server-only client — SUPABASE_SERVICE_ROLE_KEY must never reach the browser
// bundle (same rule as lib/kv.ts, lib/social/db.ts, lib/history/db.ts). Reuses
// the same Supabase project as those, dedicated tables (see
// db/migrations/006_crm_lead_outcomes.sql).
let client: SupabaseClient | null | undefined;

export function isCrmConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!isCrmConfigured()) {
    client = null;
    return client;
  }
  client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}

export interface CrmOutcomeRow {
  response_id: string;
  event: string;
  occurred_at: string; // ISO
}

// Idempotent upsert keyed (response_id, event) — the n8n pull can safely retry
// or re-request an overlapping `since` window without creating duplicates.
export async function upsertOutcomes(rows: CrmOutcomeRow[]): Promise<{ ok: boolean; written: number; error?: string }> {
  const supabase = getClient();
  if (!supabase) return { ok: false, written: 0, error: "Supabase not configured" };
  if (rows.length === 0) return { ok: true, written: 0 };
  const { error } = await supabase.from("crm_lead_outcomes").upsert(rows, { onConflict: "response_id,event" });
  if (error) return { ok: false, written: 0, error: error.message };
  return { ok: true, written: rows.length };
}

export interface CrmSyncState {
  lastSuccessAt: string | null;
  lastSuccessCursor: string | null;
  lastAttemptAt: string | null;
  lastStatus: "ok" | "failed" | "never_run";
  lastError: string | null;
  rowsLastPull: number | null;
}

export async function getSyncState(): Promise<CrmSyncState | null> {
  const supabase = getClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("crm_sync_state")
    .select("*")
    .eq("id", "lead_outcomes")
    .maybeSingle();
  if (error || !data) return null;
  return {
    lastSuccessAt: data.last_success_at,
    lastSuccessCursor: data.last_success_cursor,
    lastAttemptAt: data.last_attempt_at,
    lastStatus: data.last_status,
    lastError: data.last_error,
    rowsLastPull: data.rows_last_pull,
  };
}

// Called by the n8n workflow (via the Supabase REST/Postgres node) after every
// pull attempt — success or failure. A failed pull (401/404/timeout) must
// still write a row here so the failure is visible as a failure, never
// silently read back as "zero new events" (see CONTEXT.md).
export async function recordSyncAttempt(input: {
  status: "ok" | "failed";
  cursor?: string;
  error?: string;
  rowsCount?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    last_attempt_at: now,
    last_status: input.status,
    last_error: input.status === "failed" ? input.error ?? "unknown error" : null,
  };
  if (input.status === "ok") {
    update.last_success_at = now;
    if (input.cursor) update.last_success_cursor = input.cursor;
    update.rows_last_pull = input.rowsCount ?? 0;
  }
  const { error } = await supabase.from("crm_sync_state").update(update).eq("id", "lead_outcomes");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface CrmEventTypeStatus {
  event: string;
  track: string;
  liveAsOf: string | null; // null = never observed emitting yet
  lastSeenAt: string | null;
}

// Marks any event type in `eventNames` that has never been seen before as now
// live (stamps live_as_of the first time), and always bumps last_seen_at for
// every type actually present in a pull's response. This is the mechanism
// that lets the UI tell "the CRM hasn't wired this event up yet" (liveAsOf
// null) apart from "wired up, zero of these so far" (liveAsOf set).
export async function markEventTypesObserved(eventNames: string[]): Promise<void> {
  const supabase = getClient();
  if (!supabase || eventNames.length === 0) return;
  const now = new Date().toISOString();
  const { data } = await supabase.from("crm_event_types").select("event, live_as_of").in("event", eventNames);
  const toStampLive = (data ?? []).filter((r) => !r.live_as_of).map((r) => r.event);
  if (toStampLive.length > 0) {
    await supabase.from("crm_event_types").update({ live_as_of: now, last_seen_at: now }).in("event", toStampLive);
  }
  const alreadyLive = eventNames.filter((e) => !toStampLive.includes(e));
  if (alreadyLive.length > 0) {
    await supabase.from("crm_event_types").update({ last_seen_at: now }).in("event", alreadyLive);
  }
}

export async function getEventTypeStatus(): Promise<CrmEventTypeStatus[]> {
  const supabase = getClient();
  if (!supabase) {
    // Supabase not configured: fall back to the static seed list so the UI
    // still renders the full 15-type shape (all "not yet emitted"), rather
    // than an empty list that reads as "no event types exist".
    return CRM_EVENT_TYPES.map((e) => ({ event: e.event, track: e.track, liveAsOf: null, lastSeenAt: null }));
  }
  const { data, error } = await supabase.from("crm_event_types").select("*");
  if (error || !data) {
    return CRM_EVENT_TYPES.map((e) => ({ event: e.event, track: e.track, liveAsOf: null, lastSeenAt: null }));
  }
  return data.map((r) => ({ event: r.event, track: r.track, liveAsOf: r.live_as_of, lastSeenAt: r.last_seen_at }));
}

// Every outcome row for a set of Typeform response ids — the caller joins
// these back to campaigns via leads:all (Upstash KV, lib/kv.ts's getLeads()),
// since response_id is the shared key and campaign attribution isn't
// duplicated onto this table.
export async function getOutcomesForResponseIds(responseIds: string[]): Promise<CrmOutcomeRow[]> {
  const supabase = getClient();
  if (!supabase || responseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("crm_lead_outcomes")
    .select("response_id, event, occurred_at")
    .in("response_id", responseIds);
  if (error || !data) return [];
  return data;
}

// Every outcome row this store has, unfiltered — used when the caller wants
// to aggregate across ALL known leads rather than a specific response-id set
// (e.g. portfolio-wide event counts regardless of whether the lead's campaign
// is still in leads:all today).
export async function getAllOutcomes(): Promise<CrmOutcomeRow[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("crm_lead_outcomes").select("response_id, event, occurred_at");
  if (error || !data) return [];
  return data;
}
