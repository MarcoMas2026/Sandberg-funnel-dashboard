import { CampaignMapEntry } from "./types";

// Maps a Meta Ads campaign to its corresponding Typeform qualifier.
// SINGLE SOURCE OF TRUTH: this is exposed at /api/config and read live by both
// n8n workflows (Typeform Sync + Merge). To add a campaign, append an entry here
// and push — no n8n edits needed. `property` and `ref` drive the on-screen labels.
// `campaign_type` drives which funnel layout is shown (see MarketingFunnel.tsx):
// "property" (named "SP - REF - PROPERTY") shows video views; "community"
// (named "CW - ...") shows post engagement instead, since those run image ads.
export const CAMPAIGN_MAP: CampaignMapEntry[] = [
  {
    meta_campaign_id: "120249096771300071",
    meta_campaign_name: "SP - 6648 - Catalina Duplex",
    typeform_form_id: "pqBjw5Y6",
    typeform_form_name: "Catalina Duplex Qualifier",
    property: "Catalina Duplex",
    ref: "6648",
    campaign_type: "property",
  },
  {
    meta_campaign_id: "120248931370460071",
    meta_campaign_name: "SP - 32785 - Finca Bugambilia",
    typeform_form_id: "d53a9GPD",
    typeform_form_name: "Finca Bugambilia Qualifier",
    property: "Finca Bugambilia",
    ref: "32785",
    campaign_type: "property",
  },
  {
    meta_campaign_id: "120248754551970071",
    meta_campaign_name: "SP - 32606 - CAN VILA",
    typeform_form_id: "BZDwyYhN",
    typeform_form_name: "CAN VILA Qualifier",
    property: "CAN VILA",
    ref: "32606",
    campaign_type: "property",
  },
  {
    meta_campaign_id: "120250284542490071",
    meta_campaign_name: "CW - Anchorage - ENG",
    typeform_form_id: "OEtGQCfj",
    typeform_form_name: "Anchorage Club Waitlist",
    property: "Anchorage Club",
    ref: "Community",
    campaign_type: "community",
  },
];
