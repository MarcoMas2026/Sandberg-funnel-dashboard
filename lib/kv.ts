import { ClarityMetrics, FunnelData, HistoricalCampaign, LandingEngagement, LandingEngagementRaw, LeadRecord, LeadTag } from "./types";
import { CAMPAIGN_MAP, LANDING_SECTION_ORDER } from "./config";

const FUNNEL_KEY = "funnel:merged";
const HISTORICAL_KEY = "historical:campaigns";
const LEADS_KEY = "leads:all";
const LEAD_TAGS_KEY = "leads:tags";
const LANDING_FUNNEL_KEY = "landing:funnel";
const CLARITY_METRICS_KEY = "clarity:metrics";

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

const SCROLL_MILESTONES = [25, 50, 75, 100];

// Always returns a fully zero-filled shape when raw is missing/empty — the UI renders a
// stable "0" layout rather than hiding the panel, so a brand-new campaign with no traffic
// yet still shows the full structure.
function deriveLandingEngagement(raw: LandingEngagementRaw | undefined): LandingEngagement {
  const pageViews = raw?.page_views ?? 0;

  const steps = LANDING_SECTION_ORDER.map((section) => {
    const views = raw?.section_views?.[section] ?? 0;
    return { section, views, pct_of_page_views: pageViews ? views / pageViews : 0 };
  });

  const ctaClicks = Object.values(raw?.cta_clicks ?? {}).reduce((sum, n) => sum + n, 0);

  const events: LandingEngagement["events"] = [
    { name: "page_view", sessions: pageViews },
    ...LANDING_SECTION_ORDER.map((section) => ({
      name: `section_view:${section}`,
      sessions: raw?.section_views?.[section] ?? 0,
    })),
    ...SCROLL_MILESTONES.map((m) => ({
      name: `scroll_depth:${m}`,
      sessions: raw?.scroll_depth?.[String(m)] ?? 0,
    })),
    { name: "cta_click:main_cta", sessions: raw?.cta_clicks?.main_cta ?? 0 },
    { name: "cta_click:sticky_cta", sessions: raw?.cta_clicks?.sticky_cta ?? 0 },
  ];

  return {
    page_views: pageViews,
    steps,
    cta_clicks: ctaClicks,
    cta_click_rate: pageViews ? ctaClicks / pageViews : 0,
    events,
  };
}

const EMPTY_CLARITY_METRICS: ClarityMetrics = {
  sessions: 0,
  bot_sessions: 0,
  distinct_users: 0,
  pages_per_session: 0,
  scroll_depth_avg: 0,
  active_time_seconds: 0,
  total_time_seconds: 0,
  dead_click_pct: 0,
  rage_click_pct: 0,
  excessive_scroll_pct: 0,
  quickback_pct: 0,
  script_error_pct: 0,
};

// clarity:metrics is written every 4h by the standalone n8n workflow "Funnel Dashboard -
// Clarity Sync" from Clarity's Data Export API (dimension1=URL), keyed by the same landing
// folder slug as landing:funnel. A raw fetch failure/malformed key returns {} rather than
// throwing, so a Clarity hiccup never takes down the rest of the funnel dashboard.
async function getClarityMetricsBySlug(): Promise<Record<string, ClarityMetrics>> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${CLARITY_METRICS_KEY}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  const { result } = await res.json();
  if (!result) return {};
  return JSON.parse(result) as Record<string, ClarityMetrics>;
}

export async function getFunnelData(): Promise<FunnelData> {
  const [res, landingBySlug, clarityBySlug] = await Promise.all([
    fetch(`${process.env.KV_REST_API_URL}/get/${FUNNEL_KEY}`, {
      headers: kvHeaders(),
      cache: "no-store",
    }),
    getLandingEngagementBySlug(),
    getClarityMetricsBySlug(),
  ]);
  const { result } = await res.json();

  if (!result) {
    return { campaigns: [], last_updated: null, status: "stale" };
  }

  const data = JSON.parse(result) as FunnelData;

  data.campaigns = data.campaigns.map((campaign) => {
    const mapEntry = CAMPAIGN_MAP.find((c) => c.meta_campaign_id === campaign.campaign_id);
    const slug = mapEntry?.landing_slug ?? campaign.ref;
    return {
      ...campaign,
      landing_engagement: deriveLandingEngagement(landingBySlug[slug]),
      clarity: clarityBySlug[slug] ?? EMPTY_CLARITY_METRICS,
    };
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
