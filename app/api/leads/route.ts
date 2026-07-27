import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const campaignId = request.nextUrl.searchParams.get("campaign_id") ?? undefined;
    const leads = await getLeads(campaignId);
    return NextResponse.json({ leads });
  } catch (error) {
    return NextResponse.json({ leads: [], error: "Failed to load leads" }, { status: 500 });
  }
}
