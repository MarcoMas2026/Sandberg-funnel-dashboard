import { NextRequest, NextResponse } from "next/server";
import { getMonthlyCampaignRows, isHistoryConfigured } from "@/lib/history/db";

export const dynamic = "force-dynamic";

// GET /api/history/campaigns?start=YYYY-MM-DD&end=YYYY-MM-DD
// Per-campaign totals for the given month — includes campaigns no longer
// live in lib/config.ts, which is how Mission Control's Paid Campaigns list
// surfaces a since-dropped campaign that ran during the selected month.
export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ connected: false, rows: [], error: "Missing start/end" }, { status: 400 });
  }
  if (!isHistoryConfigured()) {
    return NextResponse.json({ connected: false, rows: [] });
  }
  try {
    const [year, month] = start.split("-").map(Number);
    const result = await getMonthlyCampaignRows(year, month, start, end);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ connected: false, rows: [], error: "Failed to read history" }, { status: 500 });
  }
}
