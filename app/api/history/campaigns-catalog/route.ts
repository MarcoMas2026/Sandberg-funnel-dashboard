import { NextResponse } from "next/server";
import { getCampaignsCatalog, isHistoryConfigured } from "@/lib/history/db";
import { getFunnelData } from "@/lib/kv";

export const dynamic = "force-dynamic";

// GET /api/history/campaigns-catalog
// Every campaign this store has a daily snapshot for, active or inactive —
// backs the Campaign Curve selector (unlike CampaignSelector, which only
// lists currently-ACTIVE campaigns from funnel:merged).
export async function GET() {
  if (!isHistoryConfigured()) {
    return NextResponse.json({ connected: false, campaigns: [] });
  }
  try {
    const result = await getCampaignsCatalog();
    // Each row's `status` is frozen from the campaign's most recent daily
    // snapshot — for a campaign no longer in lib/config.ts (dropped from the
    // live feed entirely), that's whatever Meta reported on its LAST synced
    // day, which stays "ACTIVE" forever if it happened to still be running
    // then. Cross-check against the live funnel:merged feed (the actual
    // source of truth for "is this running right now") and correct anything
    // not present there so Curve/Two Sides never bucket a dropped-out
    // campaign as active.
    try {
      const live = await getFunnelData();
      const liveStatus = new Map(live.campaigns.map((c) => [c.campaign_id, c.status]));
      result.campaigns = result.campaigns.map((c) => ({
        ...c,
        status: liveStatus.get(c.campaign_id) ?? "PAUSED",
      }));
    } catch {
      // Live feed unreachable — fall back to the raw historical status
      // rather than failing the whole catalog.
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ connected: false, campaigns: [], error: "Failed to read history" }, { status: 500 });
  }
}
