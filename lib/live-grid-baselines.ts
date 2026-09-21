// Per-ad results of the finished "SP (3-5M) - September" test campaign
// (Meta campaign 120252025940010071: 1 ad set, 4 ads, each a different property),
// so each property's Live Grid column carries its own share of that spend/reach on top
// of its new dedicated campaign. Pulled at ad level from Meta on 2026-09-21 (the daily
// pipeline only stores campaign/ad-set totals, and drops inactive campaigns). The test is
// over, so these are fixed numbers.
//
// Meta metrics are ADDED to the property's current campaign numbers. Typeform numbers are
// form-lifetime (they already include the test), so the `form` totals here are only a
// fallback for a property whose new campaign isn't linked to any form yet — never added.
export interface LiveBaseline {
  since: string; // ISO — when the property's ads first went live (the test's start)
  spend: number;
  impressions: number;
  clicks: number; // all clicks (CTR = clicks / impressions, same as the pipeline)
  linkClicks: number;
  leads: number; // submissions from this property's form during the test (form totals at 2026-09-21)
  form?: { starts: number; completions: number };
}

const SINCE = "2026-09-16T16:47:45+0200";

export const LIVE_BASELINES: Record<string, LiveBaseline> = {
  // Finca Sa Calma — its new campaign isn't linked to form UhWs6cyE yet (26 completed, 63 visits).
  "32396": { since: SINCE, spend: 443.86, impressions: 17248, clicks: 1257, linkClicks: 856, leads: 26, form: { starts: 63, completions: 26 } },
  "32136": { since: SINCE, spend: 94.95, impressions: 4755, clicks: 354, linkClicks: 232, leads: 3 }, // Can Aura
  "32825": { since: SINCE, spend: 55.05, impressions: 1972, clicks: 142, linkClicks: 110, leads: 3 }, // Penthouse Olinto
  "32859": { since: SINCE, spend: 34.04, impressions: 1387, clicks: 88, linkClicks: 61, leads: 0 }, // Ses Salines
};
