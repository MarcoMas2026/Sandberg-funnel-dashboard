// ============================================================================
// MOCK DATA — every export in this file is placeholder content for UI surfaces
// whose backend phases (see ARCHITECTURE.md) are not built yet. Swap each
// export for a real KV-backed API read as its phase ships:
//   MOCK_QUALITY    -> leads:{campaign_id}  (Phase 2)
//   MOCK_DEMAND     -> demand:map           (Phase 5)
//   MOCK_DNA        -> creative:dna         (Phase 7)
// Real data (funnel, campaigns, compare, daily series, insights — see lib/insights.ts)
// never comes from here.
// ============================================================================

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
