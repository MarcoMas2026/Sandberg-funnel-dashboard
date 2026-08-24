import { NextResponse } from "next/server";
import { getAllOutcomes, getEventTypeStatus, isCrmConfigured } from "@/lib/crm/db";
import { getAllLeadResponseCampaigns, getCampaignsCatalog } from "@/lib/history/db";

export const dynamic = "force-dynamic";

// Internal read for this app's own UI (Part 4 of the CRM integration) — not
// part of the CRM two-way contract, so unguarded like /api/leads and
// /api/history/*, not token-gated like /api/config and /api/funnel-export.
//
// Joins crm_lead_outcomes (Supabase, keyed by response_id) back to a campaign
// via funnel_lead_responses (Supabase) — response_id is the shared key on
// both sides, verified identical to the CRM's own token (see CONTEXT.md).
// Deliberately NOT KV leads:all: that key is a full replace scoped to only
// currently-active campaigns (lib/kv.ts), so a lead whose campaign has since
// been paused drops out of it entirely — which made ~99% of real outcome
// rows unattributable the moment the CRM pull's 13-day backlog landed.
// funnel_lead_responses is upsert-only and never forgets a response_id, so
// it stays valid after a campaign's status changes. Campaign names come from
// getCampaignsCatalog() (funnel_daily_history) for the same durability
// reason — a paused campaign's name isn't in leads:all either. A response_id
// this store has never seen (predates history-sync's tracking, or predates
// the CRM's own data) still lands in `unattributed` rather than being
// silently dropped.
export async function GET() {
  try {
    const [outcomes, eventTypes, leadResponses, catalog] = await Promise.all([
      getAllOutcomes(),
      getEventTypeStatus(),
      getAllLeadResponseCampaigns(),
      getCampaignsCatalog(),
    ]);

    const campaignIdByResponseId = new Map(leadResponses.map((r) => [r.response_id, r.campaign_id]));
    const campaignById = new Map(catalog.campaigns.map((c) => [c.campaign_id, c]));

    interface CampaignBucket {
      campaign_id: string;
      campaign_name: string;
      property: string;
      counts: Record<string, number>;
    }
    const byCampaign = new Map<string, CampaignBucket>();
    let unattributed = 0;

    for (const o of outcomes) {
      const campaignId = campaignIdByResponseId.get(o.response_id);
      const campaign = campaignId ? campaignById.get(campaignId) : undefined;
      if (!campaignId || !campaign) {
        unattributed += 1;
        continue;
      }
      let bucket = byCampaign.get(campaignId);
      if (!bucket) {
        bucket = { campaign_id: campaignId, campaign_name: campaign.campaign_name, property: campaign.campaign_name, counts: {} };
        byCampaign.set(campaignId, bucket);
      }
      bucket.counts[o.event] = (bucket.counts[o.event] ?? 0) + 1;
    }

    return NextResponse.json({
      connected: isCrmConfigured(),
      campaigns: Array.from(byCampaign.values()),
      eventTypes,
      unattributed,
    });
  } catch (error) {
    return NextResponse.json(
      { connected: false, campaigns: [], eventTypes: [], unattributed: 0, error: "Failed to load CRM outcomes" },
      { status: 500 }
    );
  }
}
