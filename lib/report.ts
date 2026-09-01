// Template-generated narrative bullets for the Meta Ads Monthly Report
// (app/report/page.tsx) — deterministic string-filling, no LLM, same "rule-
// templated narratives" philosophy as lib/insights.ts. Reads the already-
// computed comparison payload from GET /api/history/report (plus, for the
// current live month only, computeInsights output and CRM outcome counts).
// Computes nothing itself beyond simple grouping/counting.
import { Insight } from "@/lib/insights";
import { formatCurrency, formatNumber } from "@/lib/format";
import { CampaignComparisonRow, PortfolioComparison } from "@/lib/history/db";

export interface NarrativeItem {
  headline: string;
  detail: string;
}

function fmtPct(pct: number | null): string {
  if (pct === null) return "";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function portfolioItem(portfolio: PortfolioComparison, campaignCount: number, monthLabel: string): NarrativeItem {
  const { current, deltaVsPreviousMonth: mom, deltaVsPreviousYear: yoy } = portfolio;

  const momParts: string[] = [];
  if (mom.spendPct !== null) momParts.push(`spend ${fmtPct(mom.spendPct)}`);
  if (mom.leadsPct !== null) momParts.push(`leads ${fmtPct(mom.leadsPct)}`);
  if (mom.cplPct !== null) momParts.push(`CPL ${fmtPct(mom.cplPct)}`);

  const yoyParts: string[] = [];
  if (yoy.spendPct !== null) yoyParts.push(`spend ${fmtPct(yoy.spendPct)}`);
  if (yoy.leadsPct !== null) yoyParts.push(`leads ${fmtPct(yoy.leadsPct)}`);
  if (yoy.cplPct !== null) yoyParts.push(`CPL ${fmtPct(yoy.cplPct)}`);

  const sentences: string[] = [
    momParts.length > 0
      ? `${formatNumber(current.leads)} leads at ${formatCurrency(current.cpl, 2)} average cost per lead (${momParts.join(", ")} vs previous month).`
      : `${formatNumber(current.leads)} leads at ${formatCurrency(current.cpl, 2)} average cost per lead. No previous-month data yet to compare against.`,
  ];
  if (yoyParts.length > 0) sentences.push(`Year-over-year: ${yoyParts.join(", ")} vs ${monthLabel.split(" ")[0]} last year.`);

  return {
    headline: `${formatCurrency(current.spend)} spent across ${campaignCount} campaign${campaignCount === 1 ? "" : "s"}`,
    detail: sentences.join(" "),
  };
}

// Best/worst CPL movers among campaigns that ran in both this month and the
// previous one — mirrors BigSEO's "keyword movement" callouts, but for
// campaign efficiency instead of search position.
function moverItems(campaigns: CampaignComparisonRow[]): NarrativeItem[] {
  const withDelta = campaigns.filter((c) => c.deltaCplPct !== null && c.cpl !== null);
  if (withDelta.length === 0) return [];

  const best = withDelta.reduce((a, b) => (b.deltaCplPct! < a.deltaCplPct! ? b : a));
  const worst = withDelta.reduce((a, b) => (b.deltaCplPct! > a.deltaCplPct! ? b : a));

  const items: NarrativeItem[] = [];
  if (best.deltaCplPct! < 0) {
    items.push({
      headline: `${best.property} improved cost per lead the most`,
      detail: `Now at ${formatCurrency(best.cpl, 2)} per lead (${fmtPct(best.deltaCplPct)} vs previous month).`,
    });
  }
  if (worst.campaign_id !== best.campaign_id && worst.deltaCplPct! > 0) {
    items.push({
      headline: `${worst.property} saw cost per lead rise the most`,
      detail: `Now at ${formatCurrency(worst.cpl, 2)} per lead (${fmtPct(worst.deltaCplPct)} vs previous month).`,
    });
  }
  return items;
}

// Live-insight callouts (lib/insights.ts detectors) only apply when the
// report's selected month is the current, still-live month — those
// detectors run on meta.daily[]/typeform.fields/clarity from the live KV
// snapshot, not on historical Supabase rows, so a past month simply gets no
// findings-based bullets here.
function insightItems(insights: Insight[]): NarrativeItem[] {
  if (insights.length === 0) return [];
  const items: NarrativeItem[] = [];
  const critical = insights.filter((i) => i.severity === "critical" || i.severity === "warning");
  items.push({
    headline: `${insights.length} finding${insights.length === 1 ? "" : "s"} from the anomaly detector`,
    detail:
      critical.length > 0
        ? `${critical.length} warning/critical-level: ${critical
            .slice(0, 3)
            .map((i) => `${i.campaign} (${i.title})`)
            .join(", ")}${critical.length > 3 ? ", …" : ""}.`
        : "All lower-priority. See Insights for detail.",
  });

  // The single most-repeated finding title across campaigns — usually a form
  // question or platform issue every campaign shares, which makes it the
  // highest-leverage fix available without spending more.
  const byTitle = new Map<string, Insight[]>();
  for (const i of insights) byTitle.set(i.title, [...(byTitle.get(i.title) ?? []), i]);
  const [commonTitle, commonHits] = [...byTitle.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (commonHits.length >= 2) {
    items.push({
      headline: commonTitle,
      detail: `The month's most consistent finding, flagged across ${commonHits.length} campaigns. Fixing it is the highest-leverage lift available without more ad spend.`,
    });
  }

  return items;
}

function crmItem(crmSummary: { winCount: number; winLabel: string } | null): NarrativeItem[] {
  if (!crmSummary) return [];
  return [
    {
      headline: `${crmSummary.winCount} ${crmSummary.winLabel}${crmSummary.winCount === 1 ? "" : "s"} confirmed via CRM`,
      detail: "CRM outcome tracking is live for most active campaigns. See each campaign's card below for its matched outcomes and known attribution gaps.",
    },
  ];
}

export function buildNarrative(
  portfolio: PortfolioComparison,
  campaigns: CampaignComparisonRow[],
  monthLabel: string,
  liveInsights: Insight[] | null,
  crmSummary: { winCount: number; winLabel: string } | null = null
): NarrativeItem[] {
  return [
    portfolioItem(portfolio, campaigns.length, monthLabel),
    ...moverItems(campaigns),
    ...(liveInsights !== null ? insightItems(liveInsights) : []),
    ...(liveInsights !== null ? crmItem(crmSummary) : []),
  ];
}
