import { NextResponse } from "next/server";
import { getAllOutcomes, getEventTypeStatus, isCrmConfigured } from "@/lib/crm/db";
import { getLeads } from "@/lib/kv";

export const dynamic = "force-dynamic";

// Internal read for this app's own UI (Part 4 of the CRM integration) — not
// part of the CRM two-way contract, so unguarded like /api/leads and
// /api/history/*, not token-gated like /api/config and /api/funnel-export.
//
// Joins crm_lead_outcomes (Supabase, keyed by response_id) back to a campaign
// via leads:all (Upstash KV) — response_id is the shared key on both sides,
// verified identical to the CRM's own token (see CONTEXT.md). A lead whose
// campaign has since been paused/removed drops out of leads:all (same known
// limitation as everywhere else leads:all is read) and its outcomes land in
// `unattributed` rather than being silently dropped.
export async function GET() {
  try {
    const [outcomes, eventTypes, leads] = await Promise.all([getAllOutcomes(), getEventTypeStatus(), getLeads()]);

    const leadById = new Map(leads.map((l) => [l.response_id, l]));

    interface CampaignBucket {
      campaign_id: string;
      campaign_name: string;
      property: string;
      counts: Record<string, number>;
    }
    const byCampaign = new Map<string, CampaignBucket>();
    let unattributed = 0;

    for (const o of outcomes) {
      const lead = leadById.get(o.response_id);
      if (!lead) {
        unattributed += 1;
        continue;
      }
      let bucket = byCampaign.get(lead.campaign_id);
      if (!bucket) {
        bucket = { campaign_id: lead.campaign_id, campaign_name: lead.campaign_name, property: lead.campaign_name, counts: {} };
        byCampaign.set(lead.campaign_id, bucket);
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
