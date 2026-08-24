import { NextRequest, NextResponse } from "next/server";
import {
  getPortfolioComparison,
  getPortfolioMonthlySeries,
  getCampaignComparisonRows,
  isHistoryConfigured,
  HISTORY_START,
} from "@/lib/history/db";

export const dynamic = "force-dynamic";

// GET /api/history/report?year=YYYY&month=M  (month is 1-indexed)
// Everything the Meta Ads Monthly Report page needs in one call: portfolio
// totals for the selected month vs previous month vs previous year (with
// deltas already computed), a 12-month portfolio trend series, and
// per-campaign totals + MoM deltas for the selected month.
export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get("year");
  const monthParam = req.nextUrl.searchParams.get("month");
  const year = Number(yearParam);
  const month = Number(monthParam);
  if (!yearParam || !monthParam || Number.isNaN(year) || Number.isNaN(month)) {
    return NextResponse.json({ connected: false, error: "Missing/invalid year or month" }, { status: 400 });
  }
  if (!isHistoryConfigured()) {
    return NextResponse.json({ connected: false, portfolio: null, trend: [], campaigns: [] });
  }
  try {
    // 12 months back (inclusive of the selected month), clamped to
    // HISTORY_START so the trend chart never implies data exists before this
    // store's floor.
    const back = new Date(year, month - 1 - 11, 1);
    let seriesSinceYear = back.getFullYear();
    let seriesSinceMonth = back.getMonth() + 1;
    if (seriesSinceYear < HISTORY_START.year || (seriesSinceYear === HISTORY_START.year && seriesSinceMonth < HISTORY_START.month)) {
      seriesSinceYear = HISTORY_START.year;
      seriesSinceMonth = HISTORY_START.month;
    }

    const [portfolio, trend, campaigns] = await Promise.all([
      getPortfolioComparison(year, month),
      getPortfolioMonthlySeries(seriesSinceYear, seriesSinceMonth),
      getCampaignComparisonRows(year, month),
    ]);

    return NextResponse.json({ connected: true, portfolio, trend, campaigns: campaigns.rows });
  } catch (error) {
    return NextResponse.json({ connected: false, error: "Failed to build report" }, { status: 500 });
  }
}
