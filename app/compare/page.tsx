"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { FunnelCampaign, HistoricalCampaign } from "@/lib/types";
import { rankHistoricalCampaigns, MIN_HISTORICAL_SPEND } from "@/lib/ranking";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import MetricCompareChart, { CompareBar } from "@/components/MetricCompareChart";
import { HomeIcon } from "@/components/icons";

function toComparable(c: FunnelCampaign) {
  return {
    spend: c.meta.spend,
    leads: c.meta.leads,
    cpl: c.meta.cpl,
    ctr: c.meta.ctr,
    click_to_form_start_rate: c.derived.click_to_form_start_rate,
    form_completion_rate: c.derived.form_completion_rate,
  };
}

export default function ComparePage() {
  const { data, loading } = useDashboard();
  const [historical, setHistorical] = useState<HistoricalCampaign[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/historical", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setHistorical(d.campaigns ?? []))
      .finally(() => setHistLoading(false));
  }, []);

  const active = (data?.campaigns ?? []).filter((c) => c.status === "ACTIVE");

  useEffect(() => {
    if (!selectedId && active.length > 0) setSelectedId(active[0].campaign_id);
  }, [active, selectedId]);

  const selected = active.find((c) => c.campaign_id === selectedId) ?? null;

  const isLoading = loading || histLoading;

  if (isLoading) {
    return <p className="pt-2 text-sm text-[var(--text-muted)]">Loading comparison…</p>;
  }

  if (active.length === 0) {
    return (
      <div className="pt-2">
        <h1 className="mb-1 text-2xl font-semibold text-white">Compare</h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          Compare an active campaign against your best-performing past campaigns
        </p>
        <div className="panel flex flex-col items-center justify-center py-24 text-center">
          <p className="text-base font-medium text-white">No active campaigns</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Compare needs at least one active campaign to benchmark against past winners
          </p>
        </div>
      </div>
    );
  }

  const ranked = selected
    ? rankHistoricalCampaigns(historical, selected.campaign_type, selected.campaign_id)
    : [];

  const activeMetrics = selected ? toComparable(selected) : null;

  const metricRows: {
    key: keyof ReturnType<typeof toComparable>;
    label: string;
    formatter: (v: number) => string;
    higherIsBetter: boolean;
  }[] = [
    { key: "spend", label: "Total Spend", formatter: (v) => formatCurrency(v), higherIsBetter: true },
    { key: "leads", label: "Total Leads", formatter: (v) => formatNumber(v), higherIsBetter: true },
    { key: "cpl", label: "Cost per Lead", formatter: (v) => formatCurrency(v, 2), higherIsBetter: false },
    { key: "ctr", label: "CTR", formatter: (v) => formatPercent(v, 2), higherIsBetter: true },
    {
      key: "click_to_form_start_rate",
      label: "Click → Form Start",
      formatter: (v) => formatPercent(v),
      higherIsBetter: true,
    },
    {
      key: "form_completion_rate",
      label: "Form Completion Rate",
      formatter: (v) => formatPercent(v),
      higherIsBetter: true,
    },
  ];

  return (
    <div className="pt-2">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Compare</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Benchmark an active campaign against your best past campaigns of the same type
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {active.map((c) => (
          <button
            key={c.campaign_id}
            onClick={() => setSelectedId(c.campaign_id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              c.campaign_id === selectedId
                ? "accent-gradient text-white"
                : "bg-[var(--panel2)] text-[var(--text-muted)] hover:text-white"
            }`}
          >
            {c.property}
          </button>
        ))}
      </div>

      {selected && activeMetrics && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[30fr_70fr]">
          {/* Left: selected campaign profile */}
          <div className="panel h-fit p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel2)] text-[var(--accent)]">
                <HomeIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-base font-semibold text-white">{selected.property}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Ref {selected.ref} · {selected.campaign_type === "property" ? "Property" : "Community"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Spend" value={formatCurrency(activeMetrics.spend)} />
              <MiniStat label="Leads" value={formatNumber(activeMetrics.leads)} accent />
              <MiniStat label="Cost / Lead" value={formatCurrency(activeMetrics.cpl, 2)} />
              <MiniStat label="CTR" value={formatPercent(activeMetrics.ctr, 2)} />
            </div>

            {ranked.length > 0 && (
              <div className="mt-5 border-t border-[var(--border)] pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Compared against
                </p>
                <ul className="space-y-1.5">
                  {ranked.map((r, i) => (
                    <li key={r.campaign_id} className="flex items-center gap-2 text-sm text-white">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--panel)] text-[10px] font-semibold text-[var(--text-muted)]">
                        {i + 1}
                      </span>
                      {r.property}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: metric comparison charts */}
          <div>
            {ranked.length === 0 ? (
              <div className="panel flex flex-col items-center justify-center py-20 text-center">
                <p className="text-base font-medium text-white">
                  Not enough historical {selected.campaign_type} campaigns yet
                </p>
                <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                  A past campaign needs verified Typeform data and at least{" "}
                  {formatCurrency(MIN_HISTORICAL_SPEND)} spent to qualify as a fair comparison. As more{" "}
                  {selected.campaign_type} campaigns finish running, they&apos;ll show up here automatically.
                </p>
              </div>
            ) : (
              <>
                {ranked.length < 3 && (
                  <p className="mb-3 text-xs text-[var(--text-muted)]">
                    Only {ranked.length} qualifying past {selected.campaign_type} campaign
                    {ranked.length === 1 ? "" : "s"} found (need ≥ {formatCurrency(MIN_HISTORICAL_SPEND)} spent)
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {metricRows.map((m) => {
                    const bars: CompareBar[] = [
                      { name: "Your Campaign", value: activeMetrics[m.key], isActive: true },
                      ...ranked.map((r) => ({ name: r.property, value: r[m.key] })),
                    ];
                    return (
                      <MetricCompareChart
                        key={m.key}
                        label={m.label}
                        bars={bars}
                        formatter={m.formatter}
                        higherIsBetter={m.higherIsBetter}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-[var(--panel2)] p-3">
      <p className={`text-lg font-semibold ${accent ? "text-[var(--accent)]" : "text-white"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
