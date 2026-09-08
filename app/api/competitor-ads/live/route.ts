import { NextResponse } from "next/server";
import { getCompetitorAdsLive } from "@/lib/kv";

export const dynamic = "force-dynamic";

// Fast "what's live right now" read — today's flattened Ads Library pull,
// written daily by the "Funnel Dashboard - Ads Library Sync" n8n workflow
// straight to Upstash KV (competitor_ads:live). Historical/trend data lives
// in Supabase instead — see GET /api/competitor-ads/history.
export async function GET() {
  try {
    const live = await getCompetitorAdsLive();
    return NextResponse.json({ connected: true, lastUpdated: live.last_updated, ads: live.ads });
  } catch (error) {
    return NextResponse.json(
      { connected: false, lastUpdated: null, ads: [], error: "Failed to load competitor ads" },
      { status: 500 }
    );
  }
}
