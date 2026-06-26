// MOCK DATA — used only for the campaign deep-dive time-series chart, which
// has no real historical metric yet. Swap for a real time-series KV read
// (e.g. "funnel:history:<campaign_id>") in v2.
export interface TimeSeriesPoint {
  date: string;
  spend: number;
  link_clicks: number;
  completions: number;
}

export const MOCK_TIME_SERIES: TimeSeriesPoint[] = [
  { date: "Day 1", spend: 42, link_clicks: 38, completions: 2 },
  { date: "Day 2", spend: 51, link_clicks: 44, completions: 3 },
  { date: "Day 3", spend: 47, link_clicks: 40, completions: 1 },
  { date: "Day 4", spend: 63, link_clicks: 55, completions: 4 },
  { date: "Day 5", spend: 58, link_clicks: 49, completions: 3 },
  { date: "Day 6", spend: 70, link_clicks: 61, completions: 5 },
  { date: "Day 7", spend: 65, link_clicks: 57, completions: 4 },
];
