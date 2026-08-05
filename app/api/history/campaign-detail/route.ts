import { NextRequest, NextResponse } from "next/server";
import { isHistoryConfigured } from "@/lib/history/db";
import { buildHistoricalCampaign } from "@/lib/history/campaign-detail";

export const dynamic = "force-dynamic";

// GET /api/history/campaign-detail?id=<campaign_id>&month=YYYY-MM
// Full FunnelCampaign-shaped reconstruction of a campaign no longer in the
// live funnel feed, for the given month — see lib/history/campaign-detail.ts
// for exactly which fields are real vs. the NaN/"unavailable" sentinel.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const month = req.nextUrl.searchParams.get("month");
  if (!id || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ campaign: null, error: "Missing/invalid id or month" }, { status: 400 });
  }
  if (!isHistoryConfigured()) {
    return NextResponse.json({ campaign: null });
  }
  const [year, monthNum] = month.split("-").map(Number);
  try {
    const campaign = await buildHistoricalCampaign(id, year, monthNum);
    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json({ campaign: null, error: "Failed to build historical campaign" }, { status: 500 });
  }
}
