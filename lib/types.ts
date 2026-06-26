export interface MetaCampaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  cpm: number;
  ctr: number;
  cpl: number;
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

export interface FunnelCampaign {
  campaign_id: string;
  campaign_name: string;
  property: string;
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

export interface CampaignMapEntry {
  meta_campaign_id: string;
  meta_campaign_name: string;
  typeform_form_id: string;
  typeform_form_name: string;
  property: string;
  ref: string;
}
