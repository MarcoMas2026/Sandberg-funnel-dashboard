import { CampaignMapEntry } from "./types";

// Maps a Meta Ads campaign to its corresponding Typeform qualifier.
// To add a new campaign: append an entry here, then add the matching
// mapping in the n8n "Merge & finalize" workflow (see /docs/n8n-workflow.md).
export const CAMPAIGN_MAP: CampaignMapEntry[] = [
  {
    meta_campaign_id: "120249096771300071",
    meta_campaign_name: "SP - 6648 - Catalina Duplex",
    typeform_form_id: "pqBjw5Y6",
    typeform_form_name: "Catalina Duplex Qualifier",
    property: "Catalina Duplex",
    ref: "6648",
  },
  {
    meta_campaign_id: "120248931370460071",
    meta_campaign_name: "SP - 32785 - Finca Bugambilia",
    typeform_form_id: "d53a9GPD",
    typeform_form_name: "Finca Bugambilia Qualifier",
    property: "Finca Bugambilia",
    ref: "32785",
  },
  {
    meta_campaign_id: "120248754551970071",
    meta_campaign_name: "SP - 32606 - CAN VILA",
    typeform_form_id: "BZDwyYhN",
    typeform_form_name: "CAN VILA Qualifier",
    property: "CAN VILA",
    ref: "32606",
  },
];
