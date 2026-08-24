// Template-generated narrative bullets for the Meta Ads Monthly Report
// (app/report/page.tsx) — deterministic string-filling, no LLM, same "rule-
// templated narratives" philosophy as lib/insights.ts. Reads the already-
// computed comparison payload from GET /api/history/report; does not fetch
// or compute anything itself.
import { Insight } from "@/lib/insights";
import { formatCurrency, formatNumber } from "@/lib/format";
import { CampaignComparisonRow, PortfolioComparison } from "@/lib/history/db";

function fmtPct(pct: number | null): string {
  if (pct === null) return "";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

// Portfolio-level bullets: overall spend/leads/CPL trend vs previous month
// and (when available) vs previous year. Bullets for a metric with no
// previous-period data are simply omitted rather than showing a fake trend.
function portfolioBullets(portfolio: PortfolioComparison, monthLabel: string): string[] {
  const bullets: string[] = [];
  const { current, deltaVsPreviousMonth: mom, deltaVsPreviousYear: yoy } = portfolio;

  const momParts: string[] = [];
  if (mom.spendPct !== null) momParts.push(`spend ${fmtPct(mom.spendPct)}`);
  if (mom.leadsPct !== null) momParts.push(`leads ${fmtPct(mom.leadsPct)}`);
  if (mom.cplPct !== null) momParts.push(`CPL ${fmtPct(mom.cplPct)}`);
  bullets.push(
    momParts.length > 0
      ? `Portfolio spend was ${formatCurrency(current.spend)} generating ${formatNumber(current.leads)} leads in ${monthLabel} (${momParts.join(", ")} vs previous month).`
      : `Portfolio spend was ${formatCurrency(current.spend)} generating ${formatNumber(current.leads)} leads in ${monthLabel} — no previous-month data yet to compare against.`
  );

  const yoyParts: string[] = [];
  if (yoy.spendPct !== null) yoyParts.push(`spend ${fmtPct(yoy.spendPct)}`);
  if (yoy.leadsPct !== null) yoyParts.push(`leads ${fmtPct(yoy.leadsPct)}`);
  if (yoy.cplPct !== null) yoyParts.push(`CPL ${fmtPct(yoy.cplPct)}`);
  if (yoyParts.length > 0) bullets.push(`Year-over-year: ${yoyParts.join(", ")} vs the same month last year.`);

  if (current.cpl !== null) bullets.push(`Average cost per lead landed at ${formatCurrency(current.cpl, 2)}.`);

  return bullets;
}

// Best/worst CPL movers among campaigns that ran in both this month and the
// previous one — mirrors BigSEO's "keyword movement" callouts, but for
// campaign efficiency instead of search position.
function moverBullets(campaigns: CampaignComparisonRow[]): string[] {
  const withDelta = campaigns.filter((c) => c.deltaCplPct !== null && c.cpl !== null);
  if (withDelta.length === 0) return [];

  const best = withDelta.reduce((a, b) => (b.deltaCplPct! < a.deltaCplPct! ? b : a));
  const worst = withDelta.reduce((a, b) => (b.deltaCplPct! > a.deltaCplPct! ? b : a));

  const bullets: string[] = [];
  if (best.deltaCplPct! < 0) {
    bullets.push(`${best.property} improved cost per lead the most: ${formatCurrency(best.cpl, 2)} (${fmtPct(best.deltaCplPct)} vs previous month).`);
  }
  if (worst.campaign_id !== best.campaign_id && worst.deltaCplPct! > 0) {
    bullets.push(`${worst.property} saw cost per lead rise the most: ${formatCurrency(worst.cpl, 2)} (${fmtPct(worst.deltaCplPct)} vs previous month).`);
  }
  return bullets;
}

// Live-insight callouts (lib/insights.ts detectors) only apply when the
// report's selected month is the current, still-live month — those
// detectors run on meta.daily[] from the live KV snapshot, not on historical
// Supabase rows, so a past month simply gets no anomaly bullets here.
function insightBullets(insights: Insight[]): string[] {
  if (insights.length === 0) return [];
  const critical = insights.filter((i) => i.severity === "critical" || i.severity === "warning");
  if (critical.length === 0) return [`${insights.length} lower-priority insight${insights.length === 1 ? "" : "s"} flagged this month — see Insights for detail.`];
  return [
    `${critical.length} campaign${critical.length === 1 ? "" : "s"} flagged a critical/warning-level finding this month: ${critical
      .slice(0, 3)
      .map((i) => `${i.campaign} (${i.title})`)
      .join(", ")}${critical.length > 3 ? ", …" : ""}.`,
  ];
}

export function buildNarrative(
  portfolio: PortfolioComparison,
  campaigns: CampaignComparisonRow[],
  monthLabel: string,
  liveInsights: Insight[] | null
): string[] {
  return [
    ...portfolioBullets(portfolio, monthLabel),
    ...moverBullets(campaigns),
    ...(liveInsights !== null ? insightBullets(liveInsights) : []),
  ];
}
