export interface MetaDailyRow {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  leads: number;
  video_plays: number;
  engagement: number; // post_engagement (reactions/comments/shares/clicks on the ad)
  ctr: number; // 0..1
  outbound_ctr: number; // 0..1
  cpl: number; // cost per lead that day
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  start_date: string | null; // ISO
  stop_date: string | null; // ISO, null = ongoing
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  leads: number;
  video_plays: number;
  engagement: number; // post_engagement, used in the funnel for community campaigns
  cpm: number;
  ctr: number; // 0..1
  cpl: number; // cost per lead (spend / leads)
  outbound_ctr: number; // 0..1
  daily: MetaDailyRow[];
}

export interface TypeformField {
  id: string;
  label: string;
  views: number;
  dropoffs: number;
  dropoff_rate: number;
}

export interface TypeformForm {
  form_id: string;
  form_name: string;
  views: number;
  starts: number;
  completions: number;
  completion_rate: number;
  fields: TypeformField[];
}

export type CampaignType = "property" | "community";

export interface FunnelCampaign {
  campaign_id: string;
  campaign_name: string;
  property: string;
  ref: string;
  campaign_type: CampaignType;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  meta: MetaCampaign;
  typeform: TypeformForm;
  derived: {
    click_to_form_start_rate: number;
    form_completion_rate: number;
    cost_per_qualified_lead: number;
  };
}

export interface FunnelData {
  campaigns: FunnelCampaign[];
  last_updated: string | null;
  status: "fresh" | "stale" | "error";
}

// A resolved past campaign used as a performance benchmark in the Compare view.
// Only campaigns whose Typeform submissions could be verifiably attributed to
// THAT specific campaign (via a hidden field matching its ref, or — for the
// one campaign type with no ref — its own utm_campaign) are included. See
// historical:campaigns in KV / CONTEXT.md for how this pool is populated.
export interface HistoricalCampaign {
  campaign_id: string;
  campaign_name: string;
  property: string;
  ref: string;
  campaign_type: CampaignType;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  leads: number; // Typeform submissions
  starts: number; // Typeform starts (completed + partial)
  ctr: number; // 0..1
  cpl: number; // spend / leads
  click_to_form_start_rate: number; // 0..1
  form_completion_rate: number; // 0..1
}

export interface CampaignMapEntry {
  meta_campaign_id: string;
  meta_campaign_name: string;
  typeform_form_id: string;
  typeform_form_name: string;
  property: string;
  ref: string;
  // "property" = a specific-listing campaign (funnel shows video views);
  // "community" = a community waitlist campaign (funnel shows engagement instead).
  campaign_type: CampaignType;
}
