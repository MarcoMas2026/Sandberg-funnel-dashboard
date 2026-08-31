"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatNumber } from "@/lib/format";
import { ChartLineUp } from "@phosphor-icons/react";
import { GlowPanel } from "@/components/ui/glow-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { MultipleSelect, TTag } from "@/components/ui/multiple-select";

interface CatalogCampaign {
  campaign_id: string;
  campaign_name: string;
  property: string;
  ref: string;
  campaign_type: string;
  status: string;
}

interface DailyRow {
  date: string;
  spend: number;
  leads: number;
  cpl: number;
  impressions: number;
}

const PALETTE = ["#6366f1", "#22c55e", "#ec4899", "#f5b942", "#a855f7", "#38bdf8", "#f97362", "#94a3b8"];

type MetricKey = "cpl" | "leads" | "impressions";

interface MetricDef {
  key: MetricKey;
  short: string;
  label: string;
  axisFormat: (v: number) => string;
}

const METRICS: MetricDef[] = [
  { key: "cpl", short: "CPL", label: "Cost per lead", axisFormat: (v) => formatCurrency(v) },
  { key: "leads", short: "Leads", label: "Leads", axisFormat: (v) => formatNumber(v) },
  { key: "impressions", short: "Impr.", label: "Impressions", axisFormat: (v) => formatNumber(v) },
];

export default function CurvePage() {
  const [campaigns, setCampaigns] = useState<CatalogCampaign[]>([]);
  const [connected, setConnected] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedActive, setSelectedActive] = useState<TTag[]>([]);
  const [selectedInactive, setSelectedInactive] = useState<TTag[]>([]);
  const [series, setSeries] = useState<Record<string, DailyRow[]>>({});
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [metric, setMetric] = useState<MetricKey>("cpl");

  useEffect(() => {
    fetch("/api/history/campaigns-catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setConnected(Boolean(d.connected));
        setCampaigns(d.campaigns ?? []);
      })
      .finally(() => setCatalogLoading(false));
  }, []);

  const selectedIds = useMemo(
    () => [...selectedActive, ...selectedInactive].map((t) => t.key),
    [selectedActive, selectedInactive]
  );

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSeries({});
      return;
    }
    setSeriesLoading(true);
    fetch(`/api/history/campaign-series?ids=${selectedIds.join(",")}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSeries(d.series ?? {}))
      .finally(() => setSeriesLoading(false));
  }, [selectedIds]);

  const byId = useMemo(() => new Map(campaigns.map((c) => [c.campaign_id, c])), [campaigns]);
  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    selectedIds.forEach((id, i) => m.set(id, PALETTE[i % PALETTE.length]));
    return m;
  }, [selectedIds]);

  const active = campaigns.filter((c) => c.status === "ACTIVE");
  const inactive = campaigns.filter((c) => c.status !== "ACTIVE");
  const activeTags: TTag[] = active.map((c) => ({ key: c.campaign_id, name: c.property }));
  const inactiveTags: TTag[] = inactive.map((c) => ({ key: c.campaign_id, name: c.property }));
  const defaultActiveTag: TTag[] = activeTags.length > 0 ? [activeTags[0]] : [];

  // Merge every selected campaign's own day-1/day-2/... sequence into one
  // day-indexed dataset — campaigns started on different calendar dates, so
  // alignment is by runtime day, not by shared date. Every metric's value is
  // pre-computed per row so switching metrics never needs a refetch, only a
  // different dataKey on the same <Line>.
  const chartData = useMemo(() => {
    const maxLen = Math.max(0, ...selectedIds.map((id) => series[id]?.length ?? 0));
    const rows: Record<string, number | string | null>[] = [];
    for (let i = 0; i < maxLen; i++) {
      const row: Record<string, number | string | null> = { day: i + 1 };
      for (const id of selectedIds) {
        const d = series[id]?.[i];
        if (!d) continue;
        row[`${id}__cpl`] = d.leads > 0 ? Number(d.cpl.toFixed(2)) : null;
        row[`${id}__leads`] = d.leads;
        row[`${id}__spend`] = Number(d.spend.toFixed(2));
        row[`${id}__impressions`] = d.impressions;
        row[`${id}__date`] = d.date;
      }
      rows.push(row);
    }
    return rows;
  }, [selectedIds, series]);

  const isLoading = catalogLoading;
  const activeMetric = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="pt-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Curve</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Track a metric over each campaign&apos;s runtime — select one or more campaigns to compare
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-5">
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-28" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : !connected ? (
        <GlowPanel className="panel flex flex-col items-center justify-center py-24 text-center">
          <p className="text-base font-medium text-[var(--text)]">History store not connected</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Campaign Curve needs the Supabase history store — check Supabase env vars.
          </p>
        </GlowPanel>
      ) : campaigns.length === 0 ? (
        <GlowPanel className="panel flex flex-col items-center justify-center py-24 text-center">
          <p className="text-base font-medium text-[var(--text)]">No campaign history yet</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Curves appear once daily history snapshots start accumulating.
          </p>
        </GlowPanel>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activeTags.length > 0 && (
              <MultipleSelect
                tags={activeTags}
                label="Active campaigns"
                defaultValue={defaultActiveTag}
                colorFor={(t) => colorOf.get(t.key)}
                onChange={setSelectedActive}
              />
            )}
            {inactiveTags.length > 0 && (
              <MultipleSelect
                tags={inactiveTags}
                label="Inactive campaigns"
                colorFor={(t) => colorOf.get(t.key)}
                onChange={setSelectedInactive}
              />
            )}
          </div>

          <GlowPanel className="panel overflow-hidden p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[var(--accent)]">
                  <ChartLineUp className="h-4 w-4" />
                </span>
                <AnimatePresence mode="wait">
                  <motion.h2
                    key={metric}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.18 }}
                    className="text-sm font-semibold text-[var(--text)]"
                  >
                    {activeMetric.label} by day
                  </motion.h2>
                </AnimatePresence>
              </div>
              <MetricSwitcher active={metric} onChange={setMetric} />
            </div>

            {selectedIds.length === 0 ? (
              <div className="flex h-96 items-center justify-center text-sm text-[var(--text-muted)]">
                Select a campaign above to see its curve
              </div>
            ) : seriesLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : chartData.length === 0 ? (
              <div className="flex h-96 items-center justify-center text-sm text-[var(--text-muted)]">
                No daily history yet for the selected campaign{selectedIds.length > 1 ? "s" : ""}
              </div>
            ) : (
              <div style={{ perspective: 1200 }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={metric}
                    initial={{ opacity: 0, rotateX: -8, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
                    exit={{ opacity: 0, rotateX: 8, y: -18, scale: 0.98 }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    style={{ transformOrigin: "top center" }}
                  >
                    <ResponsiveContainer width="100%" height={440}>
                      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tickFormatter={(d) => `Day ${d}`}
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
                          tickFormatter={activeMetric.axisFormat}
                        />
                        <Tooltip
                          content={
                            <CurveTooltip selectedIds={selectedIds} byId={byId} colorOf={colorOf} metric={metric} />
                          }
                        />
                        {selectedIds.map((id) => (
                          <Line
                            key={`${id}-${metric}`}
                            type="monotone"
                            dataKey={`${id}__${metric}`}
                            name={byId.get(id)?.property ?? id}
                            stroke={colorOf.get(id)}
                            strokeWidth={2}
                            dot={{ r: 3, fill: colorOf.get(id), strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
                            connectNulls
                            isAnimationActive
                            animationDuration={550}
                            animationEasing="ease-out"
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </GlowPanel>
        </>
      )}
    </div>
  );
}

function MetricSwitcher({ active, onChange }: { active: MetricKey; onChange: (m: MetricKey) => void }) {
  return (
    <div className="relative flex items-center gap-1 rounded-full bg-[var(--panel2)] p-1">
      {METRICS.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className="relative rounded-full px-3 py-1.5 text-xs font-medium"
        >
          {active === m.key && (
            <motion.span
              layoutId="metric-pill-bg"
              className="absolute inset-0 rounded-full bg-[var(--text)]"
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
            />
          )}
          <span className={`relative z-10 ${active === m.key ? "text-[var(--panel)]" : "text-[var(--text-muted)]"}`}>
            {m.short}
          </span>
        </button>
      ))}
    </div>
  );
}

function CurveTooltip({
  active,
  payload,
  label,
  selectedIds,
  byId,
  colorOf,
  metric,
}: {
  active?: boolean;
  payload?: { payload: Record<string, number | string | null> }[];
  label?: number;
  selectedIds: string[];
  byId: Map<string, CatalogCampaign>;
  colorOf: Map<string, string>;
  metric: MetricKey;
}) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  const entries = selectedIds
    .map((id) => ({
      id,
      leads: row[`${id}__leads`] as number | undefined,
      spend: row[`${id}__spend`] as number | undefined,
      cpl: row[`${id}__cpl`] as number | null | undefined,
      impressions: row[`${id}__impressions`] as number | undefined,
      date: row[`${id}__date`] as string | undefined,
    }))
    .filter((e) => e.date !== undefined);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-[10px] border border-[var(--border-strong)] bg-[var(--panel2)] px-3 py-2 text-xs text-[var(--text)]">
      <p className="mb-1 font-medium">Day {label}</p>
      <div className="space-y-1.5">
        {entries.map((e) => (
          <div key={e.id}>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colorOf.get(e.id) }} />
              <span className="font-medium">{byId.get(e.id)?.property ?? e.id}</span>
            </div>
            <p className="pl-3 text-[var(--text-muted)]">
              <Stat label="Leads" value={formatNumber(e.leads ?? 0)} on={metric === "leads"} />
              {" · "}
              <Stat label="Spend" value={formatCurrency(e.spend ?? 0)} on={false} />
              {" · "}
              <Stat label="CPL" value={e.cpl ? formatCurrency(e.cpl, 2) : "N/A"} on={metric === "cpl"} />
              {" · "}
              <Stat label="Impr." value={formatNumber(e.impressions ?? 0)} on={metric === "impressions"} />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <span className={on ? "font-semibold text-[var(--text)]" : undefined}>
      {label}: {value}
    </span>
  );
}
