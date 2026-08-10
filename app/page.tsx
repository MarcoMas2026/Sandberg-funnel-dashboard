"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useDashboard } from "@/lib/dashboard-context";
import { FunnelCampaign } from "@/lib/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { CountUp, DeltaChip, LeadQualityDonut, Pill, RingGauge, Sparkline } from "@/components/viz";
import { MOCK_QUALITY } from "@/lib/mock";
import { computeInsights, computePortfolioHealth, Severity } from "@/lib/insights";
import { HomeIcon, InsightIcon } from "@/components/icons";
import { LeadRecord } from "@/lib/types";
import { GlowPanel } from "@/components/ui/glow-panel";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Pinnable } from "@/components/Pinnable";

const SEV_COLOR: Record<Severity, string> = {
  critical: "#f87171",
  warning: "#fbbf24",
  opportunity: "#34d399",
  info: "#7a9bff",
};

const TYPE_COLOR = { property: "#2f3b63", community: "#6e7aab" } as const;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function MissionControl() {
  const { data, loading } = useDashboard();
  const [tagCounts, setTagCounts] = useState<Record<string, { red: number; orange: number; blue: number }>>({});

  // Every campaign from June 2026 onward with real spend/leads — single
  // source of truth for anything not currently ACTIVE (Inactive Campaigns
  // cards + Portfolio Leaderboard), sourced from Supabase (funnel_monthly_totals
  // / funnel_daily_history via lib/history/db.ts). The old hand-curated
  // `historical:campaigns` KV pool this used to also merge in has been
  // retired — it drifted out of sync with Supabase (e.g. stale spend/leads
  // for Anchorage Club) since nothing kept the two in step. Supabase is now
  // the only place historical/inactive campaign data is stored or updated.
  const [leaderboardHistory, setLeaderboardHistory] = useState<
    { campaign_id: string; property: string; ref: string; campaign_type: string; spend: number; leads: number; cpl: number; trend: number[] }[]
  >([]);
  useEffect(() => {
    fetch("/api/history/leaderboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setLeaderboardHistory(json.rows ?? []))
      .catch(() => setLeaderboardHistory([]));
  }, []);

  const active = (data?.campaigns ?? []).filter((c) => c.status === "ACTIVE");
  const activeIds = active.map((c) => c.campaign_id).join(",");
  const insights = useMemo(() => computeInsights(data?.campaigns ?? []), [data]);

  // Selected calendar month for the hero KPI cards — defaults to the current
  // month, changeable via the "..." menu on the Total Spend card. Day 1 ->
  // last day, in local time (matches the YYYY-MM-DD strings on meta.daily
  // rows so string comparison is safe).
  const [selMonth, setSelMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const { monthStart, monthEnd, monthLabel } = useMemo(() => {
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const start = new Date(selMonth.year, selMonth.month, 1);
    const end = new Date(selMonth.year, selMonth.month + 1, 0);
    const isCurrentYear = selMonth.year === new Date().getFullYear();
    return {
      monthStart: ymd(start),
      monthEnd: ymd(end),
      monthLabel: start.toLocaleDateString("en-US", { month: "long", ...(isCurrentYear ? {} : { year: "numeric" }) }),
    };
  }, [selMonth]);

  // real qualified-lead composition, per campaign — same red/orange/blue
  // tags set on the Leads page, not the mock hot/warm/cold placeholder.
  // Single unfiltered fetch instead of one request per active campaign.
  useEffect(() => {
    if (!activeIds) return;
    fetch("/api/leads", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const leads: LeadRecord[] = json.leads ?? [];
        const byCampaign: Record<string, { red: number; orange: number; blue: number }> = {};
        for (const l of leads) {
          const bucket = (byCampaign[l.campaign_id] ??= { red: 0, orange: 0, blue: 0 });
          if (l.tag === "red" || l.tag === "orange" || l.tag === "blue") bucket[l.tag]++;
        }
        setTagCounts(byCampaign);
      })
      .catch(() => {});
  }, [activeIds]);

  // Total Spend / Leads / Avg CPL hero cards, for whichever month is selected
  // (default: current month-to-date), summed across ALL campaigns regardless
  // of status (active + paused/archived), not just the active set used
  // elsewhere on this page.
  //
  // Source of truth is funnel_daily_history in Supabase (lib/history/db.ts),
  // populated by /api/history/sync below — a running archive that survives
  // Meta's own daily lookback window and campaigns dropping out of
  // lib/config.ts. `liveTotals` (scanning meta.daily directly from live KV
  // data) is the fallback when Supabase isn't configured/reachable, and is
  // also what's shown for the current month before the first sync of this
  // session lands.
  const liveTotals = useMemo(() => {
    let spend = 0;
    let leads = 0;
    for (const c of data?.campaigns ?? []) {
      for (const d of c.meta.daily) {
        if (d.date >= monthStart && d.date <= monthEnd) {
          spend += d.spend;
          leads += d.leads;
        }
      }
    }
    return { spend, leads };
  }, [data, monthStart, monthEnd]);

  const [storedTotals, setStoredTotals] = useState<{ connected: boolean; spend: number; leads: number } | null>(null);

  const fetchStoredTotals = useCallback(() => {
    fetch(`/api/history/monthly?start=${monthStart}&end=${monthEnd}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setStoredTotals(json))
      .catch(() => setStoredTotals(null));
  }, [monthStart, monthEnd]);

  // Re-read stored totals whenever the selected month changes.
  useEffect(() => {
    fetchStoredTotals();
  }, [fetchStoredTotals]);

  // Sync current live daily rows into Supabase whenever fresh funnel data
  // lands, then re-read so the just-synced data shows up immediately instead
  // of waiting for the next month change.
  useEffect(() => {
    if (!data?.last_updated) return;
    fetch("/api/history/sync", { method: "POST" })
      .then(() => fetchStoredTotals())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.last_updated]);

  const totalSpend = storedTotals?.connected ? storedTotals.spend : liveTotals.spend;
  const totalLeads = storedTotals?.connected ? storedTotals.leads : liveTotals.leads;
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const health = computePortfolioHealth(active, insights);

  const spendSpark = mergeDaily(active, "spend");
  const leadsSpark = mergeDaily(active, "leads");

  // Inactive Campaigns list: every campaign NOT currently active, all-time
  // totals (not scoped to the selected month — only the hero KPI cards above
  // change with the month picker). Merges still-live-but-paused campaigns
  // (real meta.spend/meta.leads from KV) with campaigns no longer tracked in
  // lib/config.ts at all (from Supabase via leaderboardHistory — the same
  // pool the Portfolio Leaderboard below uses).
  const inactiveCampaigns = useMemo(
    () => buildInactiveCampaigns(data?.campaigns ?? [], leaderboardHistory),
    [data, leaderboardHistory]
  );

  // Leaderboard: active campaigns' live totals + Supabase-verified historical
  // ones, deduped by id, ranked by leads — mirrors the reference "Market
  // Overview" table.
  const leaderboard = buildLeaderboard(active, leaderboardHistory);

  if (loading) {
    return (
      <div className="space-y-7">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <CardSkeleton key={i} className="h-56" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* greeting header */}
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 hidden items-center gap-2 text-xs text-[var(--text-faint)] md:flex">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {data?.last_updated ? `Last update ${formatDate(data.last_updated)}` : "No sync yet"}
          </p>
          <h1 className="whitespace-nowrap text-[1.75rem] font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            {greeting()}, team <span className="align-middle">👋</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {active.length} campaign{active.length === 1 ? "" : "s"} live right now across your portfolio
          </p>
          <p className="mt-2 flex items-center justify-center gap-2 text-xs text-[var(--text-faint)] md:hidden">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {data?.last_updated ? `Last update ${formatDate(data.last_updated)}` : "No sync yet"}
          </p>
        </div>
      </div>

      {/* hero KPI price-cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Pinnable type="portfolio-spend">
          <PriceCard
            label={`Total Spend · ${monthLabel}`}
            accent="#2f3b63"
            delay="0.05s"
            value={<CountUp value={totalSpend} format={(v) => formatCurrency(v)} />}
            delta={8}
            goodWhenUp
            spark={<Sparkline data={spendSpark} stroke="#4a5786" width={130} height={44} markers peakLabel={(v) => `€${Math.round(v)}`} />}
            menu={
              <MonthPickerButton
                year={selMonth.year}
                month={selMonth.month}
                onChange={(year, month) => setSelMonth({ year, month })}
              />
            }
          />
        </Pinnable>
        <Pinnable type="portfolio-leads">
          <PriceCard
            label={`Leads (submissions) · ${monthLabel}`}
            accent="#4a5786"
            delay="0.1s"
            value={<CountUp value={totalLeads} format={(v) => formatNumber(v)} />}
            delta={12}
            goodWhenUp
            spark={<Sparkline data={leadsSpark} stroke="#6e7aab" width={130} height={44} markers peakLabel={(v) => `${Math.round(v)}`} />}
          />
        </Pinnable>
        <Pinnable type="portfolio-cpl">
          <PriceCard
            label={`Avg Cost / Lead · ${monthLabel}`}
            accent="#98a3c9"
            delay="0.15s"
            value={<CountUp value={avgCpl} format={(v) => formatCurrency(v, 2)} />}
            delta={-6}
            goodWhenUp={false}
            footnote={
              <>
                CPQL⁺ {formatCurrency(qualityFor(active[0]?.campaign_id).cpqlPlus, 2)} <MockTag />
              </>
            }
          />
        </Pinnable>
        <GlowPanel wrapperClassName="fade-up h-full" style={{ animationDelay: "0.2s" }} className="panel flex h-full items-center justify-between p-5">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Portfolio Health</p>
            <p className="mt-2 hidden max-w-[120px] text-[11px] leading-snug text-[var(--text-faint)] md:block">
              Composite of open findings across active campaigns
            </p>
          </div>
          {health !== null ? (
            <RingGauge value={health} />
          ) : (
            <span className="text-xs text-[var(--text-faint)]">No active campaigns</span>
          )}
        </GlowPanel>
      </div>

      {/* insight ticker */}
      <Link href="/insights" className="glass fade-up block overflow-hidden" style={{ animationDelay: "0.25s" }}>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text)]">
            <InsightIcon className="h-4 w-4" /> Live insights
          </span>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            {insights.length > 0 ? (
              <div className="ticker-track flex w-max items-center gap-10">
                {[...insights, ...insights].map((ins, i) => (
                  <span key={ins.id + i} className="flex items-center gap-2 whitespace-nowrap text-xs text-[var(--text-muted)]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEV_COLOR[ins.severity] }} />
                    <span className="font-medium text-[var(--text)]">{ins.campaign}:</span> {ins.title}
                  </span>
                ))}
              </div>
            ) : (
              <span className="whitespace-nowrap text-xs text-[var(--text-faint)]">
                No findings right now. Detectors are watching for anomalies, fatigue and pacing opportunities.
              </span>
            )}
          </div>
          <span className="shrink-0 text-[11px] text-[var(--text-faint)]">view all →</span>
        </div>
      </Link>

      {/* active campaigns */}
      <div className="fade-up" style={{ animationDelay: "0.3s" }}>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Active Campaigns</h2>
        {active.length === 0 ? (
          <GlowPanel className="panel flex flex-col items-center justify-center py-20 text-center">
            <p className="text-base font-medium text-[var(--text)]">No campaigns are active right now</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Hit Update Data once campaigns are live in Meta</p>
          </GlowPanel>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {active.map((c) => (
              <LiveCampaignCard
                key={c.campaign_id}
                campaign={c}
                spend={c.meta.spend}
                leads={c.meta.leads}
                tagCounts={tagCounts[c.campaign_id] ?? { red: 0, orange: 0, blue: 0 }}
                isCurrentlyActive
                lastUpdated={data?.last_updated ?? null}
              />
            ))}
          </div>
        )}
      </div>

      {/* inactive campaigns */}
      <div className="fade-up" style={{ animationDelay: "0.32s" }}>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Inactive Campaigns</h2>
        {inactiveCampaigns.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">No inactive campaigns</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {inactiveCampaigns.map((row) => (
              <InactiveCampaignCard key={row.campaign_id} row={row} />
            ))}
          </div>
        )}
      </div>

      {/* leaderboard */}
      {leaderboard.length > 0 && (
        <GlowPanel wrapperClassName="fade-up" style={{ animationDelay: "0.35s" }} className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text)]">Portfolio Leaderboard</h2>
            <Pill label="All time" active={false} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                  <th className="pb-2 pl-1">#</th>
                  <th className="pb-2">Campaign</th>
                  <th className="pb-2 text-right">Spend</th>
                  <th className="pb-2 text-right">Leads</th>
                  <th className="pb-2 text-right">Trend</th>
                  <th className="pb-2 pr-1 text-right">Cost / Lead</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.id} className="border-t border-[var(--border)]">
                    <td className="py-3 pl-1 text-xs text-[var(--text-faint)]">{i + 1}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[row.type] }} />
                        <span className="font-medium text-[var(--text)]">{row.property}</span>
                        {row.isActive && (
                          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-400">
                            Live
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-right text-[var(--text)]">{formatCurrency(row.spend)}</td>
                    <td className="py-3 text-right font-semibold text-[var(--text)]">{formatNumber(row.leads)}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end">
                        <Sparkline data={row.trend} stroke={TYPE_COLOR[row.type]} width={80} height={26} fill={false} />
                      </div>
                    </td>
                    <td className="py-3 pr-1 text-right text-[var(--text)]">{formatCurrency(row.cpl, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlowPanel>
      )}
    </div>
  );
}

function PriceCard({
  label,
  accent,
  delay,
  value,
  valueColor = "var(--text)",
  delta,
  goodWhenUp,
  spark,
  footnote,
  menu,
}: {
  label: string;
  accent: string;
  delay: string;
  value: React.ReactNode;
  valueColor?: string;
  delta?: number;
  goodWhenUp?: boolean;
  spark?: React.ReactNode;
  footnote?: React.ReactNode;
  menu?: React.ReactNode;
}) {
  return (
    <GlowPanel wrapperClassName="fade-up h-full" style={{ animationDelay: delay }} className="panel relative flex h-full flex-col overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
          {label}
        </p>
        {menu ?? (
          <span className="icon-btn h-6 w-6 text-[var(--text-faint)]">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </span>
        )}
      </div>
      <p className="mt-1 text-3xl font-bold" style={{ color: valueColor }}>
        {value}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        {delta !== undefined && <DeltaChip pct={delta} goodWhenUp={goodWhenUp} />}
        {footnote && <span className="text-[11px] text-[var(--text-faint)]">{footnote}</span>}
      </div>
      {spark && <div className="mt-2">{spark}</div>}
    </GlowPanel>
  );
}

// Dropdown replacing the Total Spend card's "..." button — lets the user pick
// which calendar month the three linked KPI cards (Total Spend, Leads, Avg
// Cost/Lead) are scoped to. Limited to the last 12 months since that's the
// span meta.daily rows realistically cover.
function MonthPickerButton({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
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

  // Current month down through June — the earliest month we have real
  // portfolio data for — and never into the future (no data to show yet).
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
        className="icon-btn h-6 w-6 text-[var(--text-faint)]"
        aria-label="Select month"
        aria-expanded={open}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 max-h-64 w-40 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1.5 shadow-lg">
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

function MockTag() {
  return (
    <span
      className="ml-1 rounded bg-[var(--panel2)] px-1 py-px text-[9px] uppercase tracking-wide text-[var(--text-faint)]"
      title="Placeholder: real data ships with its backend phase"
    >
      preview
    </span>
  );
}

function qualityFor(id: string | undefined) {
  return (id && MOCK_QUALITY[id]) || MOCK_QUALITY.DEFAULT;
}

interface InactiveCampaignRow {
  campaign_id: string;
  property: string;
  ref: string;
  campaign_type: "property" | "community";
  spend: number;
  leads: number | null;
  live: FunnelCampaign | null; // present when still tracked in lib/config.ts -> full detail page, no month needed
}

// Every campaign NOT currently ACTIVE, all-time totals: live-tracked but
// paused/archived campaigns first (real meta.spend/meta.leads from KV), then
// campaigns no longer tracked in lib/config.ts at all, sourced from Supabase
// (leaderboardHistory — see lib/history/db.ts's getLeaderboardTotals). Sorted
// by spend, no month scoping (matches Active Campaigns above).
function buildInactiveCampaigns(
  liveCampaigns: FunnelCampaign[],
  leaderboardHistory: { campaign_id: string; property: string; ref: string; campaign_type: string; spend: number; leads: number }[]
): InactiveCampaignRow[] {
  const rows: InactiveCampaignRow[] = [];
  const seen = new Set<string>();
  const activeIds = new Set(liveCampaigns.filter((c) => c.status === "ACTIVE").map((c) => c.campaign_id));

  for (const c of liveCampaigns) {
    if (c.status === "ACTIVE") continue;
    seen.add(c.campaign_id);
    rows.push({
      campaign_id: c.campaign_id,
      property: c.property,
      ref: c.ref,
      campaign_type: c.campaign_type,
      spend: c.meta.spend,
      leads: c.meta.leads,
      live: c,
    });
  }

  for (const h of leaderboardHistory) {
    if (seen.has(h.campaign_id) || activeIds.has(h.campaign_id)) continue;
    seen.add(h.campaign_id);
    rows.push({
      campaign_id: h.campaign_id,
      property: h.property,
      ref: h.ref,
      campaign_type: h.campaign_type === "community" ? "community" : "property",
      spend: h.spend,
      leads: h.leads,
      live: null,
    });
  }

  rows.sort((a, b) => b.spend - a.spend);
  return rows;
}

function LiveCampaignCard({
  campaign: c,
  spend,
  leads,
  tagCounts: t,
  isCurrentlyActive,
  lastUpdated,
}: {
  campaign: FunnelCampaign;
  spend: number;
  leads: number;
  tagCounts: { red: number; orange: number; blue: number };
  isCurrentlyActive: boolean;
  lastUpdated: string | null;
}) {
  const tTotal = t.red + t.orange + t.blue;
  const tint = TYPE_COLOR[c.campaign_type];
  return (
    <Link
      href={`/campaign/${c.campaign_id}`}
      className="group panel relative block overflow-hidden p-5 transition-colors hover:border-[var(--border-strong)]"
    >
      {/* soft identity gradient wash, echoing the vehicle-card imagery */}
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: tint }}
      />

      <div className="relative mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel2)]" style={{ color: tint }}>
            <HomeIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-base font-semibold text-[var(--text)]">{c.property}</p>
            <p className="text-xs text-[var(--text-muted)]">
              Ref {c.ref} · {c.campaign_type === "community" ? "Community" : "Property"}
            </p>
          </div>
        </div>
        {isCurrentlyActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--panel2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-faint)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-faint)]" /> Inactive
          </span>
        )}
      </div>

      <div className="relative mb-3 flex items-end justify-between">
        <Pinnable type="campaign-spend" campaignId={c.campaign_id}>
          <div>
            <p className="text-2xl font-bold text-[var(--text)]">{formatCurrency(spend)}</p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">spend</p>
          </div>
        </Pinnable>
        <Pinnable type="campaign-leads" campaignId={c.campaign_id}>
          <div className="text-right">
            <p className="text-2xl font-bold text-[var(--text)]">{formatNumber(leads)}</p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">leads</p>
          </div>
        </Pinnable>
        <Sparkline data={c.meta.daily.map((d) => d.leads)} stroke="#6e7aab" width={110} height={40} />
      </div>

      {/* connection badges, echoing the GPS/LTE chips from the reference */}
      <div className="relative mb-3 flex gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--panel2)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Meta synced
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--panel2)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Typeform synced
        </span>
      </div>

      {/* qualified-lead composition — real red/orange/blue tags from the Leads page */}
      <div className="relative mb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LeadQualityDonut red={t.red} orange={t.orange} blue={t.blue} />
          <div className="flex flex-col gap-1 text-[10px] text-[var(--text-faint)]">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
              {t.red} high
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
              {t.orange} mid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
              {t.blue} low
            </span>
          </div>
        </div>
        {tTotal === 0 && <span className="self-start text-[10px] text-[var(--text-faint)]">no tagged leads yet</span>}
        <span className="self-start text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
          open →
        </span>
      </div>

      {/* mini lifecycle timeline, echoing the 06AM/11PM slider */}
      <div className="relative mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3 text-[10px] text-[var(--text-faint)]">
        <span>{formatDate(c.meta.start_date)}</span>
        <span className="h-px flex-1 bg-[var(--border-strong)]" />
        <span>{lastUpdated ? formatDate(lastUpdated) : "today"}</span>
      </div>
    </Link>
  );
}

// Compact card for a NOT-currently-active campaign — name, spend and leads
// only, all-time totals, no funnel donut/sparkline/sync badges. Always links
// straight to /campaign/[id] with no month param: live-tracked campaigns
// (row.live set) are found directly in the live feed, and campaigns no
// longer in lib/config.ts are resolved by the detail page against their own
// latest month with data (see /api/history/campaign-detail's no-month path).
function InactiveCampaignCard({ row }: { row: InactiveCampaignRow }) {
  const tint = TYPE_COLOR[row.campaign_type];
  const href = `/campaign/${row.campaign_id}`;
  return (
    <Link
      href={href}
      className="group panel relative block overflow-hidden p-3 transition-colors hover:border-[var(--border-strong)]"
    >
      <div className="relative mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tint }} />
        <p className="truncate text-xs font-semibold text-[var(--text)]">{row.property}</p>
      </div>
      <div className="relative flex items-end justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[var(--text)]">{formatCurrency(row.spend)}</p>
          <p className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">spend</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-[var(--text)]">{row.leads === null ? "—" : formatNumber(row.leads)}</p>
          <p className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">leads</p>
        </div>
      </div>
    </Link>
  );
}

// element-wise sum of a daily metric across campaigns (aligned from day 0)
function mergeDaily(campaigns: { meta: { daily: { spend: number; leads: number }[] } }[], key: "spend" | "leads") {
  const len = Math.max(0, ...campaigns.map((c) => c.meta.daily.length));
  if (len < 2) return [0, 0];
  return Array.from({ length: len }, (_, i) => campaigns.reduce((s, c) => s + (c.meta.daily[i]?.[key] ?? 0), 0));
}

interface LeaderRow {
  id: string;
  property: string;
  type: "property" | "community";
  spend: number;
  leads: number;
  cpl: number;
  trend: number[];
  isActive: boolean;
}

function buildLeaderboard(
  active: { campaign_id: string; property: string; campaign_type: "property" | "community"; meta: { spend: number; leads: number; cpl: number; daily: { leads: number }[] } }[],
  // Every June-2026-onward campaign with real spend/leads from Supabase
  // (lib/history/db.ts's getLeaderboardTotals) — the single source of truth
  // for historical/inactive campaigns, keeping growing on its own as future
  // months accumulate, with no manual curation step required. `trend` is
  // real chronological daily leads from funnel_daily_history, not a
  // fabricated shape.
  leaderboardHistory: { campaign_id: string; property: string; ref: string; campaign_type: string; spend: number; leads: number; cpl: number; trend: number[] }[]
): LeaderRow[] {
  const activeIds = new Set(active.map((c) => c.campaign_id));
  const rows: LeaderRow[] = active.map((c) => ({
    id: c.campaign_id,
    property: c.property,
    type: c.campaign_type,
    spend: c.meta.spend,
    leads: c.meta.leads,
    cpl: c.meta.cpl,
    trend: c.meta.daily.length > 1 ? c.meta.daily.map((d) => d.leads) : [0, 0],
    isActive: true,
  }));
  const coveredIds = new Set(activeIds);
  for (const h of leaderboardHistory) {
    if (coveredIds.has(h.campaign_id)) continue;
    coveredIds.add(h.campaign_id);
    rows.push({
      id: h.campaign_id,
      property: h.property,
      type: h.campaign_type === "community" ? "community" : "property",
      spend: h.spend,
      leads: h.leads,
      cpl: h.cpl,
      // Real daily leads when funnel_daily_history has them (true for
      // everything backfilled June onward); only falls back to the
      // synthetic ramp if a campaign genuinely has no daily rows at all.
      trend: h.trend.length > 1 ? h.trend : [h.leads * 0.2, h.leads * 0.5, h.leads * 0.75, h.leads],
      isActive: false,
    });
  }
  // Property campaigns only ("SP - REF - PROPERTY" naming) — community
  // campaigns ("CW - ..." naming, e.g. Anchorage Club, Sa Vinya) are excluded
  // from this leaderboard by design. `type` is already derived from exactly
  // this name prefix everywhere else in the app (see inferType in the n8n
  // Merge & Finalize step and the history backfill), so filtering on it here
  // is equivalent to checking the name directly.
  return rows
    .filter((r) => r.type === "property")
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 8);
}
