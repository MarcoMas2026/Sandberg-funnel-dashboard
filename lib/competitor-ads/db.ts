import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { COMPETITOR_MAP } from "../config";
import type { CompetitorAdAgeGenderRow, CompetitorAdDetail, CompetitorAdTargetLocation } from "../types";

// Server-only client — SUPABASE_SERVICE_ROLE_KEY must never reach the browser
// bundle (same rule as lib/kv.ts, lib/social/db.ts, lib/crm/db.ts). Reuses the
// same Supabase project as those, dedicated tables (see
// db/migrations/008_competitor_ads.sql). Nothing here touches lib/kv.ts's
// funnel keys or lib/crm/db.ts's tables — this module is fully decoupled.
let client: SupabaseClient | null | undefined;

export function isCompetitorAdsConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!isCompetitorAdsConfigured()) {
    client = null;
    return client;
  }
  client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}

interface SnapshotRow {
  ad_archive_id: string;
  snapshot_date: string;
  competitor_key: string;
  competitor_label: string;
  match_type: string;
  tier: string;
  page_id: string | null;
  page_name: string | null;
  ad_creative_body: string | null;
  ad_creative_link_title: string | null;
  ad_snapshot_url: string | null;
  publisher_platforms: string[] | null;
  languages: string[] | null;
  ad_delivery_start_time: string | null;
  ad_delivery_stop_time: string | null;
  ad_creative_bodies?: string[] | null;
  ad_creative_link_titles?: string[] | null;
  ad_creative_link_descriptions?: string[] | null;
  eu_total_reach?: number | null;
  age_gender_breakdown?: CompetitorAdAgeGenderRow[] | null;
  target_ages?: string[] | null;
  target_gender?: string | null;
  target_locations?: CompetitorAdTargetLocation[] | null;
}

export interface CompetitorSummaryRow {
  competitor_key: string;
  competitor_label: string;
  tier: "local" | "global";
  active_ad_count: number;
  longest_running_days: number | null;
  last_new_ad_date: string | null; // the most recent first-seen date among this competitor's ads
}

export interface CompetitorAdFeedItem {
  ad_archive_id: string;
  competitor_key: string;
  competitor_label: string;
  tier: "local" | "global";
  ad_creative_body: string | null;
  ad_creative_link_title: string | null;
  ad_snapshot_url: string | null;
  publisher_platforms: string[];
  languages: string[];
  first_seen_date: string;
  ad_delivery_start_time: string | null;
}

export interface CompetitorActivityTrendPoint {
  date: string;
  competitor_key: string;
  active_ad_count: number;
}

export interface CompetitorAdsSyncState {
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastStatus: "ok" | "failed" | "never_run";
  lastError: string | null;
  rowsLastPull: number | null;
}

export interface CompetitorAdsHistory {
  connected: boolean;
  summary: CompetitorSummaryRow[];
  feed: CompetitorAdFeedItem[];
  trend: CompetitorActivityTrendPoint[];
  syncState: CompetitorAdsSyncState | null;
  error?: string;
}

const EMPTY_HISTORY: Omit<CompetitorAdsHistory, "connected" | "error"> = {
  summary: [],
  feed: [],
  trend: [],
  syncState: null,
};

// Idempotent upsert keyed (ad_archive_id, snapshot_date) — a retried/re-run
// same-day pull never creates duplicate rows.
export async function upsertSnapshotRows(rows: SnapshotRow[]): Promise<{ ok: boolean; written: number; error?: string }> {
  const supabase = getClient();
  if (!supabase) return { ok: false, written: 0, error: "Supabase not configured" };
  if (rows.length === 0) return { ok: true, written: 0 };
  const { error } = await supabase
    .from("competitor_ad_snapshots")
    .upsert(rows, { onConflict: "ad_archive_id,snapshot_date" });
  if (error) return { ok: false, written: 0, error: error.message };
  return { ok: true, written: rows.length };
}

// Called after every pull attempt, success or failure — a failure must be
// visible as a failure, never silently read back as "no new ads today".
export async function recordSyncAttempt(input: {
  status: "ok" | "failed";
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
    update.rows_last_pull = input.rowsCount ?? 0;
  }
  const { error } = await supabase.from("competitor_ads_sync_state").update(update).eq("id", "competitor_ads");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function getSyncState(supabase: SupabaseClient): Promise<CompetitorAdsSyncState | null> {
  const { data, error } = await supabase
    .from("competitor_ads_sync_state")
    .select("*")
    .eq("id", "competitor_ads")
    .maybeSingle();
  if (error || !data) return null;
  return {
    lastSuccessAt: data.last_success_at,
    lastAttemptAt: data.last_attempt_at,
    lastStatus: data.last_status,
    lastError: data.last_error,
    rowsLastPull: data.rows_last_pull,
  };
}

const LABEL_BY_KEY = new Map(COMPETITOR_MAP.map((c) => [c.key, c]));

type WindowRow = Pick<
  SnapshotRow,
  | "ad_archive_id"
  | "snapshot_date"
  | "competitor_key"
  | "competitor_label"
  | "tier"
  | "ad_creative_body"
  | "ad_creative_link_title"
  | "ad_snapshot_url"
  | "publisher_platforms"
  | "languages"
  | "ad_delivery_start_time"
>;

// PostgREST caps a single response at 1000 rows by default — at current
// volumes (thousands of active ads/day across 22 competitors) a 30-day
// window easily exceeds that, so this must page through with .range()
// rather than a single .select().
const PAGE_SIZE = 1000;
async function fetchAllRows(
  supabase: SupabaseClient,
  sinceStr: string,
  columns: string
): Promise<{ rows: WindowRow[]; error?: string }> {
  const rows: WindowRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("competitor_ad_snapshots")
      .select(columns)
      .gte("snapshot_date", sinceStr)
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error: error.message };
    const page = (data ?? []) as unknown as WindowRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { rows };
}

// Everything the /competitor-ads page needs beyond the KV "live" read: the
// by-competitor summary table, a recent-ad feed, and an activity trend for
// sparklines — all derived from the day-by-day snapshot table, no mutable
// "current state" row to keep in sync.
export async function getCompetitorAdsHistory(days: number): Promise<CompetitorAdsHistory> {
  const supabase = getClient();
  if (!supabase) return { connected: false, ...EMPTY_HISTORY, error: "Supabase not configured" };

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const WINDOW_COLUMNS =
    "ad_archive_id, snapshot_date, competitor_key, competitor_label, tier, ad_creative_body, ad_creative_link_title, ad_snapshot_url, publisher_platforms, languages, ad_delivery_start_time";

  const [latestDateRes, windowResult, syncState] = await Promise.all([
    supabase
      .from("competitor_ad_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchAllRows(supabase, sinceStr, WINDOW_COLUMNS),
    getSyncState(supabase),
  ]);

  if (windowResult.error) {
    return { connected: true, ...EMPTY_HISTORY, syncState, error: windowResult.error };
  }

  const rows = windowResult.rows;
  const latestDate = latestDateRes.data?.snapshot_date ?? null;

  // First-seen date per ad (across the whole window fetched) drives both the
  // feed's "new ad" ordering and the summary's longest-running/last-new stats.
  const firstSeenByAd = new Map<string, string>();
  const adsByCompetitor = new Map<string, Set<string>>();
  const activeCountByDateAndCompetitor = new Map<string, Map<string, Set<string>>>();

  for (const row of rows) {
    const existing = firstSeenByAd.get(row.ad_archive_id);
    if (!existing || row.snapshot_date < existing) firstSeenByAd.set(row.ad_archive_id, row.snapshot_date);

    if (!adsByCompetitor.has(row.competitor_key)) adsByCompetitor.set(row.competitor_key, new Set());
    adsByCompetitor.get(row.competitor_key)!.add(row.ad_archive_id);

    if (!activeCountByDateAndCompetitor.has(row.snapshot_date)) {
      activeCountByDateAndCompetitor.set(row.snapshot_date, new Map());
    }
    const byCompetitor = activeCountByDateAndCompetitor.get(row.snapshot_date)!;
    if (!byCompetitor.has(row.competitor_key)) byCompetitor.set(row.competitor_key, new Set());
    byCompetitor.get(row.competitor_key)!.add(row.ad_archive_id);
  }

  const summary: CompetitorSummaryRow[] = Array.from(adsByCompetitor.entries()).map(([key, adIds]) => {
    const config = LABEL_BY_KEY.get(key);
    const activeToday = latestDate
      ? rows.filter((r) => r.competitor_key === key && r.snapshot_date === latestDate).length
      : 0;
    const firstSeenDates = Array.from(adIds)
      .map((id) => firstSeenByAd.get(id))
      .filter((d): d is string => Boolean(d));
    const longestRunningDays = firstSeenDates.length
      ? Math.max(...firstSeenDates.map((d) => daysSince(d)))
      : null;
    const lastNewAdDate = firstSeenDates.length ? firstSeenDates.sort().at(-1)! : null;
    return {
      competitor_key: key,
      competitor_label: config?.label ?? key,
      tier: (config?.tier ?? "global") as "local" | "global",
      active_ad_count: activeToday,
      longest_running_days: longestRunningDays,
      last_new_ad_date: lastNewAdDate,
    };
  });
  summary.sort((a, b) => b.active_ad_count - a.active_ad_count);

  const feed: CompetitorAdFeedItem[] = Array.from(firstSeenByAd.entries())
    .map(([adId, firstSeen]) => {
      const row = rows.find((r) => r.ad_archive_id === adId)!;
      return {
        ad_archive_id: adId,
        competitor_key: row.competitor_key,
        competitor_label: row.competitor_label,
        tier: row.tier as "local" | "global",
        ad_creative_body: row.ad_creative_body,
        ad_creative_link_title: row.ad_creative_link_title,
        ad_snapshot_url: row.ad_snapshot_url,
        publisher_platforms: row.publisher_platforms ?? [],
        languages: row.languages ?? [],
        first_seen_date: firstSeen,
        ad_delivery_start_time: row.ad_delivery_start_time,
      };
    })
    .sort((a, b) => (a.first_seen_date < b.first_seen_date ? 1 : -1))
    .slice(0, 100);

  const trend: CompetitorActivityTrendPoint[] = [];
  for (const [date, byCompetitor] of activeCountByDateAndCompetitor.entries()) {
    for (const [key, adIds] of byCompetitor.entries()) {
      trend.push({ date, competitor_key: key, active_ad_count: adIds.size });
    }
  }
  trend.sort((a, b) => (a.date < b.date ? -1 : 1));

  return { connected: true, summary, feed, trend, syncState };
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

const DETAIL_COLUMNS =
  "ad_archive_id, snapshot_date, competitor_key, competitor_label, tier, page_name, ad_snapshot_url, publisher_platforms, languages, ad_delivery_start_time, ad_delivery_stop_time, ad_creative_bodies, ad_creative_link_titles, ad_creative_link_descriptions, eu_total_reach, age_gender_breakdown, target_ages, target_gender, target_locations";

export interface CompetitorAdDetailResult {
  connected: boolean;
  competitor_label: string | null;
  ads: CompetitorAdDetail[];
  error?: string;
}

// Every currently-active ad for one competitor, full creative variants +
// real EU reach/targeting where Meta discloses it. Scoped to a single
// competitor (unlike getCompetitorAdsHistory's 30-day/all-competitors sweep),
// so even The Agency's ~1,400 ads stay a small, fast query.
export async function getCompetitorAdDetail(competitorKey: string): Promise<CompetitorAdDetailResult> {
  const supabase = getClient();
  if (!supabase) return { connected: false, competitor_label: null, ads: [], error: "Supabase not configured" };

  const rows: SnapshotRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("competitor_ad_snapshots")
      .select(DETAIL_COLUMNS)
      .eq("competitor_key", competitorKey)
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { connected: true, competitor_label: null, ads: [], error: error.message };
    const page = (data ?? []) as unknown as SnapshotRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (rows.length === 0) {
    const config = LABEL_BY_KEY.get(competitorKey);
    return { connected: true, competitor_label: config?.label ?? null, ads: [] };
  }

  const byAd = new Map<string, SnapshotRow[]>();
  for (const r of rows) {
    if (!byAd.has(r.ad_archive_id)) byAd.set(r.ad_archive_id, []);
    byAd.get(r.ad_archive_id)!.push(r);
  }

  const latestOverall = rows.reduce((max, r) => (r.snapshot_date > max ? r.snapshot_date : max), rows[0].snapshot_date);

  const ads: CompetitorAdDetail[] = [];
  for (const [adId, snapshots] of byAd.entries()) {
    snapshots.sort((a, b) => (a.snapshot_date < b.snapshot_date ? -1 : 1));
    const latest = snapshots[snapshots.length - 1];
    if (latest.snapshot_date !== latestOverall) continue; // only currently-active ads
    const first = snapshots[0];

    const bodies = latest.ad_creative_bodies ?? (latest.ad_creative_body ? [latest.ad_creative_body] : []);
    const titles = latest.ad_creative_link_titles ?? (latest.ad_creative_link_title ? [latest.ad_creative_link_title] : []);
    const descriptions = latest.ad_creative_link_descriptions ?? [];
    const variantCount = Math.max(bodies.length, titles.length, descriptions.length, 1);
    const variants = Array.from({ length: variantCount }, (_, i) => ({
      body: bodies[i] ?? null,
      title: titles[i] ?? null,
      description: descriptions[i] ?? null,
    }));

    ads.push({
      ad_archive_id: adId,
      competitor_key: latest.competitor_key,
      competitor_label: latest.competitor_label,
      tier: latest.tier as "local" | "global",
      page_name: latest.page_name,
      ad_snapshot_url: latest.ad_snapshot_url,
      publisher_platforms: latest.publisher_platforms ?? [],
      languages: latest.languages ?? [],
      ad_delivery_start_time: latest.ad_delivery_start_time,
      ad_delivery_stop_time: latest.ad_delivery_stop_time,
      first_seen_date: first.snapshot_date,
      days_running: daysSince(first.snapshot_date),
      variants,
      eu_total_reach: latest.eu_total_reach ?? null,
      age_gender_breakdown: latest.age_gender_breakdown ?? null,
      target_ages: latest.target_ages ?? null,
      target_gender: latest.target_gender ?? null,
      target_locations: latest.target_locations ?? null,
    });
  }

  ads.sort((a, b) => (b.eu_total_reach ?? -1) - (a.eu_total_reach ?? -1) || b.days_running - a.days_running);

  return { connected: true, competitor_label: ads[0]?.competitor_label ?? LABEL_BY_KEY.get(competitorKey)?.label ?? null, ads };
}
