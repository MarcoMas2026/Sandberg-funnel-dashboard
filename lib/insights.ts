// Rule-based insight engines (ARCHITECTURE.md §4, "statistics dressed as AI") computed
// on-demand in the browser from data the pipeline already collects — no LLM, no n8n
// changes, no history:{campaign_id} snapshots (that's the separate, not-yet-built Phase 1
// enabler for day-of-week-aware rolling baselines). Every number here is read straight off
// FunnelCampaign: meta.daily[] (Meta's own campaign-lifetime daily window, refetched each
// sync — not a fabricated series), typeform.fields, and clarity. Severity/evidence/
// recommendation strings are templates filled with computed values, per the L4 "rule-
// templated narratives" design — deterministic and auditable, nothing generated.
import { FunnelCampaign, MetaDailyRow } from "./types";

export type Severity = "critical" | "warning" | "opportunity" | "info";

export interface Insight {
  id: string;
  severity: Severity;
  type: string;
  campaign_id: string;
  campaign: string;
  title: string;
  evidence: string;
  recommendation: string;
  detected_at: string;
  trend: number[]; // small evidence sparkline
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function daysAgo(date: string): number {
  return Math.floor((Date.now() - new Date(date + "T00:00:00Z").getTime()) / 86400000);
}

const MIN_MEANINGFUL_SPEND = 5; // EUR — ignore near-zero test/leftover days

function trackingBreaks(c: FunnelCampaign): Insight[] {
  const hit = [...c.meta.daily].reverse().find((d) => d.spend > MIN_MEANINGFUL_SPEND && d.link_clicks === 0);
  if (!hit) return [];
  const age = daysAgo(hit.date);
  return [
    {
      id: `track-${c.campaign_id}`,
      severity: age <= 2 ? "critical" : "warning",
      type: "Tracking",
      campaign_id: c.campaign_id,
      campaign: c.campaign_name,
      title: "Spend recorded with zero link clicks",
      evidence: `€${hit.spend.toFixed(2)} spent on ${hit.date} with 0 link clicks (${hit.impressions.toLocaleString()} impressions). Possible pixel, placement, or landing-page outage.`,
      recommendation: "Check the ad's destination URL loads and the Meta pixel is firing on the landing page.",
      detected_at: new Date().toISOString(),
      trend: c.meta.daily.slice(-7).map((d) => d.link_clicks),
    },
  ];
}

function zeroLeadDay(c: FunnelCampaign): Insight[] {
  const spendDays = c.meta.daily.filter((d) => d.spend > MIN_MEANINGFUL_SPEND);
  if (spendDays.length < 5) return [];
  const leadCounts = spendDays.map((d) => d.leads);
  const m = mean(leadCounts);
  const sd = stddev(leadCounts);
  if (sd === 0) return [];
  const hit = [...spendDays].reverse().find((d) => {
    const z = (d.leads - m) / sd;
    return d.leads === 0 && z <= -1.5;
  });
  if (!hit) return [];
  const age = daysAgo(hit.date);
  return [
    {
      id: `zerolead-${c.campaign_id}`,
      severity: age <= 2 ? "critical" : "warning",
      type: "Anomaly",
      campaign_id: c.campaign_id,
      campaign: c.campaign_name,
      title: "Zero-lead day while spending",
      evidence: `€${hit.spend.toFixed(2)} spent on ${hit.date} with 0 form submissions. The campaign's spending days otherwise average ${m.toFixed(1)} leads/day (σ=${sd.toFixed(1)}).`,
      recommendation: "Verify the Typeform embed loads on the landing page and traffic is reaching it.",
      detected_at: new Date().toISOString(),
      trend: spendDays.slice(-7).map((d) => d.leads),
    },
  ];
}

function ctrFatigue(c: FunnelCampaign): Insight[] {
  const days = c.meta.daily.filter((d) => d.impressions > 0);
  if (days.length < 14) return [];
  const recent = days.slice(-7);
  const prior = days.slice(-14, -7);
  const recentAvg = mean(recent.map((d) => d.ctr));
  const priorAvg = mean(prior.map((d) => d.ctr));
  if (priorAvg <= 0) return [];
  const decline = (priorAvg - recentAvg) / priorAvg;
  if (decline < 0.15) return [];
  return [
    {
      id: `fatigue-${c.campaign_id}`,
      severity: decline >= 0.3 ? "warning" : "info",
      type: "Fatigue",
      campaign_id: c.campaign_id,
      campaign: c.campaign_name,
      title: "Campaign CTR declining",
      evidence: `CTR down ${(decline * 100).toFixed(0)}% over the last 7 days (${(recentAvg * 100).toFixed(2)}% vs ${(priorAvg * 100).toFixed(2)}% the previous 7). Campaign-level trend, no per-ad breakdown yet, so this may reflect one tired creative or all of them.`,
      recommendation: "Review the ad set's creatives in Ads Manager; rotate the oldest-running one first.",
      detected_at: new Date().toISOString(),
      trend: days.slice(-14).map((d) => d.ctr * 100),
    },
  ];
}

function cplEfficiency(campaigns: FunnelCampaign[]): Insight[] {
  const stats = campaigns.map((c) => {
    const last7 = c.meta.daily.slice(-7);
    const spend7 = last7.reduce((s, d) => s + d.spend, 0);
    const leads7 = last7.reduce((s, d) => s + d.leads, 0);
    return { c, spend7, leads7, cpl7: leads7 > 0 ? spend7 / leads7 : null };
  });
  const valid = stats.filter((s) => s.cpl7 !== null && s.leads7 >= 2);
  if (valid.length < 2) return [];
  const portfolioAvg = mean(valid.map((s) => s.cpl7 as number));

  const out: Insight[] = [];
  for (const s of valid) {
    const cpl = s.cpl7 as number;
    if (cpl <= portfolioAvg * 0.7) {
      out.push({
        id: `cpl-low-${s.c.campaign_id}`,
        severity: "opportunity",
        type: "Budget pacing",
        campaign_id: s.c.campaign_id,
        campaign: s.c.campaign_name,
        title: "Below-average cost per lead",
        evidence: `Trailing 7-day CPL is €${cpl.toFixed(2)} vs the €${portfolioAvg.toFixed(2)} portfolio average across active campaigns, on ${s.leads7} leads.`,
        recommendation: "Consider shifting incremental daily budget here before less efficient campaigns.",
        detected_at: new Date().toISOString(),
        trend: s.c.meta.daily.slice(-7).map((d) => d.cpl),
      });
    } else if (cpl >= portfolioAvg * 1.4) {
      out.push({
        id: `cpl-high-${s.c.campaign_id}`,
        severity: "warning",
        type: "Budget pacing",
        campaign_id: s.c.campaign_id,
        campaign: s.c.campaign_name,
        title: "Above-average cost per lead",
        evidence: `Trailing 7-day CPL is €${cpl.toFixed(2)} vs the €${portfolioAvg.toFixed(2)} portfolio average across active campaigns, on ${s.leads7} leads.`,
        recommendation: "Investigate targeting/creative before adding more budget here.",
        detected_at: new Date().toISOString(),
        trend: s.c.meta.daily.slice(-7).map((d) => d.cpl),
      });
    }
  }
  return out;
}

function landingFriction(c: FunnelCampaign): Insight[] {
  const cl = c.clarity;
  if (cl.sessions < 20) return [];
  const flags: string[] = [];
  if (cl.rage_click_pct >= 8) flags.push(`${cl.rage_click_pct.toFixed(1)}% rage clicks`);
  if (cl.dead_click_pct >= 8) flags.push(`${cl.dead_click_pct.toFixed(1)}% dead clicks`);
  if (cl.quickback_pct >= 40) flags.push(`${cl.quickback_pct.toFixed(1)}% quickbacks`);
  if (!flags.length) return [];
  return [
    {
      id: `friction-${c.campaign_id}`,
      severity: "warning",
      type: "Landing page",
      campaign_id: c.campaign_id,
      campaign: c.campaign_name,
      title: "Landing page friction detected",
      evidence: `Across ${cl.sessions} recorded sessions: ${flags.join(", ")}, from Clarity's own session recordings, not modeled.`,
      recommendation: "Watch a handful of Clarity session recordings for this page to find the friction point.",
      detected_at: new Date().toISOString(),
      trend: [],
    },
  ];
}

function formDropoff(c: FunnelCampaign): Insight[] {
  const fields = c.typeform.fields.filter((f) => f.views >= 10);
  if (fields.length < 2) return [];
  const others = (excludeId: string) => fields.filter((f) => f.id !== excludeId);
  const worst = [...fields].sort((a, b) => b.dropoff_rate - a.dropoff_rate)[0];
  const restAvg = mean(others(worst.id).map((f) => f.dropoff_rate));
  if (worst.dropoff_rate < 0.15 || worst.dropoff_rate < restAvg * 2) return [];
  return [
    {
      id: `dropoff-${c.campaign_id}`,
      severity: "opportunity",
      type: "Form friction",
      campaign_id: c.campaign_id,
      campaign: c.campaign_name,
      title: `High drop-off on "${worst.label}"`,
      evidence: `${(worst.dropoff_rate * 100).toFixed(0)}% of visitors who reach "${worst.label}" leave without continuing, vs ${(restAvg * 100).toFixed(0)}% average for the form's other fields.`,
      recommendation: "Simplify or reorder this question, or make it optional.",
      detected_at: new Date().toISOString(),
      trend: [],
    },
  ];
}

function spendPacing(c: FunnelCampaign): Insight[] {
  const days = c.meta.daily.filter((d) => d.spend > MIN_MEANINGFUL_SPEND);
  if (days.length < 8) return [];
  const trailing = days.slice(-8, -1);
  const today = days[days.length - 1];
  const avg = mean(trailing.map((d: MetaDailyRow) => d.spend));
  if (avg <= 0) return [];
  const delta = (today.spend - avg) / avg;
  if (Math.abs(delta) < 0.4) return [];
  return [
    {
      id: `pacing-${c.campaign_id}`,
      severity: "info",
      type: "Pacing",
      campaign_id: c.campaign_id,
      campaign: c.campaign_name,
      title: `Daily spend ${delta > 0 ? "above" : "below"} recent average`,
      evidence: `${today.date} spend was €${today.spend.toFixed(2)}, ${Math.abs(delta * 100).toFixed(0)}% ${delta > 0 ? "above" : "below"} the trailing 7-day average of €${avg.toFixed(2)}.`,
      recommendation: delta > 0 ? "Confirm this matches an intended budget change." : "Confirm the ad set isn't budget/audience limited.",
      detected_at: new Date().toISOString(),
      trend: days.slice(-8).map((d) => d.spend),
    },
  ];
}

const SEV_ORDER: Severity[] = ["critical", "warning", "opportunity", "info"];

export function computeInsights(campaigns: FunnelCampaign[]): Insight[] {
  const active = campaigns.filter((c) => c.status === "ACTIVE");
  const perCampaign = active.flatMap((c) => [
    ...trackingBreaks(c),
    ...zeroLeadDay(c),
    ...ctrFatigue(c),
    ...landingFriction(c),
    ...formDropoff(c),
    ...spendPacing(c),
  ]);
  const portfolio = cplEfficiency(active);
  return [...perCampaign, ...portfolio].sort(
    (a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)
  );
}

// Portfolio Health (Mission Control ring gauge): a 0-100 composite built from the same
// insight feed above — not a separate model. Each active campaign starts at 100 and takes
// a fixed deduction per open finding, scaled by severity; the portfolio score is the
// average across active campaigns. Deliberately simple/auditable over statistically fancy:
// every point lost traces back to a specific, visible card on /insights.
const HEALTH_PENALTY: Record<Severity, number> = {
  critical: 30,
  warning: 15,
  opportunity: 5,
  info: 5,
};

export function computePortfolioHealth(campaigns: FunnelCampaign[], insights: Insight[]): number | null {
  const active = campaigns.filter((c) => c.status === "ACTIVE");
  if (active.length === 0) return null;

  const scores = active.map((c) => {
    const penalty = insights
      .filter((i) => i.campaign_id === c.campaign_id)
      .reduce((sum, i) => sum + HEALTH_PENALTY[i.severity], 0);
    return Math.max(0, 100 - penalty);
  });

  return Math.round(mean(scores));
}
