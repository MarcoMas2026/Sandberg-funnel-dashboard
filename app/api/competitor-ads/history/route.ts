import { NextRequest, NextResponse } from "next/server";
import { getCompetitorAdsHistory } from "@/lib/competitor-ads/db";

export const dynamic = "force-dynamic";

// By-competitor summary, recent ad feed, and activity trend — derived from
// the day-by-day Supabase snapshot table (competitor_ad_snapshots), not KV.
export async function GET(request: NextRequest) {
  const days = Number(request.nextUrl.searchParams.get("days") ?? "30") || 30;
  try {
    const history = await getCompetitorAdsHistory(days);
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        summary: [],
        feed: [],
        trend: [],
        syncState: null,
        error: "Failed to load competitor ad history",
      },
      { status: 500 }
    );
  }
}
