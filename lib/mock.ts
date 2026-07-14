// ============================================================================
// MOCK DATA — every export in this file is placeholder content for UI surfaces
// whose backend phases (see ARCHITECTURE.md) are not built yet. Swap each
// export for a real KV-backed API read as its phase ships:
//   MOCK_INSIGHTS   -> insights:feed        (Phase 3)
//   MOCK_QUALITY    -> leads:{campaign_id}  (Phase 2)
//   MOCK_DEMAND     -> demand:map           (Phase 5)
//   MOCK_DNA        -> creative:dna         (Phase 7)
// Real data (funnel, campaigns, compare, daily series) never comes from here.
// ============================================================================

export type Severity = "critical" | "warning" | "opportunity" | "info";

export interface Insight {
  id: string;
  severity: Severity;
  type: string;
  campaign: string;
  title: string;
  evidence: string;
  recommendation: string;
  detected_at: string;
  trend: number[]; // small evidence sparkline
}

export const MOCK_INSIGHTS: Insight[] = [
  {
    id: "i1",
    severity: "critical",
    type: "Tracking",
    campaign: "Anchorage Club",
    title: "Zero-lead day while spending",
    evidence: "€41.20 spent on Jul 12 with 61 link clicks but 0 form submissions — 3.2σ below the campaign's daily baseline.",
    recommendation: "Verify the landing page CTA and Typeform embed. If the form loads, check fbclid forwarding on the CTA URL.",
    detected_at: "2026-07-13T07:00:00Z",
    trend: [6, 8, 7, 9, 5, 0, 7],
  },
  {
    id: "i2",
    severity: "warning",
    type: "Creative fatigue",
    campaign: "Anchorage Club",
    title: "Hero image ad is fatiguing",
    evidence: "CTR down 31% over 7 days while frequency climbed from 1.8 to 3.1 and CPM rose 22% — the classic three-signal fatigue pattern.",
    recommendation: "Rotate in a fresh visual this week. Winner curves suggest fatigue at this stage costs ~4 quality leads per week.",
    detected_at: "2026-07-13T07:00:00Z",
    trend: [8.2, 7.9, 7.1, 6.4, 6.6, 5.9, 5.6],
  },
  {
    id: "i3",
    severity: "opportunity",
    type: "Budget pacing",
    campaign: "Anchorage Club",
    title: "Marginal CPQL⁺ supports +€10/day",
    evidence: "Trailing-7-day cost per quality lead is €7.40 vs €13.10 portfolio average, with stable frequency (1.9) — headroom before saturation.",
    recommendation: "Increase daily budget by €10. Projected +6 quality leads/month at current conversion.",
    detected_at: "2026-07-12T07:00:00Z",
    trend: [11, 10, 9.4, 8.8, 8.1, 7.7, 7.4],
  },
  {
    id: "i4",
    severity: "opportunity",
    type: "Lifecycle",
    campaign: "Anchorage Club",
    title: "Ahead of the winner curve",
    evidence: "Day 8: 55 leads vs 41 for the median top-3 community campaign at day 8 (+34%). Velocity trend still positive.",
    recommendation: "Hold strategy. Bank this creative set in the DNA library as a community-campaign reference.",
    detected_at: "2026-07-12T07:00:00Z",
    trend: [10, 18, 26, 33, 40, 48, 55],
  },
  {
    id: "i5",
    severity: "info",
    type: "Audience",
    campaign: "Anchorage Club",
    title: "Instagram placement outperforming",
    evidence: "IG feed delivers 71% of quality leads at 0.8× the CPM of Facebook placements this week.",
    recommendation: "No action — Advantage+ is already shifting delivery. Watch that FB share keeps falling.",
    detected_at: "2026-07-11T07:00:00Z",
    trend: [52, 55, 61, 64, 68, 70, 71],
  },
  {
    id: "i6",
    severity: "warning",
    type: "Form drop-off",
    campaign: "Anchorage Club",
    title: "Budget question sheds 24% of starters",
    evidence: "The budget-range step lost 30 of 126 starters this period — 1.7× the historical drop for that step across community forms.",
    recommendation: "Test moving the budget question one step later, after community interest is established.",
    detected_at: "2026-07-10T07:00:00Z",
    trend: [14, 15, 18, 19, 22, 23, 24],
  },
];

export interface QualityBand {
  hot: number; // score >= 75
  warm: number; // 45–74
  cold: number; // < 45
  avgScore: number;
  cpqlPlus: number; // cost per quality-weighted lead
}

// keyed by campaign_id; UI falls back to DEFAULT for unknown ids
export const MOCK_QUALITY: Record<string, QualityBand> = {
  "120250284542490071": { hot: 14, warm: 26, cold: 17, avgScore: 58, cpqlPlus: 9.2 },
  DEFAULT: { hot: 6, warm: 12, cold: 9, avgScore: 52, cpqlPlus: 14.6 },
};

export interface DemandCell {
  area: string;
  band: string;
  count: number;
}

export const DEMAND_AREAS = [
  "Palma Old Town",
  "Son Vida",
  "Portals Nous",
  "Santa Ponsa",
  "Andratx",
  "Deià / West",
  "Pollença / North",
  "Santanyí / South East",
];
export const DEMAND_BANDS = ["< €1M", "€1–3M", "€3–5M", "€5M+"];

export const MOCK_DEMAND: DemandCell[] = [
  { area: "Palma Old Town", band: "< €1M", count: 9 },
  { area: "Palma Old Town", band: "€1–3M", count: 21 },
  { area: "Palma Old Town", band: "€3–5M", count: 7 },
  { area: "Palma Old Town", band: "€5M+", count: 2 },
  { area: "Son Vida", band: "< €1M", count: 1 },
  { area: "Son Vida", band: "€1–3M", count: 6 },
  { area: "Son Vida", band: "€3–5M", count: 14 },
  { area: "Son Vida", band: "€5M+", count: 11 },
  { area: "Portals Nous", band: "< €1M", count: 3 },
  { area: "Portals Nous", band: "€1–3M", count: 17 },
  { area: "Portals Nous", band: "€3–5M", count: 12 },
  { area: "Portals Nous", band: "€5M+", count: 6 },
  { area: "Santa Ponsa", band: "< €1M", count: 8 },
  { area: "Santa Ponsa", band: "€1–3M", count: 15 },
  { area: "Santa Ponsa", band: "€3–5M", count: 5 },
  { area: "Santa Ponsa", band: "€5M+", count: 1 },
  { area: "Andratx", band: "< €1M", count: 2 },
  { area: "Andratx", band: "€1–3M", count: 9 },
  { area: "Andratx", band: "€3–5M", count: 10 },
  { area: "Andratx", band: "€5M+", count: 7 },
  { area: "Deià / West", band: "< €1M", count: 1 },
  { area: "Deià / West", band: "€1–3M", count: 5 },
  { area: "Deià / West", band: "€3–5M", count: 6 },
  { area: "Deià / West", band: "€5M+", count: 4 },
  { area: "Pollença / North", band: "< €1M", count: 4 },
  { area: "Pollença / North", band: "€1–3M", count: 11 },
  { area: "Pollença / North", band: "€3–5M", count: 4 },
  { area: "Pollença / North", band: "€5M+", count: 2 },
  { area: "Santanyí / South East", band: "< €1M", count: 6 },
  { area: "Santanyí / South East", band: "€1–3M", count: 10 },
  { area: "Santanyí / South East", band: "€3–5M", count: 3 },
  { area: "Santanyí / South East", band: "€5M+", count: 1 },
];

export const MOCK_DEMAND_FEATURES = [
  { label: "Sea view", pct: 64 },
  { label: "Pool", pct: 58 },
  { label: "Modern / renovated", pct: 41 },
  { label: "Gated community", pct: 33 },
  { label: "Guest house", pct: 21 },
  { label: "Walking distance to town", pct: 19 },
];

export const MOCK_DEMAND_TIMELINE = [
  { label: "ASAP", pct: 18 },
  { label: "< 6 months", pct: 34 },
  { label: "6–12 months", pct: 29 },
  { label: "Browsing", pct: 19 },
];

export interface DnaTag {
  tag: string;
  group: "Format" | "Hook" | "Language";
  qlsX: number; // quality-lead multiplier vs group median
  cpl: number;
  sample: number; // number of ads
}

export const MOCK_DNA: DnaTag[] = [
  { tag: "Video · pool-first opening", group: "Format", qlsX: 2.1, cpl: 6.8, sample: 7 },
  { tag: "Video · interior-first", group: "Format", qlsX: 0.9, cpl: 13.4, sample: 5 },
  { tag: "Single image · exterior", group: "Format", qlsX: 1.2, cpl: 10.1, sample: 9 },
  { tag: "Carousel · room tour", group: "Format", qlsX: 0.7, cpl: 16.9, sample: 4 },
  { tag: "Price anchor in first line", group: "Hook", qlsX: 1.6, cpl: 8.2, sample: 6 },
  { tag: "Lifestyle question hook", group: "Hook", qlsX: 1.1, cpl: 11.3, sample: 8 },
  { tag: "Scarcity ('last units')", group: "Hook", qlsX: 0.8, cpl: 14.8, sample: 3 },
  { tag: "English", group: "Language", qlsX: 1.3, cpl: 9.6, sample: 12 },
  { tag: "German", group: "Language", qlsX: 1.0, cpl: 12.2, sample: 6 },
];
