// Aggregation + normalization helpers for the Meta Ads Monthly Report's
// per-campaign deep-dive section (app/report/page.tsx). Pure functions only —
// no fetching here. Two data sources feed the same shapes: a live
// FunnelCampaign (still in lib/config.ts's roster) or the Supabase snapshot
// tables (db/migrations/007) for a campaign already rotated out — see
// GET /api/history/campaign-detail-snapshot. Only meaningful for the current,
// still-live month: the snapshot getters return each campaign's *latest
// known* row, not a true month-by-month series, so this deep detail is
// rendered only when the report's selected month is the live one (see
// app/report/page.tsx's isCurrentLiveMonth gate) — a past month keeps the
// lighter spend/leads/CPL comparison view instead of misattributing "latest"
// detail to a month it may not belong to.
import { FunnelCampaign, MetaBreakdownRow, LeadTag, ClarityMetrics } from "@/lib/types";
import { PlatformDeviceSnapshotRow, TypeformFieldSnapshotRow, LandingEngagementSnapshotRow, LeadResponseSnapshotRow } from "@/lib/history/db";

// ---- Typeform answer patterns (budget / timeline / search stage / language) ----

export interface AnswerBucket {
  label: string;
  count: number;
  pct: number; // 0..1 of respondents who answered this question
}

export interface CampaignAnswerPatterns {
  respondents: number;
  budget: AnswerBucket[];
  timeline: AnswerBucket[];
  stage: AnswerBucket[];
  language: AnswerBucket[];
}

function aggregateAnswers(values: (string | null | undefined)[]): AnswerBucket[] {
  const counts = new Map<string, number>();
  let respondents = 0;
  for (const v of values) {
    const label = (v ?? "").trim();
    if (!label) continue;
    respondents++;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, pct: respondents > 0 ? count / respondents : 0 }))
    .sort((a, b) => b.count - a.count);
}

export interface AnswerLeadLike {
  budget: string;
  buying_timeline: string;
  stage: string;
  language: string;
}

export function buildAnswerPatterns(leads: AnswerLeadLike[]): CampaignAnswerPatterns {
  return {
    respondents: leads.length,
    budget: aggregateAnswers(leads.map((l) => l.budget)),
    timeline: aggregateAnswers(leads.map((l) => l.buying_timeline)),
    stage: aggregateAnswers(leads.map((l) => l.stage)),
    language: aggregateAnswers(leads.map((l) => l.language)),
  };
}

// Re-sums per-campaign bucket counts into one portfolio-wide distribution —
// valid because AnswerBucket.count is additive; percentages are recomputed
// against the combined respondent total, not averaged.
export function mergeAnswerPatterns(list: CampaignAnswerPatterns[]): CampaignAnswerPatterns {
  const merge = (key: "budget" | "timeline" | "stage" | "language"): AnswerBucket[] => {
    const counts = new Map<string, number>();
    for (const p of list) for (const b of p[key]) counts.set(b.label, (counts.get(b.label) ?? 0) + b.count);
    const respondents = [...counts.values()].reduce((s, n) => s + n, 0);
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count, pct: respondents > 0 ? count / respondents : 0 }))
      .sort((a, b) => b.count - a.count);
  };
  return {
    respondents: list.reduce((s, p) => s + p.respondents, 0),
    budget: merge("budget"),
    timeline: merge("timeline"),
    stage: merge("stage"),
    language: merge("language"),
  };
}

// ---- platform/device delivery breakdown, normalized from either source ----

export interface BreakdownRow {
  key: string;
  spend: number;
  impressions: number;
  link_clicks: number;
  ctr: number; // 0..1, always link_clicks/impressions so summed rows stay correct
}

function withCtr(rows: Omit<BreakdownRow, "ctr">[]): BreakdownRow[] {
  return rows
    .map((r) => ({ ...r, ctr: r.impressions > 0 ? r.link_clicks / r.impressions : 0 }))
    .sort((a, b) => b.spend - a.spend);
}

export function breakdownFromLive(rows: MetaBreakdownRow[], dim: "platform" | "device"): BreakdownRow[] {
  return withCtr(
    rows.map((r) => ({
      key: (dim === "platform" ? r.platform : r.device) || "Unknown",
      spend: r.spend,
      impressions: r.impressions,
      link_clicks: r.link_clicks,
    }))
  );
}

export function breakdownFromSnapshot(rows: PlatformDeviceSnapshotRow[], dim: "platform" | "device"): BreakdownRow[] {
  return withCtr(
    rows.filter((r) => r.dimension === dim).map((r) => ({ key: r.key, spend: r.spend, impressions: r.impressions, link_clicks: r.link_clicks }))
  );
}

// Portfolio-wide sum across every campaign's own breakdown rows, keyed by
// platform/device name.
export function sumBreakdowns(all: BreakdownRow[][]): BreakdownRow[] {
  const m = new Map<string, { spend: number; impressions: number; link_clicks: number }>();
  for (const rows of all) {
    for (const r of rows) {
      const cur = m.get(r.key) ?? { spend: 0, impressions: 0, link_clicks: 0 };
      cur.spend += r.spend;
      cur.impressions += r.impressions;
      cur.link_clicks += r.link_clicks;
      m.set(r.key, cur);
    }
  }
  return withCtr([...m.entries()].map(([key, v]) => ({ key, ...v })));
}

// ---- per-campaign bundle ----

export interface ReportFunnelSteps {
  views: number;
  starts: number;
  completions: number;
}

export interface ReportCampaignDetail {
  source: "live" | "snapshot";
  ctr: number | null;
  cpm: number | null;
  byPlatform: BreakdownRow[];
  byDevice: BreakdownRow[];
  funnel: ReportFunnelSteps | null;
  typeformFields: { label: string; views: number; dropoffs: number; dropoff_rate: number }[];
  landing: { page_views: number; cta_clicks: number; cta_click_rate: number } | null;
  landingUnavailable: boolean;
  clarity: ClarityMetrics | null;
  answers: CampaignAnswerPatterns;
  tags: LeadTag[];
}

export function buildLiveCampaignDetail(c: FunnelCampaign, monthLeads: { budget: string; buying_timeline: string; stage: string; language: string; tag: LeadTag }[]): ReportCampaignDetail {
  return {
    source: "live",
    ctr: c.meta.ctr,
    cpm: c.meta.cpm,
    byPlatform: breakdownFromLive(c.meta.by_platform, "platform"),
    byDevice: breakdownFromLive(c.meta.by_device, "device"),
    funnel: { views: c.typeform.views, starts: c.typeform.starts, completions: c.typeform.completions },
    typeformFields: c.typeform.fields,
    landing:
      c.landing_engagement.page_views > 0
        ? { page_views: c.landing_engagement.page_views, cta_clicks: c.landing_engagement.cta_clicks, cta_click_rate: c.landing_engagement.cta_click_rate }
        : null,
    landingUnavailable: c.landing_engagement.page_views === 0,
    clarity: c.clarity.sessions > 0 ? c.clarity : null,
    answers: buildAnswerPatterns(monthLeads),
    tags: monthLeads.map((l) => l.tag),
  };
}

export interface CampaignSnapshotPayload {
  connected: boolean;
  platformDevice: PlatformDeviceSnapshotRow[];
  typeformFields: TypeformFieldSnapshotRow[];
  leads: (LeadResponseSnapshotRow & { tag: LeadTag })[];
  landingEngagement: LandingEngagementSnapshotRow | null;
}

// `monthStart`/`monthEnd` are YYYY-MM-DD — leads are filtered to submissions
// within the selected month (funnel_lead_responses keeps every response a
// campaign has ever had, not just this month's).
export function buildSnapshotCampaignDetail(snap: CampaignSnapshotPayload, spend: number, monthStart: string, monthEnd: string): ReportCampaignDetail {
  const byPlatform = breakdownFromSnapshot(snap.platformDevice, "platform");
  const byDevice = breakdownFromSnapshot(snap.platformDevice, "device");
  const totalImpressions = byPlatform.reduce((s, r) => s + r.impressions, 0);
  const totalLinkClicks = byPlatform.reduce((s, r) => s + r.link_clicks, 0);
  const monthLeads = snap.leads.filter((l) => l.submitted_at && l.submitted_at.slice(0, 10) >= monthStart && l.submitted_at.slice(0, 10) <= monthEnd);
  // Typeform's own quirk (every view counts as a "start") means the field
  // with the most views is effectively the form-level view/start count —
  // there's no separate form-level total in the snapshot table.
  const views = snap.typeformFields.length ? Math.max(...snap.typeformFields.map((f) => f.views)) : 0;
  return {
    source: "snapshot",
    ctr: totalImpressions > 0 ? totalLinkClicks / totalImpressions : null,
    cpm: totalImpressions > 0 ? (spend / totalImpressions) * 1000 : null,
    byPlatform,
    byDevice,
    funnel: snap.typeformFields.length ? { views, starts: views, completions: monthLeads.length } : null,
    typeformFields: snap.typeformFields,
    landing:
      snap.landingEngagement && snap.landingEngagement.page_views > 0
        ? { page_views: snap.landingEngagement.page_views, cta_clicks: snap.landingEngagement.cta_clicks, cta_click_rate: snap.landingEngagement.cta_click_rate }
        : null,
    landingUnavailable: !snap.landingEngagement || snap.landingEngagement.page_views === 0,
    clarity: null, // no historical Clarity store — see CONTEXT.md/CLAUDE.md
    answers: buildAnswerPatterns(monthLeads),
    tags: monthLeads.map((l) => l.tag),
  };
}
