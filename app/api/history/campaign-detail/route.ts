import { NextRequest, NextResponse } from "next/server";
import { getLatestMonthWithData, isHistoryConfigured } from "@/lib/history/db";
import { buildHistoricalCampaign } from "@/lib/history/campaign-detail";

export const dynamic = "force-dynamic";

// GET /api/history/campaign-detail?id=<campaign_id>&month=YYYY-MM
// Full FunnelCampaign-shaped reconstruction of a campaign no longer in the
// live funnel feed — see lib/history/campaign-detail.ts for exactly which
// fields are real vs. the NaN/"unavailable" sentinel. `month` is a HINT, not
// a hard requirement: Mission Control's Inactive Campaigns cards link here
// with whatever month is currently selected for the (unrelated) hero KPI
// cards, which the campaign may not have run in — when that month has no
// data, falls back to the campaign's own most recent month with data.
// `resolvedMonth` in the response tells the caller which month it actually got.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const month = req.nextUrl.searchParams.get("month");
  if (!id || (month && !/^\d{4}-\d{2}$/.test(month))) {
    return NextResponse.json({ campaign: null, error: "Missing id or invalid month" }, { status: 400 });
  }
  if (!isHistoryConfigured()) {
    return NextResponse.json({ campaign: null });
  }
  try {
    let year: number, monthNum: number;
    if (month) {
      [year, monthNum] = month.split("-").map(Number);
    } else {
      const latest = await getLatestMonthWithData(id);
      if (!latest) return NextResponse.json({ campaign: null });
      ({ year, month: monthNum } = latest);
    }

    let campaign = await buildHistoricalCampaign(id, year, monthNum);
    if (!campaign) {
      const latest = await getLatestMonthWithData(id);
      if (latest && (latest.year !== year || latest.month !== monthNum)) {
        year = latest.year;
        monthNum = latest.month;
        campaign = await buildHistoricalCampaign(id, year, monthNum);
      }
    }
    if (!campaign) return NextResponse.json({ campaign: null });

    const resolvedMonth = `${year}-${String(monthNum).padStart(2, "0")}`;
    return NextResponse.json({ campaign, resolvedMonth });
  } catch (error) {
    return NextResponse.json({ campaign: null, error: "Failed to build historical campaign" }, { status: 500 });
  }
}
