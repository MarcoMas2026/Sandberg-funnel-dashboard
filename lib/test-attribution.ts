import type { FunnelCampaign, MetaDailyRow } from "@/lib/types";
import { LIVE_BASELINES } from "@/lib/live-grid-baselines";
import { LIVE_BASELINE_DAILY } from "@/lib/live-grid-baselines-daily";
import type { DailyRow } from "@/lib/history/db";

// The "SP (3-5M) - September" test ran 4 ads (one per property) in ONE ad set, so history and the
// pipeline booked all of it under a single campaign. Each ad now has its own dedicated campaign.
// These helpers move the test's results onto the four properties for DISPLAY — Mission Control,
// the report and the Live Grid. Stored history (Supabase) and funnel:merged are never rewritten,
// so re-running this is safe and the portfolio totals stay identical (rows are moved, not added).

export const TEST_CAMPAIGN_ID = "120252025940010071";

interface Target {
  campaign_id: string;
  campaign_name: string;
  property: string;
  ref: string;
}
const TARGETS: Target[] = [
  { campaign_id: "120252112711310071", campaign_name: "SP - 32396 - Finca Sa Calma", property: "Finca Sa Calma", ref: "32396" },
  { campaign_id: "120252112663380071", campaign_name: "SP - 32136 - Can Aura", property: "Can Aura", ref: "32136" },
  { campaign_id: "120252112579710071", campaign_name: "SP - 32825 - Penthouse Olinto", property: "Penthouse Olinto", ref: "32825" },
  { campaign_id: "120252107740730071", campaign_name: "SP - 32859 - Ses Salines", property: "Ses Salines", ref: "32859" },
];

const sumBy = (f: (t: Target) => number) => TARGETS.reduce((s, t) => s + f(t), 0);
const spendShare = (t: Target) => LIVE_BASELINES[t.ref].spend / sumBy((x) => LIVE_BASELINES[x.ref].spend);
const leadShare = (t: Target) => LIVE_BASELINES[t.ref].leads / sumBy((x) => LIVE_BASELINES[x.ref].leads);

interface HistoryRow {
  campaign_id: string;
  spend?: number;
  leads?: number | null;
  cpl?: number | null;
  property?: string;
  ref?: string;
  campaign_name?: string;
}

// Replaces the test campaign's row with one row per property. A target's own existing row is
// kept and topped up: spend adds (the new campaign's own spend is separate from the test's), but
// leads take the larger of the two, because a property's form total already includes the test's leads.
export function reassignTestRows<T extends HistoryRow>(rows: T[]): T[] {
  const test = rows.find((r) => r.campaign_id === TEST_CAMPAIGN_ID);
  if (!test) return rows;
  const rest = rows.filter((r) => r.campaign_id !== TEST_CAMPAIGN_ID);
  for (const t of TARGETS) {
    const spendPart = test.spend !== undefined ? (test.spend ?? 0) * spendShare(t) : undefined;
    const leadsPart = test.leads !== undefined && test.leads !== null ? Math.round(test.leads * leadShare(t)) : undefined;
    const existing = rest.find((r) => r.campaign_id === t.campaign_id);
    const spend = spendPart !== undefined ? (existing?.spend ?? 0) + spendPart : undefined;
    const leads = leadsPart !== undefined ? Math.max(existing?.leads ?? 0, leadsPart) : undefined;
    const cpl = spend !== undefined && leads !== undefined ? (leads > 0 ? spend / leads : test.cpl === null ? null : 0) : undefined;
    const merged = { ...test, ...existing, campaign_id: t.campaign_id, campaign_name: t.campaign_name, property: t.property, ref: t.ref } as T;
    if (spend !== undefined) merged.spend = spend;
    if (leads !== undefined) merged.leads = leads;
    if (cpl !== undefined) merged.cpl = cpl;
    // Deltas / trends belonged to the merged campaign and don't apply to a single property.
    for (const k of ["deltaSpendPct", "deltaLeadsPct", "deltaCplPct", "trend"]) {
      if (k in merged) (merged as Record<string, unknown>)[k] = k === "trend" ? [] : null;
    }
    if (existing) rest.splice(rest.indexOf(existing), 1, merged);
    else rest.push(merged);
  }
  return rest;
}

// Lifetime view of a live campaign (funnel:merged) with its share of the test added on top.
// Meta metrics add; Typeform numbers are form-lifetime (they already include the test), so they
// are only borrowed for a property whose new campaign isn't linked to a form yet.
export function applyBaselineToCampaign(c: FunnelCampaign): FunnelCampaign {
  const base = LIVE_BASELINES[c.ref];
  if (!base || c.variants?.length) return c;
  const m = c.meta;
  const impressions = m.impressions + base.impressions;
  const clicksAll = m.impressions * m.ctr + base.clicks;
  const unlinked = c.typeform.views === 0 && c.typeform.starts === 0 && c.typeform.completions === 0 && base.form;
  const typeform = unlinked
    ? { ...c.typeform, starts: base.form!.starts, views: base.form!.starts, completions: base.form!.completions, completion_rate: base.form!.starts > 0 ? base.form!.completions / base.form!.starts : 0 }
    : c.typeform;
  const spend = m.spend + base.spend;
  const startMs = [m.start_date, base.since].filter((d): d is string => Boolean(d)).map((d) => new Date(d).getTime());
  return {
    ...c,
    meta: {
      ...m,
      spend,
      impressions,
      link_clicks: m.link_clicks + base.linkClicks,
      video_plays: m.video_plays + base.videoPlays,
      engagement: m.engagement + base.engagement,
      ctr: impressions > 0 ? clicksAll / impressions : 0,
      cpl: typeform.completions > 0 ? spend / typeform.completions : 0,
      leads: typeform.completions,
      start_date: startMs.length ? new Date(Math.min(...startMs)).toISOString() : m.start_date,
      daily: mergeBaselineIntoMetaDaily(m.daily, c.ref),
    },
    typeform,
    // Pipeline-computed ratios must follow the adjusted totals.
    derived: {
      click_to_form_start_rate: m.link_clicks + base.linkClicks > 0 ? typeform.starts / (m.link_clicks + base.linkClicks) : 0,
      form_completion_rate: typeform.starts > 0 ? typeform.completions / typeform.starts : c.derived.form_completion_rate,
      cost_per_qualified_lead: typeform.completions > 0 ? spend / typeform.completions : 0,
    },
  };
}

// Adds the test's per-day results to a property's own daily rows: spend/impressions/clicks/reach add
// (the new campaign's traffic is separate from the test's), leads take the larger of the two per day
// (a form's daily count already includes test-era submissions, same rule as the lifetime totals).
function mergeDay<T extends { date: string; spend: number; impressions: number; clicks: number; link_clicks: number; reach: number; leads: number; ctr: number; cpl: number }>(
  rows: T[],
  ref: string,
  blank: (date: string) => T
): T[] {
  const byDate = new Map(rows.map((r) => [r.date, { ...r }]));
  for (const b of LIVE_BASELINE_DAILY[ref] ?? []) {
    const r = byDate.get(b.date) ?? blank(b.date);
    r.spend += b.spend;
    r.impressions += b.impressions;
    r.clicks += b.clicks;
    r.link_clicks += b.linkClicks;
    r.reach += b.reach;
    r.leads = Math.max(r.leads, b.leads);
    r.ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
    r.cpl = r.leads > 0 ? r.spend / r.leads : 0;
    byDate.set(b.date, r);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function mergeBaselineIntoMetaDaily(rows: MetaDailyRow[], ref: string): MetaDailyRow[] {
  return mergeDay(rows, ref, (date) => ({
    date, spend: 0, impressions: 0, clicks: 0, link_clicks: 0, leads: 0, video_plays: 0, engagement: 0, ctr: 0, outbound_ctr: 0, cpl: 0, reach: 0,
  }));
}

// Curve's daily series, keyed by campaign ID: only the four test properties are touched.
export function mergeBaselineIntoSeries(series: Record<string, DailyRow[]>): Record<string, DailyRow[]> {
  const out = { ...series };
  for (const t of TARGETS) {
    if (!(t.campaign_id in out)) continue;
    out[t.campaign_id] = mergeDay(out[t.campaign_id], t.ref, (date) => ({
      date, spend: 0, leads: 0, cpl: 0, impressions: 0, clicks: 0, link_clicks: 0, ctr: 0, reach: 0,
    }));
  }
  return out;
}
