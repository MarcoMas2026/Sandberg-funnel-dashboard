import { NextResponse } from "next/server";
import { CAMPAIGN_MAP } from "@/lib/config";

export const dynamic = "force-dynamic";

// Single source of truth for the Meta ↔ Typeform campaign mapping.
// The n8n Typeform Sync ("Set Form List") and Merge workflows both read this,
// so adding a campaign only requires editing lib/config.ts and redeploying.
export async function GET() {
  return NextResponse.json({ campaigns: CAMPAIGN_MAP });
}
