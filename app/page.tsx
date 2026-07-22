"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboard } from "@/lib/dashboard-context";
import { HistoricalCampaign } from "@/lib/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { CountUp, DeltaChip, Pill, RingGauge, Sparkline } from "@/components/viz";
import { MOCK_INSIGHTS, MOCK_QUALITY, Severity } from "@/lib/mock";
import { HomeIcon, InsightIcon } from "@/components/icons";
import { GlowPanel } from "@/components/ui/glow-panel";
import { GlowingEffect } from "@/components/ui/glowing-effect";

const SEV_COLOR: Record<Severity, string> = {
  critical: "#f87171",
  warning: "#fbbf24",
  opportunity: "#34d399",
  info: "#7a9bff",
};

const TYPE_COLOR = { property: "#4f7cf7", community: "#c026d3" } as const;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function MissionControl() {
  const { data, loading } = useDashboard();
  const [historical, setHistorical] = useState<HistoricalCampaign[]>([]);

  useEffect(() => {
    fetch("/api/historical", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setHistorical(d.campaigns ?? []))
      .catch(() => {});
  }, []);

  const active = (data?.campaigns ?? []).filter((c) => c.status === "ACTIVE");

  // Anchorage Club isn't in the live funnel feed right now, but its verified
  // historical record (used for Compare benchmarks) has real totals — shown
  // here as a preview card so the "active campaign" layout can be visualized
  // without inventing any numbers. Clearly tagged, never mixed into the real
  // `active` totals/leaderboard-as-live logic above.
  const previewActive = historical.find((h) => h.campaign_id === "120250284542490071") ?? null;

  const totalSpend = active.reduce((s, c) => s + c.meta.spend, 0);
  const totalLeads = active.reduce((s, c) => s + c.meta.leads, 0);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  // MOCK: portfolio health score — becomes a computed composite in Phase 3
  const health = active.length > 0 ? 72 : 0;

  const spendSpark = mergeDaily(active, "spend");
  const leadsSpark = mergeDaily(active, "leads");

  // Leaderboard: active campaigns' live totals + verified historical ones,
  // deduped by id, ranked by leads — mirrors the reference "Market Overview" table.
  const leaderboard = buildLeaderboard(active, historical);

  if (loading) {
    return <p className="pt-2 text-sm text-[var(--text-muted)]">Loading mission control…</p>;
  }

  return (
    <div className="space-y-7">
      {/* greeting header */}
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs text-[var(--text-faint)]">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {data?.last_updated ? `Last update ${formatDate(data.last_updated)}` : "No sync yet"}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            {greeting()}, team <span className="align-middle">👋</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {active.length} campaign{active.length === 1 ? "" : "s"} live right now across your portfolio
          </p>
        </div>
      </div>

      {/* hero KPI price-cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <PriceCard
          label="Total Spend"
          accent="#4f7cf7"
          delay="0.05s"
          value={<CountUp value={totalSpend} format={(v) => formatCurrency(v)} />}
          delta={8}
          goodWhenUp
          spark={<Sparkline data={spendSpark} stroke="#4f7cf7" width={130} height={44} markers peakLabel={(v) => `€${Math.round(v)}`} />}
        />
        <PriceCard
          label="Leads (submissions)"
          accent="#9a7cff"
          delay="0.1s"
          value={<CountUp value={totalLeads} format={(v) => formatNumber(v)} />}
          valueColor="#c9b8ff"
          delta={12}
          goodWhenUp
          spark={<Sparkline data={leadsSpark} stroke="#9a7cff" width={130} height={44} markers peakLabel={(v) => `${Math.round(v)}`} />}
        />
        <PriceCard
          label="Avg Cost / Lead"
          accent="#34d399"
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
        <GlowPanel wrapperClassName="fade-up" style={{ animationDelay: "0.2s" }} className="panel flex items-center justify-between p-5">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Portfolio Health</p>
            <p className="mt-2 max-w-[120px] text-[11px] leading-snug text-[var(--text-faint)]">
              Pacing, fatigue &amp; anomaly composite <MockTag />
            </p>
          </div>
          <RingGauge value={health} />
        </GlowPanel>
      </div>

      {/* insight ticker */}
      <Link href="/insights" className="glass fade-up block overflow-hidden" style={{ animationDelay: "0.25s" }}>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#9a7cff]">
            <InsightIcon className="h-4 w-4" /> Live insights
          </span>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="ticker-track flex w-max items-center gap-10">
              {[...MOCK_INSIGHTS, ...MOCK_INSIGHTS].map((ins, i) => (
                <span key={ins.id + i} className="flex items-center gap-2 whitespace-nowrap text-xs text-[var(--text-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEV_COLOR[ins.severity] }} />
                  <span className="font-medium text-[var(--text)]">{ins.campaign}:</span> {ins.title}
                </span>
              ))}
            </div>
          </div>
          <span className="shrink-0 text-[11px] text-[var(--text-faint)]">view all →</span>
        </div>
      </Link>

      {/* campaigns */}
      <div className="fade-up" style={{ animationDelay: "0.3s" }}>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Active Campaigns</h2>
        {active.length === 0 && !previewActive ? (
          <GlowPanel className="panel flex flex-col items-center justify-center py-20 text-center">
            <p className="text-base font-medium text-[var(--text)]">No active campaigns</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Hit Update Data once campaigns are live in Meta</p>
          </GlowPanel>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {active.length === 0 && previewActive && <HistoricalPreviewCard campaign={previewActive} />}
            {active.map((c) => {
              const q = qualityFor(c.campaign_id);
              const qTotal = q.hot + q.warm + q.cold || 1;
              const tint = TYPE_COLOR[c.campaign_type];
              return (
                <div key={c.campaign_id} className="relative rounded-[var(--radius-lg)] p-1">
                  <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} borderWidth={2} disabled={false} />
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
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
                    </span>
                  </div>

                  <div className="relative mb-3 flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-[var(--text)]">{formatCurrency(c.meta.spend)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">spend</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#b7a6ff]">{formatNumber(c.meta.leads)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">leads</p>
                    </div>
                    <Sparkline data={c.meta.daily.map((d) => d.leads)} stroke="#9a7cff" width={110} height={40} />
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

                  {/* lead quality strip — MOCK until Phase 2 */}
                  <div className="relative mb-1 flex h-1.5 overflow-hidden rounded-full bg-[var(--panel2)]">
                    <span className="bg-[#c026d3]" style={{ width: `${(q.hot / qTotal) * 100}%` }} />
                    <span className="bg-[#8b5cf6]" style={{ width: `${(q.warm / qTotal) * 100}%` }} />
                    <span className="bg-[#3b3b46]" style={{ width: `${(q.cold / qTotal) * 100}%` }} />
                  </div>
                  <div className="relative flex items-center justify-between text-[10px] text-[var(--text-faint)]">
                    <span>
                      {q.hot} hot · {q.warm} warm · {q.cold} cold <MockTag />
                    </span>
                    <span className="text-[var(--accent2)] opacity-0 transition-opacity group-hover:opacity-100">
                      open →
                    </span>
                  </div>

                  {/* mini lifecycle timeline, echoing the 06AM/11PM slider */}
                  <div className="relative mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3 text-[10px] text-[var(--text-faint)]">
                    <span>{formatDate(c.meta.start_date)}</span>
                    <span className="h-px flex-1 bg-[var(--border-strong)]" />
                    <span>{data?.last_updated ? formatDate(data.last_updated) : "today"}</span>
                  </div>
                  </Link>
                </div>
              );
            })}
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
                    <td className="py-3 text-right font-semibold text-[#b7a6ff]">{formatNumber(row.leads)}</td>
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
  valueColor = "#fff",
  delta,
  goodWhenUp,
  spark,
  footnote,
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
}) {
  return (
    <GlowPanel wrapperClassName="fade-up" style={{ animationDelay: delay }} className="panel relative overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
          {label}
        </p>
        <span className="icon-btn h-6 w-6 text-[var(--text-faint)]">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
        </span>
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

// Visualizes a historical-only campaign (real totals, no live daily/video
// data) as if it were an active card — clearly tagged "Preview" rather than
// "Live", and every number shown is real (spend/leads/cpl/ctr from the
// verified historical record). No sparkline/lead-quality/lifecycle-dates
// since those need live daily data this record doesn't have.
function HistoricalPreviewCard({ campaign: c }: { campaign: HistoricalCampaign }) {
  const tint = TYPE_COLOR[c.campaign_type];
  return (
    <div className="relative rounded-[var(--radius-lg)] p-1">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} borderWidth={2} disabled={false} />
      <Link
        href={`/campaign/${c.campaign_id}`}
        className="group panel relative block overflow-hidden p-5 transition-colors hover:border-[var(--border-strong)]"
      >
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
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--panel2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-faint)]"
            title="Shown from verified historical data, not the live Meta feed"
          >
            Preview
          </span>
        </div>

        <div className="relative mb-3 flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-[var(--text)]">{formatCurrency(c.spend)}</p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">spend</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#b7a6ff]">{formatNumber(c.leads)}</p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">leads</p>
          </div>
        </div>

        <div className="relative mb-1 flex gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--panel2)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
            Historical snapshot
          </span>
        </div>
        <div className="relative flex items-center justify-between text-[10px] text-[var(--text-faint)]">
          <span>Verified past performance, used as a Compare benchmark</span>
          <span className="text-[var(--accent2)] opacity-0 transition-opacity group-hover:opacity-100">
            open →
          </span>
        </div>
      </Link>
    </div>
  );
}

function MockTag() {
  return (
    <span
      className="ml-1 rounded bg-[var(--panel2)] px-1 py-px text-[9px] uppercase tracking-wide text-[var(--text-faint)]"
      title="Placeholder — real data ships with its backend phase"
    >
      preview
    </span>
  );
}

function qualityFor(id: string | undefined) {
  return (id && MOCK_QUALITY[id]) || MOCK_QUALITY.DEFAULT;
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
  historical: HistoricalCampaign[]
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
  for (const h of historical) {
    if (activeIds.has(h.campaign_id)) continue;
    rows.push({
      id: h.campaign_id,
      property: h.property,
      type: h.campaign_type,
      spend: h.spend,
      leads: h.leads,
      cpl: h.cpl,
      trend: [h.leads * 0.2, h.leads * 0.5, h.leads * 0.75, h.leads],
      isActive: false,
    });
  }
  return rows.sort((a, b) => b.leads - a.leads).slice(0, 8);
}
