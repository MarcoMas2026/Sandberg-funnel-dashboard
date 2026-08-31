"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboard } from "@/lib/dashboard-context";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { CountUp, DeltaChip, Pill } from "@/components/viz";
import { GlowPanel } from "@/components/ui/glow-panel";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { computeInsights } from "@/lib/insights";
import { buildNarrative } from "@/lib/report";
import type { CampaignComparisonRow, PortfolioComparison, PortfolioMonthPoint, DailyRow } from "@/lib/history/db";

interface ReportPayload {
  connected: boolean;
  portfolio: PortfolioComparison | null;
  trend: PortfolioMonthPoint[];
  campaigns: CampaignComparisonRow[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Same palette as /curve (app/curve/page.tsx) — kept in sync manually since
// there's no shared constants module for chart colors yet.
const PALETTE = ["#6366f1", "#22c55e", "#ec4899", "#f5b942", "#a855f7", "#38bdf8", "#f97362", "#94a3b8", "#14b8a6", "#f472b6"];

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

  const narrative = useMemo(() => {
    if (!payload?.portfolio) return [];
    return buildNarrative(payload.portfolio, payload.campaigns, monthLabel, liveInsights);
  }, [payload, monthLabel, liveInsights]);

  // Every campaign with spend in the selected month — the line set for the
  // two daily-performance charts below. Sourced from payload.campaigns (same
  // set the breakdown table shows) rather than a separate query.
  const campaignIds = useMemo(() => (payload?.campaigns ?? []).map((c) => c.campaign_id), [payload]);
  const campaignIdsKey = campaignIds.join(",");
  const campaignById = useMemo(() => new Map((payload?.campaigns ?? []).map((c) => [c.campaign_id, c])), [payload]);
  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    campaignIds.forEach((id, i) => m.set(id, PALETTE[i % PALETTE.length]));
    return m;
  }, [campaignIds]);

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

  if (loading && !payload) {
    return (
      <div className="space-y-7">
        <Skeleton className="h-9 w-72" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const portfolio = payload?.portfolio;
  const connected = payload?.connected ?? false;

  return (
    <div className="space-y-7">
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-[var(--text)] sm:text-4xl">Meta Ads Monthly Report</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {payload ? `${payload.campaigns.length} campaign${payload.campaigns.length === 1 ? "" : "s"} with spend in ${monthLabel}` : monthLabel}
          </p>
          <p className="mt-1 text-xs text-[var(--text-faint)]">Report generated {formatDate(new Date().toISOString())}</p>
        </div>
        <ReportMonthPicker year={selMonth.year} month={selMonth.month} onChange={(year, month) => setSelMonth({ year, month })} />
      </div>

      {!connected && (
        <GlowPanel className="panel p-5 text-sm text-[var(--text-muted)]">
          History isn&apos;t connected — this report needs Supabase (funnel_daily_history / funnel_monthly_totals) to compute month-over-month
          comparisons.
        </GlowPanel>
      )}

      {portfolio && (
        <>
          {/* portfolio overview */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

          {/* daily performance, one line per campaign live in the month */}
          {campaignIds.length > 0 && (
            <>
              <DailyCampaignChart
                title="Spend by Day"
                metricKey="spend"
                data={dailyChartData}
                campaignIds={campaignIds}
                campaignById={campaignById}
                colorOf={colorOf}
                loading={dailyLoading}
                valueFormat={(v) => formatCurrency(v)}
              />
              <DailyCampaignChart
                title="Leads by Day"
                metricKey="leads"
                data={dailyChartData}
                campaignIds={campaignIds}
                campaignById={campaignById}
                colorOf={colorOf}
                loading={dailyLoading}
                valueFormat={(v) => formatNumber(v)}
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--text)]">{c.property}</span>
                              {c.status === "ACTIVE" ? (
                                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-400">Live</span>
                              ) : (
                                <span className="rounded-full bg-[var(--panel2)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--text-faint)]">Inactive</span>
                              )}
                            </div>
                          </td>
                          <MetricCell value={formatCurrency(c.spend)} pct={c.deltaSpendPct} goodWhenUp />
                          <MetricCell value={c.leads === null ? "—" : formatNumber(c.leads)} pct={c.deltaLeadsPct} goodWhenUp />
                          <MetricCell last value={c.cpl === null ? "—" : formatCurrency(c.cpl, 2)} pct={c.deltaCplPct} goodWhenUp={false} />
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlowPanel>

          {/* narrative summary */}
          {narrative.length > 0 && (
            <GlowPanel wrapperClassName="fade-up" className="panel p-5">
              <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Summary</h2>
              <ul className="space-y-2.5">
                {narrative.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                    <span className="mt-0.5 text-emerald-400">✔</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </GlowPanel>
          )}
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

// One line per campaign, X axis = calendar day (1 through the month's last
// day) — same chart footprint as /curve (ResponsiveContainer height 440).
// Unlike /curve, which aligns campaigns by runtime day, this aligns by
// shared calendar date since the point is "how did the whole roster move
// together this month," not each campaign's own lifecycle.
function DailyCampaignChart({
  title,
  metricKey,
  data,
  campaignIds,
  campaignById,
  colorOf,
  loading,
  valueFormat,
}: {
  title: string;
  metricKey: "spend" | "leads";
  data: Record<string, number | string | null>[];
  campaignIds: string[];
  campaignById: Map<string, CampaignComparisonRow>;
  colorOf: Map<string, string>;
  loading: boolean;
  valueFormat: (v: number) => string;
}) {
  return (
    <GlowPanel wrapperClassName="fade-up" className="panel overflow-hidden p-5">
      <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">{title}</h2>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {campaignIds.map((id) => (
          <span key={id} className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colorOf.get(id) }} />
            {campaignById.get(id)?.property ?? id}
          </span>
        ))}
      </div>
      {loading ? (
        <Skeleton className="h-[440px] w-full" />
      ) : (
        <ResponsiveContainer width="100%" height={440}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
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
            <Tooltip content={<DailyChartTooltip campaignIds={campaignIds} campaignById={campaignById} colorOf={colorOf} metricKey={metricKey} valueFormat={valueFormat} />} />
            {campaignIds.map((id) => (
              <Line
                key={id}
                type="monotone"
                dataKey={`${id}__${metricKey}`}
                name={campaignById.get(id)?.property ?? id}
                stroke={colorOf.get(id)}
                strokeWidth={2}
                dot={{ r: 2, fill: colorOf.get(id), strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive
                animationDuration={550}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </GlowPanel>
  );
}

function DailyChartTooltip({
  active,
  payload,
  label,
  campaignIds,
  campaignById,
  colorOf,
  metricKey,
  valueFormat,
}: {
  active?: boolean;
  payload?: { payload: Record<string, number | string | null> }[];
  label?: number;
  campaignIds: string[];
  campaignById: Map<string, CampaignComparisonRow>;
  colorOf: Map<string, string>;
  metricKey: "spend" | "leads";
  valueFormat: (v: number) => string;
}) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  const entries = campaignIds
    .map((id) => ({ id, value: row[`${id}__${metricKey}`] as number | null }))
    .filter((e) => e.value !== null && e.value !== undefined);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-[10px] border border-[var(--border-strong)] bg-[var(--panel2)] px-3 py-2 text-xs text-[var(--text)]">
      <p className="mb-1 font-medium">Day {label}</p>
      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colorOf.get(e.id) }} />
            <span>{campaignById.get(e.id)?.property ?? e.id}:</span>
            <span className="font-semibold">{valueFormat(e.value as number)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
