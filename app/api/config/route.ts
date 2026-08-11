import { NextRequest, NextResponse } from "next/server";
import { CAMPAIGN_MAP } from "@/lib/config";
import { requireCrmToken } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Single source of truth for the Meta ↔ Typeform campaign mapping.
// The n8n Typeform Sync ("Set Form List") and Merge workflows both read this,
// so adding a campaign only requires editing lib/config.ts and redeploying.
// Token-protected as of the CRM data-exchange work — n8n's own credential for
// this call carries the same FUNNEL_API_TOKEN via an httpHeaderAuth credential.
export async function GET(request: NextRequest) {
  const denied = requireCrmToken(request);
  if (denied) return denied;
  return NextResponse.json({ campaigns: CAMPAIGN_MAP });
}
