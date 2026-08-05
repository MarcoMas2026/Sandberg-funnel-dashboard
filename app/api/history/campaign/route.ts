import { NextRequest, NextResponse } from "next/server";
import { getCampaignMonth, isHistoryConfigured } from "@/lib/history/db";

export const dynamic = "force-dynamic";

// GET /api/history/campaign?id=<campaign_id>&month=YYYY-MM
// Single campaign's stored totals for one month — backs the lighter detail
// view /campaign/[id] falls back to when the campaign isn't in the live
// funnel feed (dropped from lib/config.ts, so no full FunnelCampaign shape
// — no Typeform funnel/landing/Clarity detail exists for it).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const month = req.nextUrl.searchParams.get("month");
  if (!id || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ connected: false, campaign: null, error: "Missing/invalid id or month" }, { status: 400 });
  }
  if (!isHistoryConfigured()) {
    return NextResponse.json({ connected: false, campaign: null });
  }
  const [year, monthNum] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = `${month}-${String(new Date(year, monthNum, 0).getDate()).padStart(2, "0")}`;
  try {
    const campaign = await getCampaignMonth(id, year, monthNum, start, end);
    return NextResponse.json({ connected: true, campaign });
  } catch (error) {
    return NextResponse.json({ connected: false, campaign: null, error: "Failed to read history" }, { status: 500 });
  }
}
