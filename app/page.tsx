"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDashboard } from "@/lib/dashboard-context";
import { FunnelCampaign } from "@/lib/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { Sparkline } from "@/components/viz";
import { computeInsights, computePortfolioHealth } from "@/lib/insights";
import { ChartBar, Users, Funnel } from "@phosphor-icons/react";
import { LeadRecord } from "@/lib/types";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { propertyInfoForCampaign } from "@/lib/property-lookup";
import { AGENT_ROSTER } from "@/lib/agents";
import { MissionControlHeader, useMonthTabs } from "@/components/vantage/MissionControlHeader";
import { KpiCard, PortfolioHealthCard, InsightsTicker } from "@/components/vantage/MissionControlKpis";
import { DailyLeadsTrendChart, LeadCountByCampaignDonut } from "@/components/vantage/MissionControlCharts";
import { VantageCampaignCard } from "@/components/vantage/VantageCampaignCard";
import { AgentCountGrid } from "@/components/vantage/AgentCountGrid";

const TYPE_COLOR = { property: "#02bbbb", community: "#c1dfdf" } as const;

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

  // Real vs-previous-month deltas for the three hero KPI chips (spend, leads,
  // avg CPL) — replaces what used to be hardcoded placeholder percentages.
  // `null` (no previous-month data, e.g. before HISTORY_START) means the
  // chip is omitted rather than showing a fabricated number. Same response
  // also carries which campaigns actually spent in the selected month, used
  // below to split the Inactive Campaigns grid into this-month vs all-time.
  const [kpiDeltas, setKpiDeltas] = useState<{ spendPct: number | null; leadsPct: number | null; cplPct: number | null } | null>(null);
  const [monthCampaignIds, setMonthCampaignIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch(`/api/history/report?year=${selMonth.year}&month=${selMonth.month + 1}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        setKpiDeltas(json.portfolio?.deltaVsPreviousMonth ?? null);
        setMonthCampaignIds(new Set((json.campaigns ?? []).map((c: { campaign_id: string }) => c.campaign_id)));
      })
      .catch(() => {
        setKpiDeltas(null);
        setMonthCampaignIds(new Set());
      });
  }, [selMonth]);

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

  // Split the (still all-time-totaled) inactive list by whether the campaign
  // actually spent in the selected month — this-month-inactive first, then
  // everything else, so a paused-but-still-relevant campaign doesn't get
  // buried among ones that haven't run in months.
  const thisMonthInactive = useMemo(
    () => inactiveCampaigns.filter((c) => monthCampaignIds.has(c.campaign_id)),
    [inactiveCampaigns, monthCampaignIds]
  );
  const overallInactive = useMemo(
    () => inactiveCampaigns.filter((c) => !monthCampaignIds.has(c.campaign_id)),
    [inactiveCampaigns, monthCampaignIds]
  );

  // Leaderboard: active campaigns' live totals + Supabase-verified historical
  // ones, deduped by id, ranked by leads — mirrors the reference "Market
  // Overview" table.
  const leaderboard = buildLeaderboard(active, leaderboardHistory);

  // Agent Count: how many currently-active campaigns each listing agent owns,
  // resolved via lib/property-lookup.ts -> lib/properties.ts's brochure-scraped
  // registry (see CONTEXT.md §14.1). Campaigns whose ref has no registry match
  // fall into "Unassigned" rather than being dropped silently.
  const agentCounts = useMemo(() => buildAgentCounts(active), [active]);
  const monthTabs = useMonthTabs();

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
        <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
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
    <div className="vantage-canvas min-h-[calc(100vh-1.5rem)] p-6 sm:p-8">
      <div className="space-y-6">
        <MissionControlHeader
          lastUpdated={data?.last_updated ?? null}
          activeCount={active.length}
          months={monthTabs}
          selMonth={selMonth}
          onSelectMonth={(year, month) => setSelMonth({ year, month })}
          onSearch={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        />

        <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
          <KpiCard
            label={`Total Spend · ${monthLabel}`}
            icon={<ChartBar className="h-5 w-5" />}
            value={totalSpend}
            format={(v) => formatCurrency(v)}
            deltaPct={kpiDeltas?.spendPct}
          />
          <KpiCard
            label={`Leads (submissions) · ${monthLabel}`}
            icon={<Users className="h-5 w-5" />}
            value={totalLeads}
            format={(v) => formatNumber(v)}
            deltaPct={kpiDeltas?.leadsPct}
          />
          <KpiCard
            label={`Avg Cost / Lead · ${monthLabel}`}
            icon={<Funnel className="h-5 w-5" />}
            value={avgCpl}
            format={(v) => formatCurrency(v, 2)}
            deltaPct={kpiDeltas?.cplPct}
          />
          <PortfolioHealthCard value={health} />
        </div>

        <InsightsTicker insights={insights} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DailyLeadsTrendChart />
          <LeadCountByCampaignDonut />
        </div>

        {active.length === 0 ? (
          <div className="vantage-card flex flex-col items-center justify-center py-20 text-center">
            <p className="text-base font-medium text-[var(--vantage-text)]">No campaigns are active right now</p>
            <p className="mt-1 text-sm text-[var(--vantage-text-muted)]">Hit Update Data once campaigns are live in Meta</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {active.map((c) => (
              <VantageCampaignCard key={c.campaign_id} campaign={c} lastUpdated={data?.last_updated ?? null} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-7 space-y-7">
      {/* inactive campaigns */}
      <div className="fade-up" style={{ animationDelay: "0.32s" }}>
        <div className="mb-5 h-px bg-[#2d4444]" />
        {inactiveCampaigns.length === 0 ? (
          <p className="text-sm text-[var(--vantage-text-muted)]">No inactive campaigns</p>
        ) : (
          <>
            {thisMonthInactive.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {thisMonthInactive.map((row) => (
                  <InactiveCampaignCard key={row.campaign_id} row={row} />
                ))}
              </div>
            )}
            {thisMonthInactive.length > 0 && overallInactive.length > 0 && <div className="my-5 h-px bg-[#2d4444]" />}
            {overallInactive.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {overallInactive.map((row) => (
                  <InactiveCampaignCard key={row.campaign_id} row={row} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* leaderboard */}
      {leaderboard.length > 0 && (
        <div className="vantage-card fade-up p-6" style={{ animationDelay: "0.35s" }}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--vantage-text)]">Portfolio Leaderboard</h2>
            <span className="vantage-icon-box px-3 py-1 text-xs font-medium">All time</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--vantage-text-muted)]">
                  <th className="pb-3 pl-1">#</th>
                  <th className="pb-3">Campaign</th>
                  <th className="pb-3 text-right">Spend</th>
                  <th className="pb-3 text-right">Leads</th>
                  <th className="pb-3 text-right">Trend</th>
                  <th className="pb-3 pr-1 text-right">Cost / Lead</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.id} className="border-t border-[rgba(33,52,54,0.1)]">
                    <td className="py-3 pl-1 text-xs text-[var(--vantage-text-muted)]">{i + 1}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[row.type] }} />
                        <span className="font-medium text-[var(--vantage-text)]">{row.property}</span>
                        {row.isActive && (
                          <span className="rounded-full bg-[var(--vantage-icon-box)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--vantage-text)]">
                            Live
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-right text-[var(--vantage-text)]">{formatCurrency(row.spend)}</td>
                    <td className="py-3 text-right font-semibold text-[var(--vantage-text)]">{formatNumber(row.leads)}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end">
                        <Sparkline data={row.trend} stroke="#2d4444" width={80} height={26} fill={false} />
                      </div>
                    </td>
                    <td className="py-3 pr-1 text-right text-[var(--vantage-text)]">{formatCurrency(row.cpl, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* agent count — currently-active campaigns per listing agent */}
      <div className="fade-up" style={{ animationDelay: "0.4s" }}>
        <AgentCountGrid rows={agentCounts} />
      </div>
      </div>
    </div>
  );
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
    <Link href={href} className="vantage-card relative block overflow-hidden p-3">
      <div className="relative mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tint }} />
        <p className="truncate text-xs font-semibold text-[var(--vantage-text)]">{row.property}</p>
      </div>
      <div className="relative flex items-end justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[var(--vantage-text)]">{formatCurrency(row.spend)}</p>
          <p className="text-[9px] uppercase tracking-wide text-[var(--vantage-text-muted)]">spend</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-[var(--vantage-text)]">{row.leads === null ? "—" : formatNumber(row.leads)}</p>
          <p className="text-[9px] uppercase tracking-wide text-[var(--vantage-text-muted)]">leads</p>
        </div>
      </div>
    </Link>
  );
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

// How many currently-active campaigns each listing agent owns, resolved via
// lib/property-lookup.ts against the brochure-scraped lib/properties.ts
// registry. Seeded from the full lib/agents.ts roster so every agent shows up
// even with zero active campaigns; campaigns whose ref has no registry match
// (or whose registry entry has no agent) fall into "Unassigned" instead of
// being dropped. Sorted by count desc, alphabetically within a tie.
function buildAgentCounts(active: FunnelCampaign[]): { agent: string; count: number }[] {
  const counts = new Map<string, number>(AGENT_ROSTER.map((agent) => [agent, 0]));
  for (const c of active) {
    const agent = propertyInfoForCampaign(c.campaign_id, c.campaign_name)?.agent ?? "Unassigned";
    counts.set(agent, (counts.get(agent) ?? 0) + 1);
  }
  return Array.from(counts, ([agent, count]) => ({ agent, count })).sort(
    (a, b) => b.count - a.count || a.agent.localeCompare(b.agent)
  );
}
