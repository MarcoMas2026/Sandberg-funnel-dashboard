import { NextResponse } from "next/server";
import { getLeaderboardTotals, isHistoryConfigured } from "@/lib/history/db";

export const dynamic = "force-dynamic";

// GET /api/history/leaderboard
// Per-campaign totals summed across every month from HISTORY_START (June
// 2026) onward — see lib/history/db.ts's getLeaderboardTotals for how
// monthly/daily rows are combined without double-counting.
export async function GET() {
  if (!isHistoryConfigured()) {
    return NextResponse.json({ connected: false, rows: [] });
  }
  try {
    const result = await getLeaderboardTotals();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ connected: false, rows: [] }, { status: 500 });
  }
}
