import { FunnelCampaign, HistoricalCampaign, MetaDailyRow } from "./types";

// Historical records only carry campaign-lifetime totals — no day-by-day
// breakdown, no video/engagement split. To show the full graphs + funnel UI
// (which needs both) for a campaign that isn't in the live feed, this
// spreads each real total across a modeled multi-day curve. The curve shape
// is a deterministic pseudo-random walk (seeded from the campaign id) so it
// renders identically on the server and client — no hydration mismatch —
// and every day's numbers sum exactly back to the real recorded total.
// Anything genuinely unknown (start/stop dates, per-day split) is modeled;
// anything with a real total (spend, leads, clicks, impressions, CTR, CPL)
// is never invented, only redistributed.

function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function seedFromString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

// Splits `total` across `days` values that sum exactly back to `total`,
// following a smooth-ish random weight curve (never all-zero, never wildly
// spiky) so charts look like real campaign pacing rather than flat noise.
function distribute(total: number, weights: number[], round: boolean): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (weightSum > 0 ? (w / weightSum) * total : total / weights.length));
  if (!round) return raw;
  const floored = raw.map((v) => Math.floor(v));
  let remainder = Math.round(total - floored.reduce((a, b) => a + b, 0));
  const order = [...floored.keys()].sort((a, b) => raw[b] - floored[b] - (raw[a] - floored[a]));
  for (let i = 0; i < order.length && remainder > 0; i++, remainder--) floored[order[i]] += 1;
  return floored;
}

const DAYS = 14;

export function buildPreviewFunnelCampaign(h: HistoricalCampaign, today: string): FunnelCampaign {
  const rand = seededRandom(seedFromString(h.campaign_id));
  const weights = Array.from({ length: DAYS }, () => 0.4 + rand());

  const spendDaily = distribute(h.spend, weights, false);
  const impressionsDaily = distribute(h.impressions, weights, true);
  const clicksDaily = distribute(h.clicks, weights, true);
  const linkClicksDaily = distribute(h.link_clicks, weights, true);
  const leadsDaily = distribute(h.leads, weights, true);

  const startDate = new Date(today + "T00:00:00Z");
  startDate.setUTCDate(startDate.getUTCDate() - (DAYS - 1));

  const daily: MetaDailyRow[] = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    const impressions = impressionsDaily[i];
    const linkClicks = linkClicksDaily[i];
    const leads = leadsDaily[i];
    const spend = spendDaily[i];
    return {
      date: d.toISOString().slice(0, 10),
      spend,
      impressions,
      clicks: clicksDaily[i],
      link_clicks: linkClicks,
      leads,
      video_plays: 0,
      engagement: 0,
      ctr: impressions > 0 ? clicksDaily[i] / impressions : 0,
      outbound_ctr: impressions > 0 ? linkClicks / impressions : 0,
      cpl: leads > 0 ? spend / leads : 0,
    };
  });

  return {
    campaign_id: h.campaign_id,
    campaign_name: h.campaign_name,
    property: h.property,
    ref: h.ref,
    campaign_type: h.campaign_type,
    status: "ACTIVE",
    meta: {
      id: h.campaign_id,
      name: h.campaign_name,
      status: "ACTIVE",
      start_date: daily[0].date,
      stop_date: null,
      spend: h.spend,
      impressions: h.impressions,
      clicks: h.clicks,
      link_clicks: h.link_clicks,
      leads: h.leads,
      video_plays: 0,
      engagement: h.clicks, // closest real proxy to on-ad engagement for community campaigns
      cpm: h.impressions > 0 ? (h.spend / h.impressions) * 1000 : 0,
      ctr: h.ctr,
      cpl: h.cpl,
      outbound_ctr: h.impressions > 0 ? h.link_clicks / h.impressions : 0,
      daily,
    },
    typeform: {
      form_id: h.campaign_id,
      form_name: h.campaign_name,
      views: h.link_clicks,
      starts: h.starts,
      completions: h.leads,
      completion_rate: h.form_completion_rate,
      fields: [],
    },
    derived: {
      click_to_form_start_rate: h.click_to_form_start_rate,
      form_completion_rate: h.form_completion_rate,
      cost_per_qualified_lead: h.cpl,
    },
  };
}
