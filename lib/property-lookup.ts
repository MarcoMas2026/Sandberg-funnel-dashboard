import { CAMPAIGN_MAP } from "./config";
import { PROPERTY_REGISTRY, PropertyInfo } from "./properties";

// Bridges a lead's campaign_name/campaign_id back to a property ref. Not every
// lead's campaign is still in CAMPAIGN_MAP (paused/retired campaigns drop out
// of it, see CONTEXT.md §14 "Known limitation") but campaign_name itself
// survives on the lead record, and property campaigns are always named
// "SP - <ref> - <name>" — so we fall back to parsing the ref out of that
// string rather than requiring a live CAMPAIGN_MAP entry.
const CAMPAIGN_NAME_REF_PATTERN = /-\s*(\d+)\s*-/;

export function refFromCampaign(campaignId: string, campaignName: string): string | null {
  const mapped = CAMPAIGN_MAP.find((c) => c.meta_campaign_id === campaignId);
  if (mapped && mapped.ref !== "Community") return mapped.ref;

  const match = campaignName.match(CAMPAIGN_NAME_REF_PATTERN);
  return match ? match[1] : null;
}

// Display name for the property card header. Prefers CAMPAIGN_MAP's curated
// `property` field; falls back to stripping the "SP - <ref> - " prefix off
// campaign_name for leads whose campaign has aged out of CAMPAIGN_MAP.
export function propertyNameFromCampaign(campaignId: string, campaignName: string): string {
  const mapped = CAMPAIGN_MAP.find((c) => c.meta_campaign_id === campaignId);
  if (mapped) return mapped.property;

  const stripped = campaignName.replace(/^[A-Z]{2}\s*-\s*\d+\s*-\s*/, "");
  return stripped || campaignName;
}

export function propertyInfoForCampaign(campaignId: string, campaignName: string): PropertyInfo | null {
  const ref = refFromCampaign(campaignId, campaignName);
  if (!ref) return null;
  return PROPERTY_REGISTRY[ref] ?? null;
}
