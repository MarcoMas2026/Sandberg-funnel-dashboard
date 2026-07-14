import { NextResponse } from "next/server";
import { getHistoricalCampaigns } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const campaigns = await getHistoricalCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    return NextResponse.json({ campaigns: [], error: "Failed to load historical campaigns" }, { status: 500 });
  }
}
