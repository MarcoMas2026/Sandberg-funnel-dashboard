import { NextRequest, NextResponse } from "next/server";
import { getFunnelData } from "@/lib/kv";
import { requireCrmToken } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// The half of the two-way CRM data exchange that flows FROM this app. The CRM
// already pulls Meta campaign metrics (spend/impressions/reach/clicks) itself —
// this endpoint deliberately does NOT duplicate those. What it adds:
//
// 1. The id pair needed to attribute a CRM lead outcome back to a listing:
//    meta_campaign_id / typeform_form_id / ref / property.
// 2. The pre-lead funnel stages this app already computes and the CRM has no
//    other way to get: impressions -> video views -> landing page -> Typeform
//    start -> submission.
// 3. cost_per_lead computed OUR way — spend from Meta's date_preset(maximum)
//    aggregate divided by Typeform submissions, never a sum of daily rows
//    (CLAUDE.md's ~5% under-report rule) and never Meta's own lead pixel.
export async function GET(request: NextRequest) {
  const denied = requireCrmToken(request);
  if (denied) return denied;

  try {
    const data = await getFunnelData();
    const campaigns = data.campaigns.map((c) => ({
      meta_campaign_id: c.campaign_id,
      typeform_form_id: c.typeform.form_id || null,
      property: c.property,
      ref: c.ref,
      campaign_name: c.campaign_name,
      campaign_type: c.campaign_type,
      status: c.status,
      funnel: {
        impressions: c.meta.impressions,
        video_views: c.meta.video_plays,
        engagement: c.meta.engagement,
        landing_page_views: c.landing_engagement.page_views,
        typeform_starts: c.typeform.starts,
        submissions: c.typeform.completions,
      },
      cost_per_lead: c.meta.cpl,
    }));

    return NextResponse.json({
      campaigns,
      last_updated: data.last_updated,
      status: data.status,
    });
  } catch (error) {
    return NextResponse.json({ campaigns: [], last_updated: null, status: "error" }, { status: 500 });
  }
}
