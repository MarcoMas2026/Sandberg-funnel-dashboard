import { kv } from "@vercel/kv";
import { FunnelData } from "./types";

const FUNNEL_KEY = "funnel:merged";

export async function getFunnelData(): Promise<FunnelData> {
  const data = await kv.get<FunnelData>(FUNNEL_KEY);

  if (!data) {
    return { campaigns: [], last_updated: null, status: "stale" };
  }

  return data;
}

export async function setFunnelData(data: FunnelData): Promise<void> {
  await kv.set(FUNNEL_KEY, data);
}
