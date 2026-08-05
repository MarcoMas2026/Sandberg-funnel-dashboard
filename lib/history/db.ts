import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { FunnelCampaign } from "@/lib/types";

// Server-only client — SUPABASE_SERVICE_ROLE_KEY must never reach the browser
// bundle (same rule as lib/kv.ts's KV_REST_API_TOKEN and lib/social/db.ts).
// Reuses the Instagram module's Supabase project (same env vars) but a
// dedicated table (funnel_daily_history, see db/migrations/003_funnel_history.sql)
// — fully decoupled from lib/social/*.
let client: SupabaseClient | null | undefined;

export function isHistoryConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!isHistoryConfigured()) {
    client = null;
    return client;
  }
  client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    // Next.js patches global fetch() and caches by default — opt every
    // Supabase request out explicitly (same fix as lib/social/db.ts).
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}

interface HistoryRow {
  campaign_id: string;
  date: string;
  campaign_name: string;
  property: string;
  ref: string;
  campaign_type: string;
  status: string;
  spend: number;
  leads: number;
  cpl: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
}

// Flattens every campaign's meta.daily[] rows into one upsert batch. Idempotent
// on (campaign_id, date) — safe to call on every dashboard load; naturally
// backfills any day Meta's daily insights still has on hand but we hadn't
// stored yet, and is a no-op for days already captured.
export function rowsFromCampaigns(campaigns: FunnelCampaign[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const c of campaigns) {
    for (const d of c.meta.daily) {
      rows.push({
        campaign_id: c.campaign_id,
        date: d.date,
        campaign_name: c.campaign_name,
        property: c.property,
        ref: c.ref,
        campaign_type: c.campaign_type,
        status: c.status,
        spend: d.spend,
        leads: d.leads,
        cpl: d.cpl,
        impressions: d.impressions,
        clicks: d.clicks,
        link_clicks: d.link_clicks,
        ctr: d.ctr,
      });
    }
  }
  return rows;
}

export async function upsertDailySnapshots(rows: HistoryRow[]): Promise<{ ok: boolean; written: number; error?: string }> {
  const supabase = getClient();
  if (!supabase) return { ok: false, written: 0, error: "Supabase not configured" };
  if (rows.length === 0) return { ok: true, written: 0 };
  const { error } = await supabase.from("funnel_daily_history").upsert(rows, { onConflict: "campaign_id,date" });
  if (error) return { ok: false, written: 0, error: error.message };
  return { ok: true, written: rows.length };
}

export interface MonthlyTotals {
  connected: boolean;
  spend: number;
  leads: number;
}

// Sums across ALL campaigns (any status) for a given calendar month. Prefers
// funnel_monthly_totals (Meta's own monthly aggregate — accurate, backfillable
// per db/migrations/004) when a row exists for this year/month; falls back to
// summing funnel_daily_history for months that haven't been backfilled yet
// (e.g. the current, still-in-progress month).
export async function getMonthlyTotals(year: number, month: number, monthStart: string, monthEnd: string): Promise<MonthlyTotals> {
  const supabase = getClient();
  if (!supabase) return { connected: false, spend: 0, leads: 0 };

  const { data: monthlyRows, error: monthlyError } = await supabase
    .from("funnel_monthly_totals")
    .select("spend, leads")
    .eq("year", year)
    .eq("month", month);
  if (monthlyError) return { connected: false, spend: 0, leads: 0 };
  if (monthlyRows && monthlyRows.length > 0) {
    const spend = monthlyRows.reduce((s, r) => s + Number(r.spend ?? 0), 0);
    const leads = monthlyRows.reduce((s, r) => s + Number(r.leads ?? 0), 0);
    return { connected: true, spend, leads };
  }

  const { data, error } = await supabase
    .from("funnel_daily_history")
    .select("spend, leads")
    .gte("date", monthStart)
    .lte("date", monthEnd);
  // A query error (e.g. the table hasn't been migrated in yet) must NOT be
  // reported as "connected" with zero totals — the caller falls back to a
  // live scan when connected is false, and a false "connected: true, 0" here
  // would silently override that accurate fallback with a wrong zero.
  if (error) return { connected: false, spend: 0, leads: 0 };
  if (!data) return { connected: true, spend: 0, leads: 0 };
  const spend = data.reduce((s, r) => s + Number(r.spend ?? 0), 0);
  const leads = data.reduce((s, r) => s + Number(r.leads ?? 0), 0);
  return { connected: true, spend, leads };
}

export interface MonthlyCampaignRow {
  campaign_id: string;
  campaign_name: string;
  property: string;
  ref: string;
  campaign_type: string;
  status: string;
  spend: number;
  leads: number | null;
  cpl: number | null;
  leads_source: "typeform_verified" | "unavailable" | "daily_derived";
}

// Per-campaign totals for a given month — powers Mission Control's "Paid
// Campaigns" list for a selected month, including campaigns no longer live
// in lib/config.ts. Same monthly-aggregate-first, daily-sum-fallback
// preference as getMonthlyTotals.
export async function getMonthlyCampaignRows(
  year: number,
  month: number,
  monthStart: string,
  monthEnd: string
): Promise<{ connected: boolean; rows: MonthlyCampaignRow[] }> {
  const supabase = getClient();
  if (!supabase) return { connected: false, rows: [] };

  const { data: monthlyRows, error: monthlyError } = await supabase
    .from("funnel_monthly_totals")
    .select("*")
    .eq("year", year)
    .eq("month", month);
  if (monthlyError) return { connected: false, rows: [] };
  if (monthlyRows && monthlyRows.length > 0) {
    return {
      connected: true,
      rows: monthlyRows.map((r) => ({
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        property: r.property,
        ref: r.ref,
        campaign_type: r.campaign_type,
        status: r.status,
        spend: Number(r.spend ?? 0),
        leads: r.leads === null || r.leads === undefined ? null : Number(r.leads),
        cpl: r.cpl === null || r.cpl === undefined ? null : Number(r.cpl),
        leads_source: r.leads_source,
      })),
    };
  }

  const { data: dailyRows, error: dailyError } = await supabase
    .from("funnel_daily_history")
    .select("*")
    .gte("date", monthStart)
    .lte("date", monthEnd);
  if (dailyError) return { connected: false, rows: [] };
  if (!dailyRows) return { connected: true, rows: [] };

  const byCampaign = new Map<string, MonthlyCampaignRow>();
  for (const r of dailyRows) {
    const existing = byCampaign.get(r.campaign_id);
    if (existing) {
      existing.spend += Number(r.spend ?? 0);
      existing.leads = (existing.leads ?? 0) + Number(r.leads ?? 0);
    } else {
      byCampaign.set(r.campaign_id, {
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        property: r.property,
        ref: r.ref,
        campaign_type: r.campaign_type,
        status: r.status,
        spend: Number(r.spend ?? 0),
        leads: Number(r.leads ?? 0),
        cpl: null,
        leads_source: "daily_derived",
      });
    }
  }
  const rows = Array.from(byCampaign.values()).map((r) => ({ ...r, cpl: r.leads ? r.spend / r.leads : null }));
  return { connected: true, rows };
}

// Single campaign's totals for one month — backs the lighter detail view a
// no-longer-live-tracked campaign (e.g. dropped from lib/config.ts) falls
// back to on /campaign/[id], since it has no full FunnelCampaign shape.
export async function getCampaignMonth(
  campaignId: string,
  year: number,
  month: number,
  monthStart: string,
  monthEnd: string
): Promise<MonthlyCampaignRow | null> {
  const { rows } = await getMonthlyCampaignRows(year, month, monthStart, monthEnd);
  return rows.find((r) => r.campaign_id === campaignId) ?? null;
}

// Every column of a single funnel_monthly_totals row — used to plug a past
// month into the SAME campaign detail page a live campaign uses (see
// lib/history/campaign-detail.ts), not just the summary-only MonthlyCampaignRow.
export interface FullMonthlyRow {
  campaign_id: string;
  year: number;
  month: number;
  campaign_name: string;
  property: string;
  ref: string;
  campaign_type: string;
  status: string;
  spend: number;
  leads: number | null;
  leads_source: "typeform_verified" | "unavailable" | "daily_derived";
  cpl: number | null;
  impressions: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
  engagement: number | null;
  outbound_clicks: number | null;
  starts: number | null;
  form_id: string | null;
  form_name: string | null;
  start_date: string | null;
  stop_date: string | null;
}

export async function getFullMonthlyRow(campaignId: string, year: number, month: number): Promise<FullMonthlyRow | null> {
  const supabase = getClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("funnel_monthly_totals")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error || !data) return null;
  return data as FullMonthlyRow;
}

export interface DailyRow {
  date: string;
  spend: number;
  leads: number;
  cpl: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
}

export async function getCampaignDailyRows(campaignId: string, monthStart: string, monthEnd: string): Promise<DailyRow[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("funnel_daily_history")
    .select("date, spend, leads, cpl, impressions, clicks, link_clicks, ctr")
    .eq("campaign_id", campaignId)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    date: r.date,
    spend: Number(r.spend ?? 0),
    leads: Number(r.leads ?? 0),
    cpl: Number(r.cpl ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    link_clicks: Number(r.link_clicks ?? 0),
    ctr: Number(r.ctr ?? 0),
  }));
}
