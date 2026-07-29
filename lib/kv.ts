import { FunnelData, HistoricalCampaign, LandingEngagement, LandingEngagementRaw, LeadRecord, LeadTag } from "./types";
import { CAMPAIGN_MAP, LANDING_SECTION_ORDER } from "./config";

const FUNNEL_KEY = "funnel:merged";
const HISTORICAL_KEY = "historical:campaigns";
const LEADS_KEY = "leads:all";
const LEAD_TAGS_KEY = "leads:tags";
const LANDING_FUNNEL_KEY = "landing:funnel";

function kvHeaders() {
  return { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` };
}

// landing:funnel is written every ~30 min by the standalone n8n workflow
// "Funnel Dashboard - Landing Engagement Sync", keyed by the landing folder slug
// (window.location.pathname's last segment on each property/community page).
// Joined in here at read-time rather than in the n8n Merge & Finalize step, so a
// bug in this join never risks the existing Meta/Typeform pipeline.
async function getLandingEngagementBySlug(): Promise<Record<string, LandingEngagementRaw>> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${LANDING_FUNNEL_KEY}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  const { result } = await res.json();
  if (!result) return {};
  return JSON.parse(result) as Record<string, LandingEngagementRaw>;
}

function deriveLandingEngagement(raw: LandingEngagementRaw | undefined): LandingEngagement | undefined {
  if (!raw || !raw.page_views) return undefined;

  const steps = LANDING_SECTION_ORDER.map((section) => {
    const views = raw.section_views?.[section] ?? 0;
    return { section, views, pct_of_page_views: views / raw.page_views };
  });

  const ctaClicks = Object.values(raw.cta_clicks ?? {}).reduce((sum, n) => sum + n, 0);

  return {
    page_views: raw.page_views,
    steps,
    cta_clicks: ctaClicks,
    cta_click_rate: ctaClicks / raw.page_views,
  };
}

export async function getFunnelData(): Promise<FunnelData> {
  const [res, landingBySlug] = await Promise.all([
    fetch(`${process.env.KV_REST_API_URL}/get/${FUNNEL_KEY}`, {
      headers: kvHeaders(),
      cache: "no-store",
    }),
    getLandingEngagementBySlug(),
  ]);
  const { result } = await res.json();

  if (!result) {
    return { campaigns: [], last_updated: null, status: "stale" };
  }

  const data = JSON.parse(result) as FunnelData;

  data.campaigns = data.campaigns.map((campaign) => {
    const mapEntry = CAMPAIGN_MAP.find((c) => c.meta_campaign_id === campaign.campaign_id);
    const slug = mapEntry?.landing_slug ?? campaign.ref;
    return { ...campaign, landing_engagement: deriveLandingEngagement(landingBySlug[slug]) };
  });

  return data;
}

export async function setFunnelData(data: FunnelData): Promise<void> {
  await fetch(`${process.env.KV_REST_API_URL}/set/${FUNNEL_KEY}`, {
    method: "POST",
    headers: { ...kvHeaders(), "Content-Type": "text/plain" },
    body: JSON.stringify(data),
    cache: "no-store",
  });
}

// Pool of past (inactive) campaigns with verified Typeform attribution, used
// as performance benchmarks in Compare. Populated by a manual backfill, not
// the regular Update pipeline — see CONTEXT.md for how/when to refresh it.
export async function getHistoricalCampaigns(): Promise<HistoricalCampaign[]> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${HISTORICAL_KEY}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  const { result } = await res.json();

  if (!result) return [];

  return JSON.parse(result) as HistoricalCampaign[];
}

// leads:all is written by the Typeform Sync workflow's "Build Leads" node
// (full replace every ~30-min sync, scoped to currently-active campaigns).
type RawLead = Omit<LeadRecord, "tag">;

async function getRawLeads(): Promise<RawLead[]> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${LEADS_KEY}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  const { result } = await res.json();

  if (!result) return [];

  return JSON.parse(result) as RawLead[];
}

// leads:tags is written ONLY by this app (never by n8n), keyed by the stable
// Typeform response_id, so a tag survives every resync of leads:all.
export async function getLeadTags(): Promise<Record<string, LeadTag>> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${LEAD_TAGS_KEY}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  const { result } = await res.json();

  if (!result) return {};

  return JSON.parse(result) as Record<string, LeadTag>;
}

async function setLeadTags(tags: Record<string, LeadTag>): Promise<void> {
  await fetch(`${process.env.KV_REST_API_URL}/set/${LEAD_TAGS_KEY}`, {
    method: "POST",
    headers: { ...kvHeaders(), "Content-Type": "text/plain" },
    body: JSON.stringify(tags),
    cache: "no-store",
  });
}

export async function getLeads(campaignId?: string): Promise<LeadRecord[]> {
  const [raw, tags] = await Promise.all([getRawLeads(), getLeadTags()]);
  const merged = raw.map((l) => ({ ...l, tag: tags[l.response_id] ?? null }));
  return campaignId ? merged.filter((l) => l.campaign_id === campaignId) : merged;
}

export async function setLeadTag(responseId: string, tag: LeadTag): Promise<Record<string, LeadTag>> {
  const tags = await getLeadTags();
  if (tag) {
    tags[responseId] = tag;
  } else {
    delete tags[responseId];
  }
  await setLeadTags(tags);
  return tags;
}
