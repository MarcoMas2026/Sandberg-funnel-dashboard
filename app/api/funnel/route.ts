import { NextResponse } from "next/server";
import { getFunnelData } from "@/lib/kv";
import { applyBaselineToCampaign } from "@/lib/test-attribution";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getFunnelData();
    // Display-only: adds the finished 3-5M test's per-ad share to its four properties. The history
    // sync reads getFunnelData() directly, so stored history is never affected.
    return NextResponse.json({ ...data, campaigns: data.campaigns.map(applyBaselineToCampaign) });
  } catch (error) {
    return NextResponse.json(
      { campaigns: [], last_updated: null, status: "error" },
      { status: 500 }
    );
  }
}
