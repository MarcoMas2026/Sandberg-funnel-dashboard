import { NextResponse } from "next/server";
import { getCampaignsCatalog, isHistoryConfigured } from "@/lib/history/db";

export const dynamic = "force-dynamic";

// GET /api/history/campaigns-catalog
// Every campaign this store has a daily snapshot for, active or inactive —
// backs the Campaign Curve selector (unlike CampaignSelector, which only
// lists currently-ACTIVE campaigns from funnel:merged).
export async function GET() {
  if (!isHistoryConfigured()) {
    return NextResponse.json({ connected: false, campaigns: [] });
  }
  try {
    const result = await getCampaignsCatalog();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ connected: false, campaigns: [], error: "Failed to read history" }, { status: 500 });
  }
}
