import { NextRequest, NextResponse } from "next/server";
import { getMonthlyTotals, isHistoryConfigured } from "@/lib/history/db";

export const dynamic = "force-dynamic";

// GET /api/history/monthly?start=YYYY-MM-DD&end=YYYY-MM-DD
// Sums stored history across all campaigns for the given inclusive date range
// (a calendar month, day 1 -> last day). year/month are derived from start.
export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ connected: false, spend: 0, leads: 0, error: "Missing start/end" }, { status: 400 });
  }
  if (!isHistoryConfigured()) {
    return NextResponse.json({ connected: false, spend: 0, leads: 0 });
  }
  try {
    const [year, month] = start.split("-").map(Number);
    const totals = await getMonthlyTotals(year, month, start, end);
    return NextResponse.json(totals);
  } catch (error) {
    return NextResponse.json({ connected: false, spend: 0, leads: 0, error: "Failed to read history" }, { status: 500 });
  }
}
