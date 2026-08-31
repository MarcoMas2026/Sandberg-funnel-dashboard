import { NextResponse } from "next/server";
import { getCampaignsCatalog, getLeaderboardTotals, isHistoryConfigured } from "@/lib/history/db";
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
    let campaigns: (typeof result.campaigns[number] & { spend: number | null })[] = result.campaigns.map((c) => ({
      ...c,
      spend: null,
    }));
    try {
      const live = await getFunnelData();
      const liveById = new Map(live.campaigns.map((c) => [c.campaign_id, c]));
      // Historical total spend for anything NOT in the live feed — per
      // CLAUDE.md, Meta totals must come from the monthly aggregate, never
      // summed daily rows; getLeaderboardTotals already prefers
      // funnel_monthly_totals and only falls back to summing daily rows for
      // months that aggregate hasn't backfilled yet, so it's safe here.
      const { rows: historical } = await getLeaderboardTotals();
      const historicalSpend = new Map(historical.map((r) => [r.campaign_id, r.spend]));
      campaigns = result.campaigns.map((c) => {
        const live_c = liveById.get(c.campaign_id);
        return {
          ...c,
          status: live_c?.status ?? "PAUSED",
          spend: live_c ? live_c.meta.spend : historicalSpend.get(c.campaign_id) ?? null,
        };
      });
    } catch {
      // Live feed/history unreachable — fall back to the raw catalog with no
      // spend annotation rather than failing the whole endpoint.
    }
    return NextResponse.json({ ...result, campaigns });
  } catch (error) {
    return NextResponse.json({ connected: false, campaigns: [], error: "Failed to read history" }, { status: 500 });
  }
}
