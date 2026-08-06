import { NextRequest, NextResponse } from "next/server";
import { getCampaignSeries, isHistoryConfigured } from "@/lib/history/db";

export const dynamic = "force-dynamic";

// GET /api/history/campaign-series?ids=id1,id2,id3
// Full daily history (all time, any status) for the given campaigns — backs
// the Campaign Curve chart's day-1/day-2/... comparison lines.
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) {
    return NextResponse.json({ connected: false, series: {}, error: "Missing ids" }, { status: 400 });
  }
  if (!isHistoryConfigured()) {
    return NextResponse.json({ connected: false, series: {} });
  }
  const campaignIds = ids.split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const result = await getCampaignSeries(campaignIds);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ connected: false, series: {}, error: "Failed to read history" }, { status: 500 });
  }
}
