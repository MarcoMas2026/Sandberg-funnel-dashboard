import { NextResponse } from "next/server";
import { getDailyPortfolioLeads, isHistoryConfigured } from "@/lib/history/db";

export const dynamic = "force-dynamic";

// GET /api/history/daily-leads?start=YYYY-MM-DD&end=YYYY-MM-DD
// Total portfolio leads per calendar day for the given range (active +
// inactive campaigns) — backs Mission Control's daily leads trend chart,
// which spans the full current calendar month (day 1 through the last day).
export async function GET(req: Request) {
  if (!isHistoryConfigured()) {
    return NextResponse.json({ connected: false, rows: [] });
  }
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ connected: false, rows: [] }, { status: 400 });
  }

  try {
    const result = await getDailyPortfolioLeads(start, end);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ connected: false, rows: [] }, { status: 500 });
  }
}
