import { NextResponse } from "next/server";
import { getCampaignLeadTotals, isHistoryConfigured } from "@/lib/history/db";

export const dynamic = "force-dynamic";

// GET /api/history/leads-by-campaign?start=YYYY-MM-DD&end=YYYY-MM-DD
// Per-campaign lead totals for the given date range, active + inactive —
// backs Mission Control's "Lead count by campaign" donut and its 7/15/30-day
// toggle.
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
    const result = await getCampaignLeadTotals(start, end);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ connected: false, rows: [] }, { status: 500 });
  }
}
