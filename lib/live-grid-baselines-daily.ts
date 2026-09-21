// Per-day results of the finished "SP (3-5M) - September" test (Meta campaign 120252025940010071),
// one entry per property's ad. Meta numbers pulled at ad level with time_increment(1) on 2026-09-21
// (the pipeline only keeps campaign/ad-set totals); leads are each property's Typeform form
// submissions by Madrid-time date (form totals at that moment). The test is over, so these are final.
// Used with lib/test-attribution.ts to give the four properties their own history for
// Curve, Two Sides and the campaign charts.
export interface BaselineDay {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  reach: number;
  leads: number;
}

export const LIVE_BASELINE_DAILY: Record<string, BaselineDay[]> = {
  "32396": [
    { date: "2026-09-16", spend: 2.45, impressions: 100, clicks: 5, linkClicks: 4, reach: 94, leads: 0 },
    { date: "2026-09-17", spend: 50.81, impressions: 2164, clicks: 197, linkClicks: 140, reach: 1753, leads: 3 },
    { date: "2026-09-18", spend: 45.35, impressions: 2070, clicks: 146, linkClicks: 99, reach: 1742, leads: 7 },
    { date: "2026-09-19", spend: 137.58, impressions: 5159, clicks: 339, linkClicks: 238, reach: 4370, leads: 7 },
    { date: "2026-09-20", spend: 151.71, impressions: 5272, clicks: 390, linkClicks: 253, reach: 4586, leads: 8 },
    { date: "2026-09-21", spend: 56.22, impressions: 2499, clicks: 184, linkClicks: 125, reach: 2275, leads: 1 },
  ],
  "32136": [
    { date: "2026-09-16", spend: 27.9, impressions: 1487, clicks: 118, linkClicks: 82, reach: 1225, leads: 0 },
    { date: "2026-09-17", spend: 35.46, impressions: 1901, clicks: 143, linkClicks: 90, reach: 1545, leads: 3 },
    { date: "2026-09-18", spend: 5.15, impressions: 289, clicks: 19, linkClicks: 13, reach: 248, leads: 0 },
    { date: "2026-09-19", spend: 12.4, impressions: 617, clicks: 36, linkClicks: 24, reach: 550, leads: 0 },
    { date: "2026-09-20", spend: 12.71, impressions: 420, clicks: 33, linkClicks: 20, reach: 359, leads: 0 },
    { date: "2026-09-21", spend: 1.34, impressions: 42, clicks: 5, linkClicks: 3, reach: 40, leads: 0 },
  ],
  "32825": [
    { date: "2026-09-16", spend: 3.97, impressions: 160, clicks: 12, linkClicks: 11, reach: 137, leads: 0 },
    { date: "2026-09-17", spend: 25.69, impressions: 927, clicks: 71, linkClicks: 50, reach: 671, leads: 2 },
    { date: "2026-09-18", spend: 8.93, impressions: 377, clicks: 29, linkClicks: 23, reach: 327, leads: 1 },
    { date: "2026-09-19", spend: 12.07, impressions: 370, clicks: 18, linkClicks: 17, reach: 316, leads: 0 },
    { date: "2026-09-20", spend: 4.15, impressions: 132, clicks: 12, linkClicks: 9, reach: 119, leads: 0 },
    { date: "2026-09-21", spend: 0.24, impressions: 6, clicks: 0, linkClicks: 0, reach: 6, leads: 0 },
  ],
  "32859": [
    { date: "2026-09-16", spend: 9.04, impressions: 401, clicks: 23, linkClicks: 13, reach: 346, leads: 0 },
    { date: "2026-09-17", spend: 15.76, impressions: 702, clicks: 44, linkClicks: 33, reach: 595, leads: 0 },
    { date: "2026-09-18", spend: 2.68, impressions: 104, clicks: 12, linkClicks: 7, reach: 91, leads: 0 },
    { date: "2026-09-19", spend: 0.85, impressions: 26, clicks: 0, linkClicks: 0, reach: 26, leads: 0 },
    { date: "2026-09-20", spend: 5.71, impressions: 154, clicks: 9, linkClicks: 8, reach: 140, leads: 0 },
  ],
};
