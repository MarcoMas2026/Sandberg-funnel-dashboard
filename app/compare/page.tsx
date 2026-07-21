"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { CampaignType, FunnelCampaign, HistoricalCampaign } from "@/lib/types";
import { rankHistoricalCampaigns, MIN_HISTORICAL_SPEND } from "@/lib/ranking";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import MetricCompareChart, { CompareBar } from "@/components/MetricCompareChart";
import { HomeIcon } from "@/components/icons";
import { GlowPanel } from "@/components/ui/glow-panel";

interface ComparableMetrics {
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  click_to_form_start_rate: number;
  form_completion_rate: number;
}

interface CompareSubject {
  id: string;
  property: string;
  ref: string;
  campaign_type: CampaignType;
  isActive: boolean;
  metrics: ComparableMetrics;
}

function fromFunnel(c: FunnelCampaign): ComparableMetrics {
  return {
    spend: c.meta.spend,
    leads: c.meta.leads,
    cpl: c.meta.cpl,
    ctr: c.meta.ctr,
    click_to_form_start_rate: c.derived.click_to_form_start_rate,
    form_completion_rate: c.derived.form_completion_rate,
  };
}

function fromHistorical(c: HistoricalCampaign): ComparableMetrics {
  return {
    spend: c.spend,
    leads: c.leads,
    cpl: c.cpl,
    ctr: c.ctr,
    click_to_form_start_rate: c.click_to_form_start_rate,
    form_completion_rate: c.form_completion_rate,
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

  // Selectable subjects: every active campaign, plus every verified past
  // campaign that isn't currently active (a campaign that's both — e.g. it
  // was backfilled once and is running again — only appears once, as Active).
  const subjects: CompareSubject[] = useMemo(() => {
    const activeIds = new Set(active.map((c) => c.campaign_id));
    const activeSubjects: CompareSubject[] = active.map((c) => ({
      id: c.campaign_id,
      property: c.property,
      ref: c.ref,
      campaign_type: c.campaign_type,
      isActive: true,
      metrics: fromFunnel(c),
    }));
    const pastSubjects: CompareSubject[] = historical
      .filter((h) => !activeIds.has(h.campaign_id))
      .map((h) => ({
        id: h.campaign_id,
        property: h.property,
        ref: h.ref,
        campaign_type: h.campaign_type,
        isActive: false,
        metrics: fromHistorical(h),
      }));
    return [...activeSubjects, ...pastSubjects];
  }, [active, historical]);

  useEffect(() => {
    if (!selectedId && subjects.length > 0) setSelectedId(subjects[0].id);
  }, [subjects, selectedId]);

  const selected = subjects.find((s) => s.id === selectedId) ?? null;

  const isLoading = loading || histLoading;

  if (isLoading) {
    return <p className="pt-2 text-sm text-[var(--text-muted)]">Loading comparison…</p>;
  }

  if (subjects.length === 0) {
    return (
      <div className="pt-2">
        <h1 className="mb-1 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Compare</h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          Compare a campaign against your best-performing past campaigns of the same type
        </p>
        <GlowPanel className="panel flex flex-col items-center justify-center py-24 text-center">
          <p className="text-base font-medium text-[var(--text)]">No campaigns to compare yet</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Compare needs at least one active or verified past campaign
          </p>
        </GlowPanel>
      </div>
    );
  }

  const ranked = selected ? rankHistoricalCampaigns(historical, selected.campaign_type, selected.id) : [];

  const activeMetrics = selected?.metrics ?? null;

  const metricRows: {
    key: keyof ComparableMetrics;
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

  const activeSubjects = subjects.filter((s) => s.isActive);
  const pastSubjects = subjects.filter((s) => !s.isActive);

  return (
    <div className="pt-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Compare</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Benchmark any campaign against your best past campaigns of the same type
        </p>
      </div>

      <div className="mb-6 space-y-3">
        {activeSubjects.length > 0 && (
          <SubjectRow label="Active" subjects={activeSubjects} selectedId={selectedId} onSelect={setSelectedId} />
        )}
        {pastSubjects.length > 0 && (
          <SubjectRow label="Past Campaigns" subjects={pastSubjects} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </div>

      {selected && activeMetrics && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[30fr_70fr]">
          {/* Left: selected campaign profile */}
          <GlowPanel className="panel h-fit p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel2)] text-[var(--accent)]">
                  <HomeIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-base font-semibold text-[var(--text)]">{selected.property}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Ref {selected.ref} · {selected.campaign_type === "property" ? "Property" : "Community"}
                  </p>
                </div>
              </div>
              <StatusBadge isActive={selected.isActive} />
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
                    <li key={r.campaign_id} className="flex items-center gap-2 text-sm text-[var(--text)]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--panel)] text-[10px] font-semibold text-[var(--text-muted)]">
                        {i + 1}
                      </span>
                      {r.property}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </GlowPanel>

          {/* Right: metric comparison charts */}
          <div>
            {ranked.length === 0 ? (
              <GlowPanel className="panel flex flex-col items-center justify-center py-20 text-center">
                <p className="text-base font-medium text-[var(--text)]">
                  Not enough historical {selected.campaign_type} campaigns yet
                </p>
                <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                  A past campaign needs verified Typeform data and at least{" "}
                  {formatCurrency(MIN_HISTORICAL_SPEND)} spent to qualify as a fair comparison. As more{" "}
                  {selected.campaign_type} campaigns finish running, they&apos;ll show up here automatically.
                </p>
              </GlowPanel>
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
                      { name: selected.property, value: activeMetrics[m.key], isActive: true },
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

function SubjectRow({
  label,
  subjects,
  selectedId,
  onSelect,
}: {
  label: string;
  subjects: CompareSubject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              s.id === selectedId
                ? "accent-gradient text-white"
                : "bg-[var(--panel2)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {s.property}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-[var(--panel2)] text-[var(--text-muted)]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-[var(--text-faint)]"}`} />
      {isActive ? "Active" : "Past"}
    </span>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-[var(--panel2)] p-3">
      <p className={`text-lg font-semibold ${accent ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
