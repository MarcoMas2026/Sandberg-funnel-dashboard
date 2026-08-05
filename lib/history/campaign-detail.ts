import { FunnelCampaign } from "@/lib/types";
import { getCampaignDailyRows, getFullMonthlyRow } from "@/lib/history/db";
import { UNAVAILABLE_DATE } from "@/lib/format";
import { LANDING_SECTION_ORDER } from "@/lib/config";

// NaN is the shared "genuinely not recoverable" sentinel — see lib/format.ts.
// Every formatter renders it as "xxx", and it propagates through any rate
// math (x / NaN stays NaN) so callers never need a second unavailable-check.
const NA = NaN;

// Builds a full FunnelCampaign for a month that's no longer live — same shape
// CampaignInfoBar/MetricsPanel/IsometricFunnel/SummaryPanel already render for
// a currently-tracked campaign, so app/campaign/[id]/page.tsx can plug it into
// those SAME components rather than a separate lighter view. Landing-page
// engagement and Clarity friction have no historical per-month store at all
// (see the conversation this was scoped in) — callers render those panels
// with a clearly-marked "not available" state instead of fake zeros.
export async function buildHistoricalCampaign(campaignId: string, year: number, month: number): Promise<FunnelCampaign | null> {
  const row = await getFullMonthlyRow(campaignId, year, month);
  if (!row) return null;

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const dailyRows = await getCampaignDailyRows(campaignId, monthStart, monthEnd);

  const spend = row.spend;
  const impressions = row.impressions;
  const clicks = row.clicks;
  const link_clicks = row.link_clicks;
  const leadsVerified = row.leads_source === "typeform_verified";
  const leads = leadsVerified ? row.leads ?? 0 : NA;
  const cpl = leadsVerified && row.leads ? spend / row.leads : NA;
  const ctr = row.ctr ?? (impressions > 0 ? clicks / impressions : NA);
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : NA;
  const outbound_ctr = row.outbound_clicks != null && impressions > 0 ? row.outbound_clicks / impressions : NA;
  const engagement = row.engagement ?? NA;

  const starts = row.starts ?? NA;
  const completions = leadsVerified ? row.leads ?? 0 : 0; // 0, not NaN — feeds the isometric funnel's cube count directly
  const completion_rate = row.starts && row.starts > 0 && leadsVerified ? (row.leads ?? 0) / row.starts : NA;

  const daily = dailyRows.map((d) => ({
    date: d.date,
    spend: d.spend,
    impressions: d.impressions,
    clicks: d.clicks,
    link_clicks: d.link_clicks,
    leads: d.leads,
    video_plays: 0,
    engagement: NA,
    ctr: d.ctr,
    outbound_ctr: NA,
    cpl: d.cpl,
  }));

  const campaign: FunnelCampaign = {
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    property: row.property,
    ref: row.ref,
    campaign_type: row.campaign_type === "community" ? "community" : "property",
    status: (row.status === "ACTIVE" || row.status === "PAUSED" || row.status === "ARCHIVED" ? row.status : "ARCHIVED"),
    meta: {
      id: row.campaign_id,
      name: row.campaign_name,
      status: (row.status === "ACTIVE" || row.status === "PAUSED" || row.status === "ARCHIVED" ? row.status : "ARCHIVED"),
      start_date: row.start_date ?? UNAVAILABLE_DATE,
      stop_date: row.stop_date ?? UNAVAILABLE_DATE,
      spend,
      impressions,
      clicks,
      link_clicks,
      leads,
      video_plays: NA,
      engagement,
      cpm,
      ctr,
      cpl,
      outbound_ctr,
      daily,
      by_platform: [],
      by_device: [],
    },
    typeform: {
      form_id: row.form_id ?? "",
      form_name: row.form_name ?? "",
      views: NA, // Typeform's API doesn't expose date-scoped form-view counts
      starts,
      completions,
      completion_rate,
      fields: [], // per-field drop-off would need a second Typeform pull; not built
    },
    // No historical per-month store exists for either of these (see doc
    // comment above) — zero-filled using the SAME shape the live app already
    // renders for a real zero-traffic campaign, since there's nowhere to put
    // an "xxx" inside a bar chart. A banner on the page itself explains why.
    landing_engagement: {
      page_views: 0,
      steps: LANDING_SECTION_ORDER.map((section) => ({ section, views: 0, pct_of_page_views: 0 })),
      cta_clicks: 0,
      cta_click_rate: 0,
      events: [],
    },
    clarity: {
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
    },
    derived: {
      click_to_form_start_rate: link_clicks > 0 && row.starts != null ? row.starts / link_clicks : NA,
      form_completion_rate: completion_rate,
      cost_per_qualified_lead: cpl,
    },
  };

  return campaign;
}
