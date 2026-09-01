"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboard } from "@/lib/dashboard-context";
import { formatCurrency, formatNumber, formatPercent, formatDate } from "@/lib/format";
import { CountUp, DeltaChip, Pill, Sparkline } from "@/components/viz";
import { GlowPanel } from "@/components/ui/glow-panel";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { computeInsights, Insight, Severity } from "@/lib/insights";
import { buildNarrative } from "@/lib/report";
import { CRM_EVENT_TYPES } from "@/lib/crm/events";
import { DownloadSimple } from "@phosphor-icons/react";
import {
  ReportCampaignDetail,
  CampaignSnapshotPayload,
  BreakdownRow,
  AnswerBucket,
  buildLiveCampaignDetail,
  buildSnapshotCampaignDetail,
  sumBreakdowns,
  mergeAnswerPatterns,
} from "@/lib/report/detail";
import type { CampaignComparisonRow, PortfolioComparison, PortfolioMonthPoint, DailyRow } from "@/lib/history/db";
import type { LeadRecord } from "@/lib/types";

interface ReportPayload {
  connected: boolean;
  portfolio: PortfolioComparison | null;
  trend: PortfolioMonthPoint[];
  campaigns: CampaignComparisonRow[];
}

interface CrmOutcomesPayload {
  connected: boolean;
  campaigns: { campaign_id: string; campaign_name: string; property: string; counts: Record<string, number> }[];
  unattributed: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Same palette as /curve (app/curve/page.tsx) — kept in sync manually since
// there's no shared constants module for chart colors yet.
const PALETTE = ["#6366f1", "#22c55e", "#ec4899", "#f5b942", "#a855f7", "#38bdf8", "#f97362", "#94a3b8", "#14b8a6", "#f472b6"];

const SEV: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  warning: { label: "Warning", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  opportunity: { label: "Opportunity", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  info: { label: "Info", color: "#7a9bff", bg: "rgba(122,155,255,0.1)" },
};

export default function MetaAdsReportPage() {
  const { data } = useDashboard();

  const [selMonth, setSelMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // 0-indexed, matches Mission Control
  });
  const monthLabel = `${MONTH_NAMES[selMonth.month]} ${selMonth.year}`;
  const isCurrentLiveMonth = useMemo(() => {
    const now = new Date();
    return selMonth.year === now.getFullYear() && selMonth.month === now.getMonth();
  }, [selMonth]);
  const monthBounds = useMemo(() => {
    const start = `${selMonth.year}-${String(selMonth.month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(selMonth.year, selMonth.month + 1, 0).getDate();
    const end = `${selMonth.year}-${String(selMonth.month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  }, [selMonth]);

  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/history/report?year=${selMonth.year}&month=${selMonth.month + 1}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setPayload)
      .catch(() => setPayload({ connected: false, portfolio: null, trend: [], campaigns: [] }))
      .finally(() => setLoading(false));
  }, [selMonth]);

  // Anomaly/pacing/fatigue detectors only run on live meta.daily[] (see
  // lib/insights.ts) — they have nothing to compute against for a past
  // calendar month pulled from Supabase, so those bullets only appear when
  // the report is showing the current, still-live month.
  const liveInsights = useMemo(() => {
    if (!isCurrentLiveMonth || !data) return null;
    return computeInsights(data.campaigns.filter((c) => c.status === "ACTIVE"));
  }, [isCurrentLiveMonth, data]);

  // ── deep per-campaign detail (platform/device, Typeform drop-off, landing
  // engagement, Clarity, lead answer patterns, CRM outcomes). For the current
  // live month, a campaign still in the roster uses live /api/funnel data
  // (freshest); everything else — including every campaign, live or not,
  // once the selected month has closed — reads its own (year, month) row from
  // the Supabase snapshot tables (db/migrations/007), which capture real
  // month-scoped detail on every sync while a campaign is active. A month
  // simply predating that capture (or a campaign that never got a row that
  // month) falls back to the "unavailable" state per campaign — see
  // lib/report/detail.ts. Clarity has no historical store at all (rolling
  // 24h snapshot only), so it's genuinely live-month-only regardless.
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  useEffect(() => {
    if (!isCurrentLiveMonth) {
      setLeads([]);
      return;
    }
    fetch("/api/leads", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setLeads(json.leads ?? []))
      .catch(() => setLeads([]));
  }, [isCurrentLiveMonth]);

  // CRM outcome counts are all-time (not month-scoped) regardless of which
  // month is selected — see the caveat text next to where they're rendered.
  const [crm, setCrm] = useState<CrmOutcomesPayload | null>(null);
  useEffect(() => {
    fetch("/api/crm/outcomes", { cache: "no-store" })
      .then((r) => r.json())
      .then(setCrm)
      .catch(() => setCrm(null));
  }, []);

  // Campaigns whose deep detail must come from the Supabase snapshot rather
  // than live /api/funnel data: for the live month, just whichever campaigns
  // already rotated out of lib/config.ts; for a closed past month, every
  // campaign (live data is always "right now," never scoped to a past month).
  const liveCampaignIds = useMemo(() => new Set((data?.campaigns ?? []).map((c) => c.campaign_id)), [data]);
  const snapshotIds = useMemo(() => {
    if (!payload) return [];
    if (isCurrentLiveMonth) return payload.campaigns.filter((c) => !liveCampaignIds.has(c.campaign_id)).map((c) => c.campaign_id);
    return payload.campaigns.map((c) => c.campaign_id);
  }, [isCurrentLiveMonth, payload, liveCampaignIds]);
  const snapshotIdsKey = snapshotIds.join(",");
  // Only current-month snapshot fetches can rely on "latest row" — a past
  // month must pin the exact (year, month) so it never picks up a later
  // month's numbers once that later month has its own synced row.
  const snapshotYm = isCurrentLiveMonth ? "" : `&year=${selMonth.year}&month=${selMonth.month + 1}`;

  const [snapshots, setSnapshots] = useState<Record<string, CampaignSnapshotPayload>>({});
  useEffect(() => {
    if (!snapshotIdsKey) {
      setSnapshots({});
      return;
    }
    let cancelled = false;
    Promise.all(
      snapshotIdsKey.split(",").map((id) =>
        fetch(`/api/history/campaign-detail-snapshot?campaignId=${id}${snapshotYm}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((json) => [id, json] as const)
          .catch(() => [id, null] as const)
      )
    ).then((entries) => {
      if (cancelled) return;
      const map: Record<string, CampaignSnapshotPayload> = {};
      for (const [id, json] of entries) if (json && json.connected) map[id] = json;
      setSnapshots(map);
    });
    return () => {
      cancelled = true;
    };
  }, [snapshotIdsKey, snapshotYm]);

  const campaignDetails = useMemo(() => {
    if (!payload) return {} as Record<string, ReportCampaignDetail>;
    const map: Record<string, ReportCampaignDetail> = {};
    const liveById = new Map((data?.campaigns ?? []).map((c) => [c.campaign_id, c]));
    for (const row of payload.campaigns) {
      const live = isCurrentLiveMonth ? liveById.get(row.campaign_id) : undefined;
      if (live) {
        const monthLeads = leads.filter(
          (l) => l.campaign_id === row.campaign_id && l.submitted_at && l.submitted_at.slice(0, 10) >= monthBounds.start && l.submitted_at.slice(0, 10) <= monthBounds.end
        );
        map[row.campaign_id] = buildLiveCampaignDetail(live, monthLeads);
      } else {
        const snap = snapshots[row.campaign_id];
        if (snap) map[row.campaign_id] = buildSnapshotCampaignDetail(snap, row.spend, monthBounds.start, monthBounds.end);
      }
    }
    return map;
  }, [isCurrentLiveMonth, payload, data, leads, snapshots, monthBounds]);

  const portfolioByPlatform = useMemo(() => sumBreakdowns(Object.values(campaignDetails).map((d) => d.byPlatform)), [campaignDetails]);
  const portfolioByDevice = useMemo(() => sumBreakdowns(Object.values(campaignDetails).map((d) => d.byDevice)), [campaignDetails]);
  const portfolioAnswers = useMemo(() => mergeAnswerPatterns(Object.values(campaignDetails).map((d) => d.answers)), [campaignDetails]);

  const crmCountsByCampaign = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const c of crm?.campaigns ?? []) m[c.campaign_id] = c.counts;
    return m;
  }, [crm]);
  const crmWinSummary = useMemo(() => {
    if (!crm) return null;
    const winCount = crm.campaigns.reduce((s, c) => s + (c.counts["QualifiedBuyerLead"] ?? 0), 0);
    return { winCount, winLabel: "Qualified Buyer Lead" };
  }, [crm]);

  const narrative = useMemo(() => {
    if (!payload?.portfolio) return [];
    return buildNarrative(payload.portfolio, payload.campaigns, monthLabel, liveInsights, crmWinSummary);
  }, [payload, monthLabel, liveInsights, crmWinSummary]);

  // Every campaign with spend in the selected month — the line set for the
  // two daily-performance charts below. Sourced from payload.campaigns (same
  // set the breakdown table shows) rather than a separate query.
  const campaignIds = useMemo(() => (payload?.campaigns ?? []).map((c) => c.campaign_id), [payload]);
  const campaignIdsKey = campaignIds.join(",");
  const campaignById = useMemo(() => new Map((payload?.campaigns ?? []).map((c) => [c.campaign_id, c])), [payload]);

  // Full daily history per campaign (reuses /curve's endpoint — all-time,
  // any status) — filtered down to the selected calendar month below rather
  // than fetched per-month, since the underlying query is already cheap and
  // this keeps a single fetch per campaign-set change.
  const [dailySeries, setDailySeries] = useState<Record<string, DailyRow[]>>({});
  const [dailyLoading, setDailyLoading] = useState(false);
  useEffect(() => {
    if (!campaignIdsKey) {
      setDailySeries({});
      return;
    }
    setDailyLoading(true);
    fetch(`/api/history/campaign-series?ids=${campaignIdsKey}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setDailySeries(json.series ?? {}))
      .catch(() => setDailySeries({}))
      .finally(() => setDailyLoading(false));
  }, [campaignIdsKey]);

  // One row per calendar day (1st through the month's last day), each
  // campaign's spend/leads for that date keyed as `${campaignId}__spend` /
  // `${campaignId}__leads` — a day a campaign didn't run yet/anymore is left
  // `null` so its line doesn't draw a fake zero.
  const dailyChartData = useMemo(() => {
    const daysInMonth = new Date(selMonth.year, selMonth.month + 1, 0).getDate();
    const byCampaignByDate = new Map<string, Map<string, DailyRow>>();
    for (const id of campaignIds) {
      const map = new Map<string, DailyRow>();
      for (const row of dailySeries[id] ?? []) map.set(row.date, row);
      byCampaignByDate.set(id, map);
    }
    const rows: Record<string, number | string | null>[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selMonth.year}-${String(selMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const row: Record<string, number | string | null> = { day, date: dateStr };
      for (const id of campaignIds) {
        const d = byCampaignByDate.get(id)?.get(dateStr);
        row[`${id}__spend`] = d ? d.spend : null;
        row[`${id}__leads`] = d ? d.leads : null;
      }
      rows.push(row);
    }
    return rows;
  }, [selMonth, campaignIds, dailySeries]);

  const sparkFor = (id: string, key: "spend" | "leads") => dailyChartData.map((r) => (r[`${id}__${key}`] as number) ?? 0);

  const campaignInsightsFor = (campaignId: string) => (liveInsights ?? []).filter((i) => i.campaign_id === campaignId);

  if (loading && !payload) {
    return (
      <div className="space-y-7">
        <Skeleton className="h-9 w-72" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 print:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const portfolio = payload?.portfolio;
  const connected = payload?.connected ?? false;

  return (
    <div className="report-page space-y-7">
      <div className="fade-up relative z-30 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-[var(--text)] sm:text-4xl">Meta Ads Monthly Report</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {payload ? `${payload.campaigns.length} campaign${payload.campaigns.length === 1 ? "" : "s"} with spend in ${monthLabel}` : monthLabel}
          </p>
          <p className="mt-1 text-xs text-[var(--text-faint)]">Report generated {formatDate(new Date().toISOString())}</p>
        </div>
        <div className="print-hide flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="panel flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text)]"
          >
            <DownloadSimple className="h-4 w-4" />
            Download PDF
          </button>
          <ReportMonthPicker year={selMonth.year} month={selMonth.month} onChange={(year, month) => setSelMonth({ year, month })} />
        </div>
      </div>

      {!connected && (
        <GlowPanel className="panel p-5 text-sm text-[var(--text-muted)]">
          History isn&apos;t connected. This report needs Supabase (funnel_daily_history / funnel_monthly_totals) to compute month-over-month
          comparisons.
        </GlowPanel>
      )}

      {connected && !isCurrentLiveMonth && (
        <GlowPanel className="panel p-4 text-xs text-[var(--text-faint)]">
          {monthLabel} is a closed month: platform/device, Typeform funnel, landing-page, lead-answer and CRM detail below are read from that
          month&apos;s own synced snapshot where available. Microsoft Clarity and the anomaly-detector findings have no historical store, so those
          two stay live-month-only.
        </GlowPanel>
      )}

      {portfolio && (
        <>
          {/* portfolio overview */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 print:grid-cols-3">
            <OverviewCard
              label="Total Spend"
              accent="#02bbbb"
              value={<CountUp value={portfolio.current.spend} format={(v) => formatCurrency(v)} />}
              momPct={portfolio.deltaVsPreviousMonth.spendPct}
              yoyPct={portfolio.deltaVsPreviousYear.spendPct}
              goodWhenUp
            />
            <OverviewCard
              label="Leads (submissions)"
              accent="#02bbbb"
              value={<CountUp value={portfolio.current.leads} format={(v) => formatNumber(v)} />}
              momPct={portfolio.deltaVsPreviousMonth.leadsPct}
              yoyPct={portfolio.deltaVsPreviousYear.leadsPct}
              goodWhenUp
            />
            <OverviewCard
              label="Avg Cost / Lead"
              accent="#c1dfdf"
              value={<CountUp value={portfolio.current.cpl ?? 0} format={(v) => formatCurrency(v, 2)} />}
              momPct={portfolio.deltaVsPreviousMonth.cplPct}
              yoyPct={portfolio.deltaVsPreviousYear.cplPct}
              goodWhenUp={false}
            />
          </div>

          {/* narrative summary */}
          {narrative.length > 0 && (
            <GlowPanel wrapperClassName="fade-up" className="panel p-5">
              <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">The month at a glance</h2>
              <ul className="mt-3 flex flex-col">
                {narrative.map((item, i) => (
                  <li key={i} className={`flex gap-3 py-3 ${i === 0 ? "" : "border-t border-[var(--border)]"}`}>
                    <span className="mt-1 h-full w-[3px] shrink-0 self-stretch rounded-full bg-[var(--accent,#02bbbb)]" />
                    <div>
                      <p className="text-[15px] font-semibold leading-snug text-[var(--text)]">{item.headline}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </GlowPanel>
          )}

          {/* overall daily performance — portfolio total per day, not broken out by campaign */}
          {campaignIds.length > 0 && (
            <>
              <OverallDailyChart
                title="Spend by Day"
                metricKey="spend"
                data={dailyChartData}
                campaignIds={campaignIds}
                campaignById={campaignById}
                loading={dailyLoading}
                valueFormat={(v) => formatCurrency(v)}
                color="#02bbbb"
              />
              <OverallDailyChart
                title="Leads by Day"
                metricKey="leads"
                data={dailyChartData}
                campaignIds={campaignIds}
                campaignById={campaignById}
                loading={dailyLoading}
                valueFormat={(v) => formatNumber(v)}
                color="#f5b942"
              />
            </>
          )}

          {/* per-campaign breakdown */}
          <GlowPanel wrapperClassName="fade-up" className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text)]">Campaign Breakdown</h2>
              <Pill label={monthLabel} active={false} />
            </div>
            {payload!.campaigns.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)]">No campaign data for {monthLabel}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                      <th className="pb-2 pl-1">Campaign</th>
                      <th className="pb-2 text-right">Spend</th>
                      <th className="pb-2 text-right">Leads</th>
                      <th className="pb-2 pr-1 text-right">Cost / Lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload!.campaigns
                      .slice()
                      .sort((a, b) => b.spend - a.spend)
                      .map((c) => (
                        <tr key={c.campaign_id} className="border-t border-[var(--border)]">
                          <td className="py-3 pl-1">
                            <span className="font-medium text-[var(--text)]">{c.property}</span>
                          </td>
                          <MetricCell value={formatCurrency(c.spend)} pct={c.deltaSpendPct} goodWhenUp />
                          <MetricCell value={formatNumber(c.leads)} pct={c.deltaLeadsPct} goodWhenUp />
                          <MetricCell last value={formatCurrency(c.cpl, 2)} pct={c.deltaCplPct} goodWhenUp={false} />
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlowPanel>

          {/* portfolio-wide delivery breakdown — any month with snapshot detail */}
          {(portfolioByPlatform.length > 0 || portfolioByDevice.length > 0) && (
            <GlowPanel wrapperClassName="fade-up" className="panel p-5">
              <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Platform &amp; Device Delivery</h2>
              <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2">
                <BreakdownGroup title="By platform" rows={portfolioByPlatform} valueFormat={(r) => formatCurrency(r.spend)} />
                <BreakdownGroup title="By device" rows={portfolioByDevice} valueFormat={(r) => formatCurrency(r.spend)} />
              </div>
            </GlowPanel>
          )}

          {/* full per-campaign detail — any month with snapshot detail */}
          {payload!.campaigns.length > 0 && (
            <div className="fade-up space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">Campaign by Campaign</h2>
                <p className="mt-1 text-xs text-[var(--text-faint)]">
                  Full platform, device, funnel, Typeform-answer and lead-quality detail for every campaign with spend this month.
                </p>
              </div>
              {payload!.campaigns
                .slice()
                .sort((a, b) => b.spend - a.spend)
                .map((row) => (
                  <CampaignDetailCard
                    key={row.campaign_id}
                    row={row}
                    detail={campaignDetails[row.campaign_id]}
                    isCurrentLiveMonth={isCurrentLiveMonth}
                    sparkSpend={sparkFor(row.campaign_id, "spend")}
                    sparkLeads={sparkFor(row.campaign_id, "leads")}
                    crmCounts={crmCountsByCampaign[row.campaign_id] ?? {}}
                    insights={campaignInsightsFor(row.campaign_id)}
                  />
                ))}
            </div>
          )}

          {/* portfolio-wide Typeform answer patterns — any month with snapshot detail */}
          {portfolioAnswers.respondents > 0 && (
            <GlowPanel wrapperClassName="fade-up" className="panel p-5">
              <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">What Buyers Are Telling Us</h2>
              <p className="text-xs text-[var(--text-faint)]">
                Aggregated across {portfolioAnswers.respondents} verified Typeform submissions this month, across {payload!.campaigns.length}{" "}
                campaigns.
              </p>
              <div className="mt-4 grid gap-6 md:grid-cols-2 print:grid-cols-2">
                <div>
                  <AnswerGroup title="Investment budget" buckets={portfolioAnswers.budget} />
                  <AnswerGroup title="Buying timeline" buckets={portfolioAnswers.timeline} />
                </div>
                <div>
                  <AnswerGroup title="Search stage" buckets={portfolioAnswers.stage} />
                  <AnswerGroup title="Preferred language" buckets={portfolioAnswers.language} />
                </div>
              </div>
            </GlowPanel>
          )}

          {/* insights & anomalies — live month only */}
          {isCurrentLiveMonth && liveInsights && liveInsights.length > 0 && (
            <GlowPanel wrapperClassName="fade-up" className="panel p-5">
              <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">What the Detectors Found</h2>
              <p className="text-xs text-[var(--text-faint)]">
                Rule-based findings computed live from Meta, Typeform and landing-page data: anomalies, fatigue, pacing and opportunities. No
                LLM; every number here is deterministic and re-computable from the data above.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 print:grid-cols-2">
                {liveInsights.map((ins) => (
                  <InsightRow key={ins.id} insight={ins} />
                ))}
              </div>
            </GlowPanel>
          )}

          {/* methodology */}
          <GlowPanel wrapperClassName="fade-up" className="panel p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Methodology</h2>
            <dl className="space-y-4">
              <MethodologyItem term="Scope">
                All Meta ad campaigns for Sandberg Estates properties and communities with spend during {monthLabel}. Organic social (the Social
                module) is a separate, non-paid pipeline and is intentionally excluded.
              </MethodologyItem>
              <MethodologyItem term="Spend, leads & CPL">
                Meta totals are the platform&apos;s own campaign-lifetime aggregate, never a sum of daily rows (the daily breakdown under-reports
                by roughly 5%). &quot;Leads&quot; are verified Typeform completions, not Meta&apos;s lead pixel. Cost per lead is Meta spend ÷
                Typeform submissions.
              </MethodologyItem>
              <MethodologyItem term="Platform, device, funnel & lead-answer detail">
                Captured continuously while a campaign is active, and recovered from its latest known snapshot once it rotates out of the active
                roster. Available in full only for the current, still-live month above; a past month you pick from the dropdown shows the lighter
                spend/leads/CPL comparison only.
              </MethodologyItem>
              <MethodologyItem term="Microsoft Clarity">
                Session-replay friction metrics (rage clicks, dead clicks, quick-backs) have no historical store. Only ever available, live, for
                currently-active campaigns.
              </MethodologyItem>
              <MethodologyItem term="CRM outcomes">
                Pulled from the Sandberg CRM and joined back to campaigns by Typeform response id: all-time counts, not scoped to a single
                calendar month. Most post-qualification milestones are wired but blocked by an attribution gap on the CRM&apos;s side; treat a
                zero as a data gap, not a verdict.
              </MethodologyItem>
              <MethodologyItem term="Insights">
                Rule-based detectors (z-score anomalies, trailing-average pacing, threshold-based friction) computed live from today&apos;s data:
                no model, no LLM, fully re-derivable. They only run on currently-active campaigns.
              </MethodologyItem>
            </dl>
          </GlowPanel>
        </>
      )}
    </div>
  );
}

function OverviewCard({
  label,
  accent,
  value,
  momPct,
  yoyPct,
  goodWhenUp,
}: {
  label: string;
  accent: string;
  value: React.ReactNode;
  momPct: number | null;
  yoyPct: number | null;
  goodWhenUp: boolean;
}) {
  return (
    <GlowPanel wrapperClassName="fade-up h-full" className="panel flex h-full flex-col p-5">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-[var(--text)]">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {momPct !== null ? (
          <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]">
            vs last month <DeltaChip pct={momPct} goodWhenUp={goodWhenUp} />
          </span>
        ) : (
          <span className="text-[11px] text-[var(--text-faint)]">no previous-month data</span>
        )}
        {yoyPct !== null && (
          <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]">
            vs last year <DeltaChip pct={yoyPct} goodWhenUp={goodWhenUp} />
          </span>
        )}
      </div>
    </GlowPanel>
  );
}

function MetricCell({ value, pct, goodWhenUp, last }: { value: string; pct: number | null; goodWhenUp: boolean; last?: boolean }) {
  return (
    <td className={`py-3 text-right ${last ? "pr-1" : ""}`}>
      <div className="flex items-center justify-end gap-2">
        <span className="text-[var(--text)]">{value}</span>
        {pct !== null && <DeltaChip pct={pct} goodWhenUp={goodWhenUp} />}
      </div>
    </td>
  );
}

function ReportMonthPicker({ year, month, onChange }: { year: number; month: number; onChange: (year: number, month: number) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const options = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const JUNE = 5;
    const start = currentMonth >= JUNE ? new Date(currentYear, JUNE, 1) : new Date(currentYear - 1, JUNE, 1);
    const list: { year: number; month: number; label: string }[] = [];
    for (let d = new Date(currentYear, currentMonth, 1); d >= start; d.setMonth(d.getMonth() - 1)) {
      list.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) });
    }
    return list;
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="panel flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text)]"
        aria-expanded={open}
      >
        {MONTH_NAMES[month]} {year}
        <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 max-h-64 w-44 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1.5 shadow-lg">
          {options.map((o) => {
            const isActive = o.year === year && o.month === month;
            return (
              <button
                key={`${o.year}-${o.month}`}
                type="button"
                onClick={() => {
                  onChange(o.year, o.month);
                  setOpen(false);
                }}
                className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs ${
                  isActive ? "bg-[var(--panel2)] font-semibold text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--panel2)]"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Prints each bar's own value just above it, rotated vertical so ~31 daily
// labels don't collide — the report downloads as a PDF, which can't show
// the hover tooltip, so the total needs to be readable on the static chart
// itself rather than only on hover.
function BarValueLabel({ x, y, width, value, format }: { x?: number; width?: number; y?: number; value?: number; format: (v: number) => string }) {
  if (value === undefined || value === null || value === 0 || x === undefined || y === undefined || width === undefined) return null;
  const cx = x + width / 2;
  return (
    <text x={cx} y={y - 6} textAnchor="start" transform={`rotate(-90, ${cx}, ${y - 6})`} fontSize={8.5} fill="var(--text-faint)">
      {format(value)}
    </text>
  );
}

// Portfolio total per day (not broken out by campaign), X axis = calendar
// day — a bar for the day's total plus a dashed 7-day trailing average line
// so pacing trends read at a glance. The tooltip still breaks a day down by
// its top contributing campaigns, so nothing from the old per-campaign view
// is actually lost, just moved out of the default chart.
function OverallDailyChart({
  title,
  metricKey,
  data,
  campaignIds,
  campaignById,
  loading,
  valueFormat,
  color,
}: {
  title: string;
  metricKey: "spend" | "leads";
  data: Record<string, number | string | null>[];
  campaignIds: string[];
  campaignById: Map<string, CampaignComparisonRow>;
  loading: boolean;
  valueFormat: (v: number) => string;
  color: string;
}) {
  const totals = useMemo(
    () =>
      data.map((row) => ({
        day: row.day as number,
        total: campaignIds.reduce((s, id) => s + ((row[`${id}__${metricKey}`] as number) ?? 0), 0),
      })),
    [data, campaignIds, metricKey]
  );
  const chartData = useMemo(
    () =>
      totals.map((row, i) => {
        const window = totals.slice(Math.max(0, i - 6), i + 1);
        const avg = window.reduce((s, r) => s + r.total, 0) / window.length;
        return { ...row, avg };
      }),
    [totals]
  );
  const byDay = useMemo(() => {
    const m = new Map<number, { id: string; value: number }[]>();
    data.forEach((row) => {
      const entries = campaignIds
        .map((id) => ({ id, value: (row[`${id}__${metricKey}`] as number) ?? 0 }))
        .filter((e) => e.value > 0)
        .sort((a, b) => b.value - a.value);
      m.set(row.day as number, entries);
    });
    return m;
  }, [data, campaignIds, metricKey]);

  return (
    <GlowPanel wrapperClassName="fade-up" className="panel overflow-hidden p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-faint)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: color, opacity: 0.7 }} />
            Daily total
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3" style={{ background: color, opacity: 0.9 }} />
            7-day avg
          </span>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-[360px] w-full" />
      ) : (
        <ResponsiveContainer width="100%" height={390}>
          <ComposedChart data={chartData} margin={{ top: 30, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="transparent"
              tick={{ fill: "#848484", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="transparent"
              tick={{ fill: "#848484", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={valueFormat}
            />
            {/* Tooltip is a nicety for the on-screen view — the report also downloads as a
                PDF, which can't show hover state, so every bar's value is printed above it
                via LabelList below rather than relying on the tooltip alone. */}
            <Tooltip content={<OverallChartTooltip byDay={byDay} campaignById={campaignById} valueFormat={valueFormat} />} />
            <Bar dataKey="total" fill={color} fillOpacity={0.65} radius={[3, 3, 0, 0]} isAnimationActive animationDuration={550}>
              <LabelList dataKey="total" content={<BarValueLabel format={valueFormat} />} />
            </Bar>
            <Line
              type="monotone"
              dataKey="avg"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive
              animationDuration={550}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </GlowPanel>
  );
}

function OverallChartTooltip({
  active,
  payload,
  label,
  byDay,
  campaignById,
  valueFormat,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: number;
  byDay: Map<number, { id: string; value: number }[]>;
  campaignById: Map<string, CampaignComparisonRow>;
  valueFormat: (v: number) => string;
}) {
  if (!active || !payload || !payload.length || label === undefined) return null;
  const total = payload.find((p) => p.dataKey === "total")?.value ?? 0;
  const avg = payload.find((p) => p.dataKey === "avg")?.value ?? 0;
  const entries = byDay.get(label) ?? [];

  return (
    <div className="rounded-[10px] border border-[var(--border-strong)] bg-[var(--panel2)] px-3 py-2 text-xs text-[var(--text)]">
      <p className="mb-1 font-medium">Day {label}</p>
      <p>
        Total: <span className="font-semibold">{valueFormat(total)}</span>
      </p>
      <p className="text-[var(--text-faint)]">7-day avg: {valueFormat(avg)}</p>
      {entries.length > 0 && (
        <div className="mt-1.5 space-y-1 border-t border-[var(--border)] pt-1.5">
          {entries.slice(0, 5).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-4">
              <span className="text-[var(--text-muted)]">{campaignById.get(e.id)?.property ?? e.id}</span>
              <span className="font-semibold">{valueFormat(e.value)}</span>
            </div>
          ))}
          {entries.length > 5 && <p className="text-[var(--text-faint)]">+{entries.length - 5} more</p>}
        </div>
      )}
    </div>
  );
}

// ── shared bits for the deep per-campaign detail section ───────────────────

function HBarRow({ label, sub, value, widthFrac, color }: { label: string; sub?: string; value: string; widthFrac: number; color: string }) {
  return (
    <div className="mt-2 grid grid-cols-[minmax(0,120px)_minmax(0,1fr)_auto] items-center gap-3 text-xs">
      <div className="truncate text-[var(--text-muted)]" title={label}>
        {label}
        {sub && <span className="block truncate text-[10px] text-[var(--text-faint)]">{sub}</span>}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--panel2)]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, widthFrac * 100)}%`, background: color }} />
      </div>
      <div className="whitespace-nowrap text-right font-mono text-[var(--text)]">{value}</div>
    </div>
  );
}

function BreakdownGroup({ title, rows, valueFormat }: { title: string; rows: BreakdownRow[]; valueFormat: (r: BreakdownRow) => string }) {
  const visible = rows.filter((r) => r.spend > 0 || r.impressions > 0);
  if (visible.length === 0) return <p className="text-xs text-[var(--text-faint)]">No delivery-breakdown data.</p>;
  const max = Math.max(...visible.map((r) => r.spend), 1);
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{title}</p>
      {visible.map((r, i) => (
        <HBarRow key={r.key} label={r.key} sub={`${formatPercent(r.ctr)} CTR`} value={valueFormat(r)} widthFrac={r.spend / max} color={PALETTE[i % PALETTE.length]} />
      ))}
    </div>
  );
}

function AnswerGroup({ title, buckets }: { title: string; buckets: AnswerBucket[] }) {
  if (buckets.length === 0) return null;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{title}</p>
      {buckets.map((b, i) => (
        <HBarRow key={b.label} label={b.label} value={`${b.count} · ${(b.pct * 100).toFixed(0)}%`} widthFrac={b.count / max} color={PALETTE[i % PALETTE.length]} />
      ))}
    </div>
  );
}

function FunnelSteps({ steps }: { steps: { views: number; starts: number; completions: number } }) {
  const pctStarts = steps.views > 0 ? steps.starts / steps.views : 0;
  const pctCompletions = steps.starts > 0 ? steps.completions / steps.starts : 0;
  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      <FunnelStepBox n={steps.views} label="Form views" />
      <FunnelStepBox n={steps.starts} label="Started" sub={`${(pctStarts * 100).toFixed(0)}% of views`} />
      <FunnelStepBox n={steps.completions} label="Completed" sub={`${(pctCompletions * 100).toFixed(0)}% of starts`} accent />
    </div>
  );
}

function FunnelStepBox({ n, label, sub, accent }: { n: number; label: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${accent ? "bg-emerald-500/10 text-emerald-400" : "bg-[var(--panel2)] text-[var(--text)]"}`}>
      <div className="font-mono text-lg font-semibold">{formatNumber(n)}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      {sub && <div className="text-[10px] opacity-70">{sub}</div>}
    </div>
  );
}

function DropoffTable({ fields }: { fields: { label: string; views: number; dropoffs: number; dropoff_rate: number }[] }) {
  if (fields.length === 0) return null;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
            <th className="pb-2 pl-1">Question</th>
            <th className="pb-2 text-right">Views</th>
            <th className="pb-2 pr-1 text-right">Drop-off</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={i} className={`border-t border-[var(--border)] ${f.dropoff_rate >= 0.5 ? "bg-red-500/5" : ""}`}>
              <td className="py-2 pl-1 text-[var(--text-muted)]">{f.label}</td>
              <td className="py-2 text-right font-mono text-[var(--text)]">{formatNumber(f.views)}</td>
              <td className="py-2 pr-1 text-right font-mono text-[var(--text)]">{formatPercent(f.dropoff_rate, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-[var(--border)] pl-2.5">
      <p className="text-[9.5px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const sev = SEV[insight.severity];
  return (
    <div className="rounded-lg border border-[var(--border)] p-3 text-xs" style={{ borderLeftWidth: 3, borderLeftColor: sev.color }}>
      <div className="flex items-center gap-2">
        <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ color: sev.color, background: sev.bg }}>
          {sev.label}
        </span>
        <span className="text-[var(--text-faint)]">{insight.type}</span>
      </div>
      <p className="mt-1.5 font-medium text-[var(--text)]">{insight.title}</p>
      <p className="mt-1 leading-relaxed text-[var(--text-muted)]">{insight.evidence}</p>
      <p className="mt-1.5 text-[var(--accent2,#02bbbb)]">→ {insight.recommendation}</p>
    </div>
  );
}

function MethodologyItem({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-[var(--text)]">{term}</dt>
      <dd className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{children}</dd>
    </div>
  );
}

function CampaignDetailCard({
  row,
  detail,
  isCurrentLiveMonth,
  sparkSpend,
  sparkLeads,
  crmCounts,
  insights,
}: {
  row: CampaignComparisonRow;
  detail: ReportCampaignDetail | undefined;
  isCurrentLiveMonth: boolean;
  sparkSpend: number[];
  sparkLeads: number[];
  crmCounts: Record<string, number>;
  insights: Insight[];
}) {
  // For the current live month, `detail.source` reflects whether this campaign is still in the
  // live /api/funnel roster right now — the authoritative signal, since `row.status` (Supabase's
  // last-synced status) only updates when a campaign is actually synced and goes stale the moment
  // a campaign drops out of the live pipeline (e.g. paused in Meta) part-way through the month.
  // For a closed past month, every card's detail necessarily comes from a snapshot (there is no
  // "live" for a month that's over), so `detail.source` can't distinguish anything — `row.status`
  // there instead reflects that month's own last-synced status, which is the correct signal for
  // "was this campaign active during that month."
  const isLive = isCurrentLiveMonth ? (detail ? detail.source === "live" : row.status === "ACTIVE") : row.status === "ACTIVE";
  return (
    <GlowPanel wrapperClassName="fade-up" className="panel campaign-print-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">{row.property}</h3>
          <p className="text-[11px] text-[var(--text-faint)]">
            Ref {row.ref} · {row.campaign_name}
          </p>
        </div>
        {isLive ? (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">Live</span>
        ) : (
          <span className="rounded-full bg-[var(--panel2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Inactive</span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5 print:grid-cols-5">
        <Kpi label="Spend" value={formatCurrency(row.spend)} />
        <Kpi label="Leads" value={formatNumber(row.leads)} />
        <Kpi label="Cost / lead" value={formatCurrency(row.cpl, 2)} />
        <Kpi label="CTR" value={formatPercent(detail?.ctr)} />
        <Kpi label="CPM" value={formatCurrency(detail?.cpm, 2)} />
      </div>

      {!detail && (
        <p className="mt-4 text-xs text-[var(--text-faint)]">
          Detailed breakdown unavailable for this campaign. History isn&apos;t connected, or no snapshot has been recovered for it yet.
        </p>
      )}

      {detail && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            <div className="rounded-xl bg-[var(--panel2)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Daily spend</p>
              <div className="mt-1">
                <Sparkline data={sparkSpend} stroke="#02bbbb" width={280} height={46} />
              </div>
            </div>
            <div className="rounded-xl bg-[var(--panel2)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Daily leads</p>
              <div className="mt-1">
                <Sparkline data={sparkLeads} stroke="#f5b942" width={280} height={46} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
            <BreakdownGroup title="By platform" rows={detail.byPlatform} valueFormat={(r) => formatCurrency(r.spend)} />
            <BreakdownGroup title="By device" rows={detail.byDevice} valueFormat={(r) => formatCurrency(r.spend)} />
          </div>

          {detail.funnel && (
            <>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Typeform funnel</p>
              <FunnelSteps steps={detail.funnel} />
              <DropoffTable fields={detail.typeformFields} />
            </>
          )}

          <div className="mt-4 space-y-1.5 text-xs text-[var(--text-faint)]">
            {detail.landing ? (
              <p>
                {formatNumber(detail.landing.page_views)} landing-page views this month · {formatPercent(detail.landing.cta_click_rate)} clicked
                the CTA ({formatNumber(detail.landing.cta_clicks)}).
              </p>
            ) : (
              <p>No landing-page engagement recorded for this campaign this period.</p>
            )}
            {detail.clarity ? (
              <p>
                {detail.clarity.sessions} Clarity sessions · {detail.clarity.rage_click_pct.toFixed(1)}% rage clicks ·{" "}
                {detail.clarity.dead_click_pct.toFixed(1)}% dead clicks · {detail.clarity.quickback_pct.toFixed(1)}% quickbacks.
              </p>
            ) : (
              <p>No Microsoft Clarity session data {detail.source === "snapshot" ? "available (no historical store)" : "recorded"} for this campaign this period.</p>
            )}
          </div>

          {detail.answers.respondents > 0 && (
            <>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                Lead answer patterns ({detail.answers.respondents} respondents)
              </p>
              <div className="mt-1 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
                <div>
                  <AnswerGroup title="Budget" buckets={detail.answers.budget} />
                  <AnswerGroup title="Buying timeline" buckets={detail.answers.timeline} />
                </div>
                <div>
                  <AnswerGroup title="Search stage" buckets={detail.answers.stage} />
                  <AnswerGroup title="Language" buckets={detail.answers.language} />
                </div>
              </div>
            </>
          )}

          {Object.keys(crmCounts).length > 0 && (
            <p className="mt-4 text-xs text-[var(--text-faint)]">
              CRM outcomes matched to this campaign:{" "}
              {CRM_EVENT_TYPES.filter((e) => crmCounts[e.event])
                .map((e) => `${e.event}: ${crmCounts[e.event]}`)
                .join(", ")}
              .
            </p>
          )}

          {insights.length > 0 && (
            <>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Flagged this month</p>
              <div className="mt-2 space-y-2">
                {insights.map((ins) => (
                  <InsightRow key={ins.id} insight={ins} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </GlowPanel>
  );
}
