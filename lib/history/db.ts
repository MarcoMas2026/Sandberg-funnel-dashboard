import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { FunnelCampaign, LeadRecord, MetaBreakdownRow } from "@/lib/types";

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
  reach: number;
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
        reach: d.reach,
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

// Last calendar month whose funnel_monthly_totals rows are month-scoped. Rows
// up to here were hand-backfilled from Meta's own per-month aggregate, and
// funnel_daily_history is incomplete for those months (missing days, no leads
// for some campaigns), so the monthly row is the better record. Every row
// AFTER this month was written by /api/history/sync straight from
// c.meta.spend / c.typeform.completions — the campaign's LIFETIME totals as of
// that sync, not that month's — so it must never be read as a month figure
// (September 2026 showed 9,236€ instead of 7,811€ because four campaigns that
// started in June/August carried their earlier spend into it).
const MANUAL_BACKFILL_UNTIL = { year: 2026, month: 7 };

function isManualBackfillMonth(year: number, month: number): boolean {
  return year < MANUAL_BACKFILL_UNTIL.year || (year === MANUAL_BACKFILL_UNTIL.year && month <= MANUAL_BACKFILL_UNTIL.month);
}

// Every funnel_daily_history row from `start` (to `end`, when given), oldest
// first. Paged because PostgREST caps a single response at 1000 rows, which a
// multi-month range passes quickly. Returns null on a query error.
async function fetchDailyRange(supabase: SupabaseClient, start: string, end: string | null): Promise<HistoryRow[] | null> {
  const pageSize = 1000;
  const out: HistoryRow[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from("funnel_daily_history").select("*").gte("date", start);
    if (end) query = query.lte("date", end);
    const { data, error } = await query
      .order("date", { ascending: true })
      .order("campaign_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return null;
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) return out;
  }
}

export interface MonthlyTotals {
  connected: boolean;
  spend: number;
  leads: number;
}

// Portfolio spend/leads for one calendar month, across ALL campaigns (any
// status): the sum of getMonthlyCampaignRows — i.e. every stored day from the
// 1st through the last day of the month, nothing from outside it. The same
// read serves the open month, which simply grows as each sync upserts new days.
export async function getMonthlyTotals(year: number, month: number, monthStart: string, monthEnd: string): Promise<MonthlyTotals> {
  const { connected, rows } = await getMonthlyCampaignRows(year, month, monthStart, monthEnd);
  // A query error (e.g. the table hasn't been migrated in yet) must NOT be
  // reported as "connected" with zero totals — the caller falls back to a
  // live scan when connected is false, and a false "connected: true, 0" here
  // would silently override that accurate fallback with a wrong zero.
  if (!connected) return { connected: false, spend: 0, leads: 0 };
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const leads = rows.reduce((s, r) => s + (r.leads ?? 0), 0);
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

// Per-campaign totals for one calendar month, including campaigns no longer
// live in lib/config.ts. Strictly month-scoped: funnel_daily_history rows
// dated monthStart..monthEnd, summed per campaign. The only exception is the
// hand-backfilled months (see MANUAL_BACKFILL_UNTIL), which read their
// month-scoped funnel_monthly_totals rows instead.
export async function getMonthlyCampaignRows(
  year: number,
  month: number,
  monthStart: string,
  monthEnd: string
): Promise<{ connected: boolean; rows: MonthlyCampaignRow[] }> {
  const supabase = getClient();
  if (!supabase) return { connected: false, rows: [] };

  if (isManualBackfillMonth(year, month)) {
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
  }

  const dailyRows = await fetchDailyRange(supabase, monthStart, monthEnd);
  if (!dailyRows) return { connected: false, rows: [] };

  const byCampaign = new Map<string, MonthlyCampaignRow>();
  for (const r of dailyRows) {
    const existing = byCampaign.get(r.campaign_id);
    // Rows arrive oldest first, so name/status end up as of the campaign's
    // last stored day in the month.
    byCampaign.set(r.campaign_id, {
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      property: r.property,
      ref: r.ref,
      campaign_type: r.campaign_type,
      status: r.status,
      spend: (existing?.spend ?? 0) + Number(r.spend ?? 0),
      leads: (existing?.leads ?? 0) + Number(r.leads ?? 0),
      cpl: null,
      leads_source: "daily_derived",
    });
  }
  // A campaign with stored days in the month but no spend and no leads on any
  // of them (paused, still returned by Meta) didn't run that month.
  const rows = Array.from(byCampaign.values())
    .filter((r) => r.spend > 0 || (r.leads ?? 0) > 0)
    .map((r) => ({ ...r, cpl: r.leads ? r.spend / r.leads : null }));
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
  reach: number;
}

export async function getCampaignDailyRows(campaignId: string, monthStart: string, monthEnd: string): Promise<DailyRow[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("funnel_daily_history")
    .select("date, spend, leads, cpl, impressions, clicks, link_clicks, ctr, reach")
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
    reach: Number(r.reach ?? 0),
  }));
}

export interface DailyPortfolioPoint {
  date: string;
  leads: number;
}

// Total portfolio leads per calendar day across every campaign — active AND
// inactive — for an arbitrary date range. Powers Mission Control's "Daily
// leads trend" line chart (see components/vantage/MissionControlCharts.tsx).
export async function getDailyPortfolioLeads(startDate: string, endDate: string): Promise<{ connected: boolean; rows: DailyPortfolioPoint[] }> {
  const supabase = getClient();
  if (!supabase) return { connected: false, rows: [] };
  const { data, error } = await supabase
    .from("funnel_daily_history")
    .select("date, leads")
    .gte("date", startDate)
    .lte("date", endDate);
  if (error || !data) return { connected: false, rows: [] };

  const byDate = new Map<string, number>();
  for (const r of data) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + Number(r.leads ?? 0));
  }
  const rows = Array.from(byDate, ([date, leads]) => ({ date, leads })).sort((a, b) => a.date.localeCompare(b.date));
  return { connected: true, rows };
}

export interface CampaignLeadTotal {
  campaign_id: string;
  property: string;
  campaign_type: string;
  leads: number;
}

// Per-campaign lead totals for an arbitrary date range, across every
// campaign that has rows in the window — active AND inactive/paused, unlike
// the ACTIVE-only feeds elsewhere on Mission Control. Powers the "Lead count
// by campaign" donut's 7/15/30-day toggle (see components/vantage/MissionControlCharts.tsx).
export async function getCampaignLeadTotals(startDate: string, endDate: string): Promise<{ connected: boolean; rows: CampaignLeadTotal[] }> {
  const supabase = getClient();
  if (!supabase) return { connected: false, rows: [] };
  const { data, error } = await supabase
    .from("funnel_daily_history")
    .select("campaign_id, property, campaign_type, leads")
    .gte("date", startDate)
    .lte("date", endDate);
  if (error || !data) return { connected: false, rows: [] };

  const byCampaign = new Map<string, CampaignLeadTotal>();
  for (const r of data) {
    const existing = byCampaign.get(r.campaign_id);
    if (existing) {
      existing.leads += Number(r.leads ?? 0);
    } else {
      byCampaign.set(r.campaign_id, {
        campaign_id: r.campaign_id,
        property: r.property,
        campaign_type: r.campaign_type,
        leads: Number(r.leads ?? 0),
      });
    }
  }
  return { connected: true, rows: Array.from(byCampaign.values()) };
}

// Shifts a (year, month) pair by `delta` calendar months (month is 1-indexed,
// matching every other function in this file — see callers' `start.split("-")`
// convention). Handles year rollover in either direction.
function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: ymd(new Date(year, month - 1, 1)), end: ymd(new Date(year, month, 0)) };
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export interface PeriodTotals extends MonthlyTotals {
  cpl: number | null;
}

export interface PortfolioComparison {
  current: PeriodTotals;
  previousMonth: PeriodTotals;
  previousYear: PeriodTotals;
  deltaVsPreviousMonth: { spendPct: number | null; leadsPct: number | null; cplPct: number | null };
  deltaVsPreviousYear: { spendPct: number | null; leadsPct: number | null; cplPct: number | null };
}

function withCpl(t: MonthlyTotals): PeriodTotals {
  return { ...t, cpl: t.leads > 0 ? t.spend / t.leads : null };
}

// Current month's portfolio totals plus the same figures for the previous
// calendar month and the same month a year ago, with pct deltas computed here
// so callers (the report page, Mission Control's KPI chips) don't duplicate
// this math. A comparison period with no data (`connected: false`, or
// `connected: true` but zero campaigns — i.e. before HISTORY_START) yields
// `null` deltas rather than a misleading 0%/±100%.
export async function getPortfolioComparison(year: number, month: number): Promise<PortfolioComparison> {
  const cur = monthBounds(year, month);
  const prevM = shiftMonth(year, month, -1);
  const prevMBounds = monthBounds(prevM.year, prevM.month);
  const prevY = shiftMonth(year, month, -12);
  const prevYBounds = monthBounds(prevY.year, prevY.month);

  const [current, previousMonth, previousYear] = await Promise.all([
    getMonthlyTotals(year, month, cur.start, cur.end),
    getMonthlyTotals(prevM.year, prevM.month, prevMBounds.start, prevMBounds.end),
    getMonthlyTotals(prevY.year, prevY.month, prevYBounds.start, prevYBounds.end),
  ]);

  const curT = withCpl(current);
  const prevMT = withCpl(previousMonth);
  const prevYT = withCpl(previousYear);

  const noData = (t: PeriodTotals) => !t.connected || (t.spend === 0 && t.leads === 0);

  return {
    current: curT,
    previousMonth: prevMT,
    previousYear: prevYT,
    deltaVsPreviousMonth: noData(prevMT)
      ? { spendPct: null, leadsPct: null, cplPct: null }
      : {
          spendPct: pctDelta(curT.spend, prevMT.spend),
          leadsPct: pctDelta(curT.leads, prevMT.leads),
          cplPct: curT.cpl !== null && prevMT.cpl !== null ? pctDelta(curT.cpl, prevMT.cpl) : null,
        },
    deltaVsPreviousYear: noData(prevYT)
      ? { spendPct: null, leadsPct: null, cplPct: null }
      : {
          spendPct: pctDelta(curT.spend, prevYT.spend),
          leadsPct: pctDelta(curT.leads, prevYT.leads),
          cplPct: curT.cpl !== null && prevYT.cpl !== null ? pctDelta(curT.cpl, prevYT.cpl) : null,
        },
  };
}

export interface PortfolioMonthPoint {
  year: number;
  month: number;
  spend: number;
  leads: number;
  cpl: number | null;
}

// Portfolio spend/leads summed across all campaigns, one point per calendar
// month, from `sinceYear`/`sinceMonth` through the current month — powers the
// report page's trend chart. Same month scoping as getMonthlyCampaignRows:
// hand-backfilled months come from funnel_monthly_totals, every later month is
// the sum of its own funnel_daily_history days.
export async function getPortfolioMonthlySeries(sinceYear: number, sinceMonth: number): Promise<PortfolioMonthPoint[]> {
  const supabase = getClient();
  if (!supabase) return [];

  const byMonth = new Map<string, { year: number; month: number; spend: number; leads: number }>();
  const add = (year: number, month: number, spend: number, leads: number) => {
    const key = `${year}-${month}`;
    const acc = byMonth.get(key) ?? { year, month, spend: 0, leads: 0 };
    acc.spend += spend;
    acc.leads += leads;
    byMonth.set(key, acc);
  };

  if (isManualBackfillMonth(sinceYear, sinceMonth)) {
    const { data, error } = await supabase
      .from("funnel_monthly_totals")
      .select("year, month, spend, leads")
      .or(`year.gt.${sinceYear},and(year.eq.${sinceYear},month.gte.${sinceMonth})`);
    if (error) return [];
    for (const r of data ?? []) {
      if (isManualBackfillMonth(r.year, r.month)) add(r.year, r.month, Number(r.spend ?? 0), Number(r.leads ?? 0));
    }
  }

  const firstDaily = isManualBackfillMonth(sinceYear, sinceMonth)
    ? shiftMonth(MANUAL_BACKFILL_UNTIL.year, MANUAL_BACKFILL_UNTIL.month, 1)
    : { year: sinceYear, month: sinceMonth };
  const dailyRows = await fetchDailyRange(supabase, monthBounds(firstDaily.year, firstDaily.month).start, null);
  if (!dailyRows) return [];
  for (const r of dailyRows) {
    const [y, m] = String(r.date).split("-").map(Number);
    add(y, m, Number(r.spend ?? 0), Number(r.leads ?? 0));
  }

  return Array.from(byMonth.values())
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
    .map((p) => ({ ...p, cpl: p.leads > 0 ? p.spend / p.leads : null }));
}

export interface CampaignComparisonRow {
  campaign_id: string;
  campaign_name: string;
  property: string;
  ref: string;
  campaign_type: string;
  status: string;
  spend: number;
  leads: number | null;
  cpl: number | null;
  deltaSpendPct: number | null;
  deltaLeadsPct: number | null;
  deltaCplPct: number | null;
}

// Per-campaign totals for the given month, each with a MoM delta vs the
// previous calendar month. A campaign with no previous-month row (newly
// launched, or simply didn't run that month) gets `null` deltas rather than a
// fabricated 0%/±100%.
export async function getCampaignComparisonRows(year: number, month: number): Promise<{ connected: boolean; rows: CampaignComparisonRow[] }> {
  const cur = monthBounds(year, month);
  const prev = shiftMonth(year, month, -1);
  const prevBounds = monthBounds(prev.year, prev.month);

  const [current, previous] = await Promise.all([
    getMonthlyCampaignRows(year, month, cur.start, cur.end),
    getMonthlyCampaignRows(prev.year, prev.month, prevBounds.start, prevBounds.end),
  ]);
  if (!current.connected) return { connected: false, rows: [] };

  const prevById = new Map(previous.rows.map((r) => [r.campaign_id, r]));
  const rows: CampaignComparisonRow[] = current.rows.map((r) => {
    const p = prevById.get(r.campaign_id);
    return {
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      property: r.property,
      ref: r.ref,
      campaign_type: r.campaign_type,
      status: r.status,
      spend: r.spend,
      leads: r.leads,
      cpl: r.cpl,
      deltaSpendPct: p ? pctDelta(r.spend, p.spend) : null,
      deltaLeadsPct: p && r.leads !== null && p.leads !== null ? pctDelta(r.leads, p.leads) : null,
      deltaCplPct: p && r.cpl !== null && p.cpl !== null ? pctDelta(r.cpl, p.cpl) : null,
    };
  });
  return { connected: true, rows };
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
    .select("campaign_id, date, spend, leads, cpl, impressions, clicks, link_clicks, ctr, reach")
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
      reach: Number(r.reach ?? 0),
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

// Per-campaign LIFETIME totals from HISTORY_START onward — backs the
// Portfolio Leaderboard and Mission Control's Inactive Campaigns section, the
// single source of truth for any campaign not currently ACTIVE (the old
// hand-curated `historical:campaigns` KV pool was retired — it drifted out of
// sync with this store with nothing keeping the two in step).
//
// A campaign's latest funnel_monthly_totals row written by the sync (any
// month after MANUAL_BACKFILL_UNTIL) already IS its lifetime total — Meta's
// lifetime aggregate + Typeform's all-time completions as of that sync — so
// it's taken once, never added to the campaign's earlier rows (summing them
// counted a two-month campaign's first month twice). Only campaigns with no
// such row fall back to summing their hand-backfilled monthly rows plus
// funnel_daily_history for months those don't cover. A campaign with no
// verified/derived leads at all is excluded entirely (same "leads must be
// real, never guessed" rule as everywhere else in this file).
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
  const dailyRows = await fetchDailyRange(supabase, sinceDate, null);
  if (!dailyRows) return { connected: false, rows: [] };

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

  // Latest sync-written (lifetime) row per campaign.
  const lifetimeRow = new Map<string, { year: number; month: number }>();
  for (const r of monthlyRows ?? []) {
    if (isManualBackfillMonth(r.year, r.month)) continue;
    const cur = lifetimeRow.get(r.campaign_id);
    if (!cur || r.year > cur.year || (r.year === cur.year && r.month > cur.month)) lifetimeRow.set(r.campaign_id, r);
  }
  const ymOf = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

  const coveredMonthly = new Set<string>();
  for (const r of monthlyRows ?? []) {
    coveredMonthly.add(`${r.campaign_id}:${ymOf(r.year, r.month)}`);
    const lifetime = lifetimeRow.get(r.campaign_id);
    if (lifetime && lifetime !== r) continue; // already inside the lifetime row
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
  for (const r of dailyRows) {
    const ym = String(r.date).slice(0, 7);
    const key = `${r.campaign_id}:${ym}`;
    // A lifetime row covers every month up to and including its own.
    const lifetime = lifetimeRow.get(r.campaign_id);
    const covered = lifetime ? ym <= ymOf(lifetime.year, lifetime.month) : coveredMonthly.has(key);
    if (!covered) {
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

// ================================================================
// Campaign detail snapshots — platform/device split, Typeform field
// drop-off, individual lead responses, landing engagement. See
// db/migrations/007_campaign_detail_snapshots.sql for why these exist: none
// of this ever survived a campaign rotating out of lib/config.ts before now,
// since it only ever lived in the live KV funnel:merged blob. Written
// continuously by /api/history/sync while a campaign is live (upsert on
// every load, same pattern as everything else in this file), plus backfilled
// once for campaigns already archived before this migration existed.
// ================================================================

export interface PlatformDeviceRow {
  campaign_id: string;
  year: number;
  month: number;
  dimension: "platform" | "device";
  key: string;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
  outbound_ctr: number;
}

export function platformDeviceRowsFromCampaigns(campaigns: FunnelCampaign[], year: number, month: number): PlatformDeviceRow[] {
  const rows: PlatformDeviceRow[] = [];
  for (const c of campaigns) {
    for (const p of c.meta.by_platform) {
      if (!p.platform) continue;
      rows.push({
        campaign_id: c.campaign_id, year, month, dimension: "platform", key: p.platform,
        spend: p.spend, impressions: p.impressions, clicks: p.clicks, link_clicks: p.link_clicks,
        ctr: p.ctr, outbound_ctr: p.outbound_ctr,
      });
    }
    for (const d of c.meta.by_device) {
      if (!d.device) continue;
      rows.push({
        campaign_id: c.campaign_id, year, month, dimension: "device", key: d.device,
        spend: d.spend, impressions: d.impressions, clicks: d.clicks, link_clicks: d.link_clicks,
        ctr: d.ctr, outbound_ctr: d.outbound_ctr,
      });
    }
  }
  return rows;
}

// Same row shape as platformDeviceRowsFromCampaigns, but built directly from
// raw MetaBreakdownRow arrays instead of a full FunnelCampaign — used by the
// one-off recovery route (POST /api/history/backfill-meta-breakdown), which
// gets its data from a Graph API call for a single archived campaign ID, not
// from getFunnelData()'s live-roster-scoped snapshot.
export function platformDeviceRowsFromBreakdown(
  campaignId: string, year: number, month: number,
  byPlatform: MetaBreakdownRow[], byDevice: MetaBreakdownRow[]
): PlatformDeviceRow[] {
  const rows: PlatformDeviceRow[] = [];
  for (const p of byPlatform) {
    if (!p.platform) continue;
    rows.push({ campaign_id: campaignId, year, month, dimension: "platform", key: p.platform, spend: p.spend, impressions: p.impressions, clicks: p.clicks, link_clicks: p.link_clicks, ctr: p.ctr, outbound_ctr: p.outbound_ctr });
  }
  for (const d of byDevice) {
    if (!d.device) continue;
    rows.push({ campaign_id: campaignId, year, month, dimension: "device", key: d.device, spend: d.spend, impressions: d.impressions, clicks: d.clicks, link_clicks: d.link_clicks, ctr: d.ctr, outbound_ctr: d.outbound_ctr });
  }
  return rows;
}

export async function upsertPlatformDeviceSnapshots(rows: PlatformDeviceRow[]): Promise<{ ok: boolean; written: number; error?: string }> {
  const supabase = getClient();
  if (!supabase) return { ok: false, written: 0, error: "Supabase not configured" };
  if (rows.length === 0) return { ok: true, written: 0 };
  const { error } = await supabase.from("funnel_platform_device_snapshots").upsert(rows, { onConflict: "campaign_id,year,month,dimension,key" });
  if (error) return { ok: false, written: 0, error: error.message };
  return { ok: true, written: rows.length };
}

export interface PlatformDeviceSnapshotRow {
  dimension: "platform" | "device";
  key: string;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
  outbound_ctr: number;
}

// Snapshot for a campaign — either the *latest known* row (no `ym` given,
// Meta's breakdown figures are lifetime-to-date so the most recently synced
// row is the freshest total, same convention as getLatestMonthWithData) or
// the specific (year, month) row when `ym` is given, so a closed past month
// can show its own real detail instead of a later month's numbers.
export async function getPlatformDeviceSnapshot(campaignId: string, ym?: { year: number; month: number }): Promise<PlatformDeviceSnapshotRow[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("funnel_platform_device_snapshots")
    .select("year, month, dimension, key, spend, impressions, clicks, link_clicks, ctr, outbound_ctr")
    .eq("campaign_id", campaignId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error || !data || data.length === 0) return [];
  const targetYm = ym ? `${ym.year}-${ym.month}` : `${data[0].year}-${data[0].month}`;
  return data
    .filter((r) => `${r.year}-${r.month}` === targetYm)
    .map((r) => ({
      dimension: r.dimension,
      key: r.key,
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      link_clicks: Number(r.link_clicks ?? 0),
      ctr: Number(r.ctr ?? 0),
      outbound_ctr: Number(r.outbound_ctr ?? 0),
    }));
}

interface TypeformFieldRow {
  campaign_id: string;
  year: number;
  month: number;
  field_index: number;
  label: string;
  views: number;
  dropoffs: number;
  dropoff_rate: number;
}

export function typeformFieldRowsFromCampaigns(campaigns: FunnelCampaign[], year: number, month: number): TypeformFieldRow[] {
  const rows: TypeformFieldRow[] = [];
  for (const c of campaigns) {
    c.typeform.fields.forEach((f, i) => {
      rows.push({ campaign_id: c.campaign_id, year, month, field_index: i, label: f.label, views: f.views, dropoffs: f.dropoffs, dropoff_rate: f.dropoff_rate });
    });
  }
  return rows;
}

export async function upsertTypeformFieldSnapshots(rows: TypeformFieldRow[]): Promise<{ ok: boolean; written: number; error?: string }> {
  const supabase = getClient();
  if (!supabase) return { ok: false, written: 0, error: "Supabase not configured" };
  if (rows.length === 0) return { ok: true, written: 0 };
  const { error } = await supabase.from("funnel_typeform_field_snapshots").upsert(rows, { onConflict: "campaign_id,year,month,field_index" });
  if (error) return { ok: false, written: 0, error: error.message };
  return { ok: true, written: rows.length };
}

export interface TypeformFieldSnapshotRow {
  label: string;
  views: number;
  dropoffs: number;
  dropoff_rate: number;
}

export async function getTypeformFieldSnapshot(campaignId: string, ym?: { year: number; month: number }): Promise<TypeformFieldSnapshotRow[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("funnel_typeform_field_snapshots")
    .select("year, month, field_index, label, views, dropoffs, dropoff_rate")
    .eq("campaign_id", campaignId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error || !data || data.length === 0) return [];
  const targetYm = ym ? `${ym.year}-${ym.month}` : `${data[0].year}-${data[0].month}`;
  return data
    .filter((r) => `${r.year}-${r.month}` === targetYm)
    .sort((a, b) => a.field_index - b.field_index)
    .map((r) => ({ label: r.label, views: Number(r.views ?? 0), dropoffs: Number(r.dropoffs ?? 0), dropoff_rate: Number(r.dropoff_rate ?? 0) }));
}

interface LeadResponseRow {
  response_id: string;
  campaign_id: string;
  submitted_at: string | null;
  first_name: string;
  last_name: string;
  language: string;
  budget: string;
  stage: string;
  buying_timeline: string;
}

// Deliberately drops `tag` — manual lead-quality tags live in KV leads:tags,
// keyed globally by response_id (see lib/kv.ts), so they already survive a
// campaign's archival on their own and are joined in at read time instead.
export function leadResponseRowsFromLeads(leads: LeadRecord[]): LeadResponseRow[] {
  return leads.map((l) => ({
    response_id: l.response_id,
    campaign_id: l.campaign_id,
    submitted_at: l.submitted_at,
    first_name: l.first_name,
    last_name: l.last_name,
    language: l.language,
    budget: l.budget,
    stage: l.stage,
    buying_timeline: l.buying_timeline,
  }));
}

export async function upsertLeadResponses(rows: LeadResponseRow[]): Promise<{ ok: boolean; written: number; error?: string }> {
  const supabase = getClient();
  if (!supabase) return { ok: false, written: 0, error: "Supabase not configured" };
  if (rows.length === 0) return { ok: true, written: 0 };
  const { error } = await supabase.from("funnel_lead_responses").upsert(rows, { onConflict: "response_id" });
  if (error) return { ok: false, written: 0, error: error.message };
  return { ok: true, written: rows.length };
}

export interface LeadResponseSnapshotRow {
  response_id: string;
  submitted_at: string | null;
  first_name: string;
  last_name: string;
  language: string;
  budget: string;
  stage: string;
  buying_timeline: string;
}

export async function getLeadResponsesForCampaign(campaignId: string): Promise<LeadResponseSnapshotRow[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("funnel_lead_responses")
    .select("response_id, submitted_at, first_name, last_name, language, budget, stage, buying_timeline")
    .eq("campaign_id", campaignId);
  if (error || !data) return [];
  return data;
}

export interface LeadResponseCampaignRow {
  response_id: string;
  campaign_id: string;
}

// Every response_id -> campaign_id this store has ever seen, durable across a
// campaign's later pause/archival (unlike KV leads:all, which is a full
// replace scoped to currently-active campaigns only — see lib/kv.ts). This is
// the correct join key for anything that needs to attribute a lead to a
// campaign after the fact, e.g. CRM lead-outcomes (/api/crm/outcomes).
export async function getAllLeadResponseCampaigns(): Promise<LeadResponseCampaignRow[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("funnel_lead_responses").select("response_id, campaign_id");
  if (error || !data) return [];
  return data;
}

interface LandingEngagementRow {
  campaign_id: string;
  year: number;
  month: number;
  page_views: number;
  cta_clicks: number;
  cta_click_rate: number;
  steps: FunnelCampaign["landing_engagement"]["steps"];
  events: FunnelCampaign["landing_engagement"]["events"];
}

export function landingEngagementRowsFromCampaigns(campaigns: FunnelCampaign[], year: number, month: number): LandingEngagementRow[] {
  return campaigns
    .filter((c) => c.landing_engagement.page_views > 0)
    .map((c) => ({
      campaign_id: c.campaign_id, year, month,
      page_views: c.landing_engagement.page_views,
      cta_clicks: c.landing_engagement.cta_clicks,
      cta_click_rate: c.landing_engagement.cta_click_rate,
      steps: c.landing_engagement.steps,
      events: c.landing_engagement.events,
    }));
}

export async function upsertLandingEngagementSnapshots(rows: LandingEngagementRow[]): Promise<{ ok: boolean; written: number; error?: string }> {
  const supabase = getClient();
  if (!supabase) return { ok: false, written: 0, error: "Supabase not configured" };
  if (rows.length === 0) return { ok: true, written: 0 };
  const { error } = await supabase.from("funnel_landing_engagement_snapshots").upsert(rows, { onConflict: "campaign_id,year,month" });
  if (error) return { ok: false, written: 0, error: error.message };
  return { ok: true, written: rows.length };
}

export interface LandingEngagementSnapshotRow {
  page_views: number;
  cta_clicks: number;
  cta_click_rate: number;
  steps: FunnelCampaign["landing_engagement"]["steps"];
  events: FunnelCampaign["landing_engagement"]["events"];
}

export async function getLandingEngagementSnapshot(campaignId: string, ym?: { year: number; month: number }): Promise<LandingEngagementSnapshotRow | null> {
  const supabase = getClient();
  if (!supabase) return null;
  let query = supabase
    .from("funnel_landing_engagement_snapshots")
    .select("year, month, page_views, cta_clicks, cta_click_rate, steps, events")
    .eq("campaign_id", campaignId);
  if (ym) query = query.eq("year", ym.year).eq("month", ym.month);
  else query = query.order("year", { ascending: false }).order("month", { ascending: false });
  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data) return null;
  return {
    page_views: Number(data.page_views ?? 0),
    cta_clicks: Number(data.cta_clicks ?? 0),
    cta_click_rate: Number(data.cta_click_rate ?? 0),
    steps: data.steps,
    events: data.events,
  };
}
