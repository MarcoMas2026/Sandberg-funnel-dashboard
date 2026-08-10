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

// Earliest month this store has (or will ever backfill) data for — matches
// the June floor already used by Mission Control's month picker. Every
// "since June" query anchors here so a later backfill covering an earlier
// month doesn't silently need this constant updated too.
export const HISTORY_START = { year: 2026, month: 6 };

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

interface MonthlyTotalsRow {
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
  leads_source: "typeform_verified" | "unavailable";
  cpl: number | null;
  impressions: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
  engagement: number;
  outbound_clicks: number;
  starts: number | null;
  form_id: string | null;
  form_name: string | null;
  start_date: string | null;
  stop_date: string | null;
}

// Builds funnel_monthly_totals rows for the CURRENT (year, month) bucket only,
// straight from the same live FunnelCampaign snapshot the campaign detail page
// already renders correctly (meta.* aggregate, typeform.* incl. starts/completions).
// This exists so a campaign's row gets written continuously WHILE it's still live —
// funnel_monthly_totals previously had no writer at all in this app; every row was a
// manual one-off backfill, which is how S'OLIVERA (2026-07) ended up with starts ===
// completions: the manual backfill used the completed-response count for both instead
// of separately counting incomplete (completed=false) responses like the live n8n
// Typeform Sync node does. Capturing the live, already-correct typeform.starts here
// closes that gap for every campaign going forward, so a future deactivation (removal
// from lib/config.ts) no longer depends on a human re-deriving these numbers by hand.
export function monthlyTotalsFromCampaigns(campaigns: FunnelCampaign[], year: number, month: number): MonthlyTotalsRow[] {
  return campaigns.map((c) => {
    const leadsVerified = c.typeform.form_id !== "";
    return {
      campaign_id: c.campaign_id,
      year,
      month,
      campaign_name: c.campaign_name,
      property: c.property,
      ref: c.ref,
      campaign_type: c.campaign_type,
      status: c.status,
      spend: c.meta.spend,
      leads: leadsVerified ? c.typeform.completions : null,
      leads_source: leadsVerified ? "typeform_verified" : "unavailable",
      cpl: leadsVerified ? c.meta.cpl : null,
      impressions: c.meta.impressions,
      clicks: c.meta.clicks,
      link_clicks: c.meta.link_clicks,
      ctr: c.meta.ctr,
      engagement: c.meta.engagement,
      outbound_clicks: Math.round(c.meta.outbound_ctr * c.meta.impressions),
      starts: leadsVerified ? c.typeform.starts : null,
      form_id: leadsVerified ? c.typeform.form_id : null,
      form_name: leadsVerified ? c.typeform.form_name : null,
      start_date: c.meta.start_date,
      stop_date: c.meta.stop_date,
    };
  });
}

export async function upsertMonthlyTotals(rows: MonthlyTotalsRow[]): Promise<{ ok: boolean; written: number; error?: string }> {
  const supabase = getClient();
  if (!supabase) return { ok: false, written: 0, error: "Supabase not configured" };
  if (rows.length === 0) return { ok: true, written: 0 };
  const { error } = await supabase.from("funnel_monthly_totals").upsert(rows, { onConflict: "campaign_id,year,month" });
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

// The (year, month) this campaign was actually most active in — by leads,
// falling back to spend as a tiebreak/for campaigns with no verified leads —
// NOT simply its most recent calendar month. Lets the campaign detail page
// resolve historical data for a campaign even when the caller's requested
// month (e.g. Mission Control's currently selected KPI month, no longer tied
// to what Inactive Campaigns displays) isn't one the campaign actually ran
// in. Picking "most recent" instead of "most active" would routinely land on
// a near-empty tail month — e.g. a campaign that ran hard in June (€399
// spend, 20 leads) then trickled out with a final €5/0-lead day in July
// before being paused; "latest" picks July and shows an almost-blank page
// for a campaign whose Inactive Campaigns card correctly shows the full
// €404/20-lead all-time total.
export async function getLatestMonthWithData(campaignId: string): Promise<{ year: number; month: number } | null> {
  const supabase = getClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("funnel_monthly_totals")
    .select("year, month, spend, leads")
    .eq("campaign_id", campaignId);
  if (error || !data || data.length === 0) return null;
  const best = data.reduce((a, b) => {
    const aLeads = a.leads ?? 0;
    const bLeads = b.leads ?? 0;
    if (aLeads !== bLeads) return bLeads > aLeads ? b : a;
    return (b.spend ?? 0) > (a.spend ?? 0) ? b : a;
  });
  return { year: best.year, month: best.month };
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

export interface CatalogCampaign {
  campaign_id: string;
  campaign_name: string;
  property: string;
  ref: string;
  campaign_type: string;
  status: string;
}

// Properties hidden from the Campaign Curve selector specifically — kept out
// of the picklist at the user's request (2026-08-06), not deleted from
// funnel_daily_history, so they stay untouched for every other consumer
// (Mission Control's Portfolio Leaderboard, etc.).
const CURVE_HIDDEN_PROPERTIES = new Set(
  [
    "SP -31903 - Apartamento Vista Mar",
    "SP - APARTMENT PALMA OLD TOWN",
    "FINCA SON CATLAR",
    "Finca Son Llum",
  ].map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
);

// Every campaign this store has ever seen a daily snapshot for, active or
// not — powers the Campaign Curve selector, which (unlike CampaignSelector)
// needs to offer inactive/dropped campaigns too. Dedupes to each campaign's
// most recent snapshot so `status`/`campaign_name` reflect the latest known
// state rather than the day it first appeared.
export async function getCampaignsCatalog(): Promise<{ connected: boolean; campaigns: CatalogCampaign[] }> {
  const supabase = getClient();
  if (!supabase) return { connected: false, campaigns: [] };
  const { data, error } = await supabase
    .from("funnel_daily_history")
    .select("campaign_id, campaign_name, property, ref, campaign_type, status, date")
    .order("date", { ascending: false });
  if (error) return { connected: false, campaigns: [] };
  const byId = new Map<string, CatalogCampaign>();
  for (const r of data ?? []) {
    if (byId.has(r.campaign_id)) continue; // first hit per id = most recent, since sorted desc
    if (CURVE_HIDDEN_PROPERTIES.has(String(r.property ?? "").trim().toLowerCase().replace(/\s+/g, " "))) continue;
    byId.set(r.campaign_id, {
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      property: r.property,
      ref: r.ref,
      campaign_type: r.campaign_type,
      status: r.status,
    });
  }
  return { connected: true, campaigns: Array.from(byId.values()) };
}

// Full daily history (all time since HISTORY_START, not just one month) for
// a set of campaigns — powers the Campaign Curve chart, which plots each
// campaign against its own "day 1, day 2, ..." runtime rather than a shared
// calendar month.
export async function getCampaignSeries(
  campaignIds: string[]
): Promise<{ connected: boolean; series: Record<string, DailyRow[]> }> {
  const supabase = getClient();
  if (!supabase) return { connected: false, series: {} };
  if (campaignIds.length === 0) return { connected: true, series: {} };
  const { data, error } = await supabase
    .from("funnel_daily_history")
    .select("campaign_id, date, spend, leads, cpl, impressions, clicks, link_clicks, ctr")
    .in("campaign_id", campaignIds)
    .order("date", { ascending: true });
  if (error) return { connected: false, series: {} };
  const series: Record<string, DailyRow[]> = {};
  for (const r of data ?? []) {
    const row: DailyRow = {
      date: r.date,
      spend: Number(r.spend ?? 0),
      leads: Number(r.leads ?? 0),
      cpl: Number(r.cpl ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      link_clicks: Number(r.link_clicks ?? 0),
      ctr: Number(r.ctr ?? 0),
    };
    (series[r.campaign_id] ??= []).push(row);
  }
  return { connected: true, series };
}

export interface LeaderboardCampaignTotal {
  campaign_id: string;
  property: string;
  ref: string;
  campaign_type: string;
  spend: number;
  leads: number;
  cpl: number;
  // Real chronological daily leads since HISTORY_START, from
  // funnel_daily_history (populated for every campaign with spend, not just
  // ones with verified totals) — empty when the daily table genuinely has no
  // rows for this campaign yet, in which case the caller falls back to a
  // synthetic shape rather than plotting nothing.
  trend: number[];
}

// Per-campaign totals summed across every month from HISTORY_START onward —
// backs the Portfolio Leaderboard and Mission Control's Inactive Campaigns
// section, the single source of truth for any campaign not currently ACTIVE
// (the old hand-curated `historical:campaigns` KV pool was retired — it
// drifted out of sync with this store with nothing keeping the two in step).
// For each (campaign, month) pair, prefers the
// falling back to summing funnel_daily_history for months not backfilled to
// a monthly aggregate (e.g. the current, in-progress month) — same
// preference as getMonthlyTotals, just applied per campaign across many
// months instead of across campaigns for one month. A campaign with no
// verified/derived leads in ANY of its months is excluded entirely (same
// "leads must be real, never guessed" rule as everywhere else in this file).
export async function getLeaderboardTotals(): Promise<{ connected: boolean; rows: LeaderboardCampaignTotal[] }> {
  const supabase = getClient();
  if (!supabase) return { connected: false, rows: [] };

  const { year: sinceYear, month: sinceMonth } = HISTORY_START;

  const { data: monthlyRows, error: monthlyError } = await supabase
    .from("funnel_monthly_totals")
    .select("*")
    .or(`year.gt.${sinceYear},and(year.eq.${sinceYear},month.gte.${sinceMonth})`);
  if (monthlyError) return { connected: false, rows: [] };

  const sinceDate = `${sinceYear}-${String(sinceMonth).padStart(2, "0")}-01`;
  const { data: dailyRows, error: dailyError } = await supabase
    .from("funnel_daily_history")
    .select("*")
    .gte("date", sinceDate);
  if (dailyError) return { connected: false, rows: [] };

  interface Acc {
    property: string;
    ref: string;
    campaign_type: string;
    spend: number;
    leads: number;
    hasLeads: boolean;
  }
  const perCampaign = new Map<string, Acc>();
  const ensure = (campaignId: string, property: string, ref: string, campaign_type: string): Acc => {
    let acc = perCampaign.get(campaignId);
    if (!acc) {
      acc = { property, ref, campaign_type, spend: 0, leads: 0, hasLeads: false };
      perCampaign.set(campaignId, acc);
    }
    return acc;
  };

  // Monthly rows are authoritative for whichever (campaign, month) pairs they cover.
  const coveredMonthly = new Set<string>();
  for (const r of monthlyRows ?? []) {
    coveredMonthly.add(`${r.campaign_id}:${r.year}-${String(r.month).padStart(2, "0")}`);
    const acc = ensure(r.campaign_id, r.property, r.ref, r.campaign_type);
    acc.spend += Number(r.spend ?? 0);
    if (r.leads !== null && r.leads !== undefined) {
      acc.leads += Number(r.leads);
      acc.hasLeads = true;
    }
  }

  // Daily rows fill in any (campaign, month) not already covered by a monthly
  // aggregate — grouped by month first so a month gets summed once, not
  // double-counted against a monthly row that might also exist for it.
  interface DailyAcc {
    property: string;
    ref: string;
    campaign_type: string;
    spend: number;
    leads: number;
  }
  const dailyByCampaignMonth = new Map<string, DailyAcc>();
  // Separate from the totals accounting above (which skips days already
  // covered by a monthly aggregate to avoid double-counting) — the trend
  // chart wants every real daily point regardless of which table the month's
  // TOTAL came from.
  const trendByCampaign = new Map<string, { date: string; leads: number }[]>();
  for (const r of dailyRows ?? []) {
    const ym = String(r.date).slice(0, 7);
    const key = `${r.campaign_id}:${ym}`;
    if (!coveredMonthly.has(key)) {
      let acc = dailyByCampaignMonth.get(key);
      if (!acc) {
        acc = { property: r.property, ref: r.ref, campaign_type: r.campaign_type, spend: 0, leads: 0 };
        dailyByCampaignMonth.set(key, acc);
      }
      acc.spend += Number(r.spend ?? 0);
      acc.leads += Number(r.leads ?? 0);
    }
    const points = trendByCampaign.get(r.campaign_id) ?? [];
    points.push({ date: r.date, leads: Number(r.leads ?? 0) });
    trendByCampaign.set(r.campaign_id, points);
  }
  for (const [key, v] of dailyByCampaignMonth) {
    const campaignId = key.split(":")[0];
    const acc = ensure(campaignId, v.property, v.ref, v.campaign_type);
    acc.spend += v.spend;
    acc.leads += v.leads;
    acc.hasLeads = true; // daily-derived leads always come from real Typeform-sync numbers
  }

  const rows: LeaderboardCampaignTotal[] = [];
  for (const [campaign_id, v] of perCampaign) {
    if (!v.hasLeads) continue;
    const trend = (trendByCampaign.get(campaign_id) ?? [])
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((p) => p.leads);
    rows.push({
      campaign_id,
      property: v.property,
      ref: v.ref,
      campaign_type: v.campaign_type,
      spend: v.spend,
      leads: v.leads,
      cpl: v.leads > 0 ? v.spend / v.leads : 0,
      trend,
    });
  }
  return { connected: true, rows };
}
