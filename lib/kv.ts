import { FunnelData, HistoricalCampaign } from "./types";

const FUNNEL_KEY = "funnel:merged";
const HISTORICAL_KEY = "historical:campaigns";

function kvHeaders() {
  return { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` };
}

export async function getFunnelData(): Promise<FunnelData> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${FUNNEL_KEY}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  const { result } = await res.json();

  if (!result) {
    return { campaigns: [], last_updated: null, status: "stale" };
  }

  return JSON.parse(result) as FunnelData;
}

export async function setFunnelData(data: FunnelData): Promise<void> {
  await fetch(`${process.env.KV_REST_API_URL}/set/${FUNNEL_KEY}`, {
    method: "POST",
    headers: { ...kvHeaders(), "Content-Type": "text/plain" },
    body: JSON.stringify(data),
    cache: "no-store",
  });
}

// Pool of past (inactive) campaigns with verified Typeform attribution, used
// as performance benchmarks in Compare. Populated by a manual backfill, not
// the regular Update pipeline — see CONTEXT.md for how/when to refresh it.
export async function getHistoricalCampaigns(): Promise<HistoricalCampaign[]> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${HISTORICAL_KEY}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  const { result } = await res.json();

  if (!result) return [];

  return JSON.parse(result) as HistoricalCampaign[];
}
