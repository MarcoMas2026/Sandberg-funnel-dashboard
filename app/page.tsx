"use client";

import Link from "next/link";
import { useDashboard } from "@/lib/dashboard-context";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { CountUp, DeltaChip, RingGauge, Sparkline } from "@/components/viz";
import { MOCK_INSIGHTS, MOCK_QUALITY, Severity } from "@/lib/mock";
import { HomeIcon, InsightIcon } from "@/components/icons";

const SEV_COLOR: Record<Severity, string> = {
  critical: "#f87171",
  warning: "#fbbf24",
  opportunity: "#34d399",
  info: "#7a9bff",
};

export default function MissionControl() {
  const { data, loading } = useDashboard();
  const active = (data?.campaigns ?? []).filter((c) => c.status === "ACTIVE");

  const totalSpend = active.reduce((s, c) => s + c.meta.spend, 0);
  const totalLeads = active.reduce((s, c) => s + c.meta.leads, 0);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  // MOCK: portfolio health score — becomes a computed composite in Phase 3
  const health = active.length > 0 ? 72 : 0;

  const spendSpark = mergeDaily(active, "spend");
  const leadsSpark = mergeDaily(active, "leads");

  if (loading) {
    return <p className="pt-2 text-sm text-[var(--text-muted)]">Loading mission control…</p>;
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-faint)]">Portfolio</p>
          <h1 className="text-2xl font-semibold text-white">Mission Control</h1>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {active.length} active campaign{active.length === 1 ? "" : "s"} ·{" "}
          {data?.last_updated ? `data as of ${formatDate(data.last_updated)}` : "no sync yet"}
        </p>
      </div>

      {/* hero KPIs */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="gradient-border fade-up p-5" style={{ animationDelay: "0.05s" }}>
          <KpiHead label="Total Spend" delta={8} goodWhenUp />
          <p className="mt-1 text-3xl font-bold text-white">
            <CountUp value={totalSpend} format={(v) => formatCurrency(v)} />
          </p>
          <div className="mt-2"><Sparkline data={spendSpark} stroke="#4f7cf7" width={150} /></div>
        </div>
        <div className="gradient-border fade-up p-5" style={{ animationDelay: "0.1s" }}>
          <KpiHead label="Leads (submissions)" delta={12} goodWhenUp />
          <p className="mt-1 text-3xl font-bold text-[#b7a6ff]">
            <CountUp value={totalLeads} format={(v) => formatNumber(v)} />
          </p>
          <div className="mt-2"><Sparkline data={leadsSpark} stroke="#9a7cff" width={150} /></div>
        </div>
        <div className="gradient-border fade-up p-5" style={{ animationDelay: "0.15s" }}>
          <KpiHead label="Avg Cost / Lead" delta={-6} goodWhenUp={false} />
          <p className="mt-1 text-3xl font-bold text-white">
            <CountUp value={avgCpl} format={(v) => formatCurrency(v, 2)} />
          </p>
          <p className="mt-3 text-[11px] text-[var(--text-faint)]">
            CPQL⁺ (quality-weighted): {formatCurrency(qualityFor(active[0]?.campaign_id).cpqlPlus, 2)}{" "}
            <MockTag />
          </p>
        </div>
        <div className="gradient-border fade-up flex items-center justify-between p-5" style={{ animationDelay: "0.2s" }}>
          <div>
            <KpiHead label="Portfolio Health" />
            <p className="mt-2 max-w-[120px] text-[11px] leading-snug text-[var(--text-faint)]">
              Pacing, fatigue & anomaly composite <MockTag />
            </p>
          </div>
          <RingGauge value={health} />
        </div>
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
                  <span className="font-medium text-white">{ins.campaign}:</span> {ins.title}
                </span>
              ))}
            </div>
          </div>
          <span className="shrink-0 text-[11px] text-[var(--text-faint)]">view all →</span>
        </div>
      </Link>

      {/* campaigns */}
      <div className="fade-up" style={{ animationDelay: "0.3s" }}>
        <h2 className="mb-3 text-sm font-semibold text-white">Active Campaigns</h2>
        {active.length === 0 ? (
          <div className="panel flex flex-col items-center justify-center py-20 text-center">
            <p className="text-base font-medium text-white">No active campaigns</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Hit Update Data once campaigns are live in Meta</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {active.map((c) => {
              const q = qualityFor(c.campaign_id);
              const qTotal = q.hot + q.warm + q.cold || 1;
              return (
                <Link
                  key={c.campaign_id}
                  href={`/campaign/${c.campaign_id}`}
                  className="group panel p-5 transition-colors hover:border-[var(--border-strong)]"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel2)] text-[var(--accent)]">
                        <HomeIcon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-base font-semibold text-white">{c.property}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          Ref {c.ref} · {c.campaign_type === "community" ? "Community" : "Property"}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
                    </span>
                  </div>

                  <div className="mb-3 flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-white">{formatCurrency(c.meta.spend)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">spend</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#b7a6ff]">{formatNumber(c.meta.leads)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">leads</p>
                    </div>
                    <Sparkline data={c.meta.daily.map((d) => d.leads)} stroke="#9a7cff" width={110} height={40} />
                  </div>

                  {/* lead quality strip — MOCK until Phase 2 */}
                  <div className="mb-1 flex h-1.5 overflow-hidden rounded-full bg-[var(--panel2)]">
                    <span className="bg-[#c026d3]" style={{ width: `${(q.hot / qTotal) * 100}%` }} />
                    <span className="bg-[#8b5cf6]" style={{ width: `${(q.warm / qTotal) * 100}%` }} />
                    <span className="bg-[#3b3b46]" style={{ width: `${(q.cold / qTotal) * 100}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-faint)]">
                    <span>
                      {q.hot} hot · {q.warm} warm · {q.cold} cold <MockTag />
                    </span>
                    <span className="text-[var(--accent2)] opacity-0 transition-opacity group-hover:opacity-100">
                      open →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiHead({ label, delta, goodWhenUp }: { label: string; delta?: number; goodWhenUp?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      {delta !== undefined && <DeltaChip pct={delta} goodWhenUp={goodWhenUp} />}
    </div>
  );
}

function MockTag() {
  return (
    <span className="ml-1 rounded bg-[var(--panel2)] px-1 py-px text-[9px] uppercase tracking-wide text-[var(--text-faint)]" title="Placeholder — real data ships with its backend phase">
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
  return Array.from({ length: len }, (_, i) =>
    campaigns.reduce((s, c) => s + (c.meta.daily[i]?.[key] ?? 0), 0)
  );
}
