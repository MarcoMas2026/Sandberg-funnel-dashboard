"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { MetaCampaign } from "@/lib/types";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  shortDay,
} from "@/lib/format";
import { CplIcon, CtrIcon, DotsIcon, LeadIcon, PieIcon, SpendIcon, TargetIcon } from "./icons";
import { GlowPanel } from "@/components/ui/glow-panel";
import { LeadQualityDonut } from "@/components/viz";

interface TagCounts {
  red: number;
  orange: number;
  blue: number;
}

const axis = {
  stroke: "transparent",
  tick: { fill: "#5b6579", fontSize: 10 },
  tickLine: false,
  axisLine: false,
};

function tooltipStyle() {
  return {
    contentStyle: {
      background: "#1b2540",
      border: "none",
      borderRadius: 10,
      fontSize: 12,
    },
    labelStyle: { color: "#ffffff" },
    itemStyle: { color: "#ffffff" },
    cursor: { fill: "rgba(0,0,0,0.045)" },
  };
}

export default function MetricsPanel({ meta, tagCounts }: { meta: MetaCampaign; tagCounts?: TagCounts }) {
  const data = meta.daily.map((d) => ({
    label: shortDay(d.date),
    leads: d.leads,
    spend: Number(d.spend.toFixed(2)),
    cpl: Number(d.cpl.toFixed(2)), // real value (0 on no-lead days) — for the tooltip
    // Separate field for the drawn line: null on no-lead days so connectNulls
    // skips them visually (straight line across) instead of dropping to 0.
    cplLine: d.leads > 0 ? Number(d.cpl.toFixed(2)) : null,
    tip: 0, // always-present invisible series so the tooltip fires on every day
    ctr: Number((d.outbound_ctr * 100).toFixed(2)),
  }));

  return (
    <GlowPanel className="panel p-5">
      <PanelHeader icon={<PieIcon className="h-4 w-4" />} title="Metrics" />

      <div className="mt-2 divide-y divide-[var(--border)]">
        <MetricBlock
          icon={<LeadIcon className="h-4 w-4" />}
          name="Leads per day"
          value={formatNumber(meta.leads)}
        >
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={data} margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-leads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2f3b63" />
                  <stop offset="100%" stopColor="#8b93a6" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" vertical horizontal={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} width={36} allowDecimals={false} />
              <Tooltip {...tooltipStyle()} />
              <Bar dataKey="leads" fill="url(#grad-leads)" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </MetricBlock>

        <MetricBlock
          icon={<SpendIcon className="h-4 w-4" />}
          name="Spend per day"
          value={formatCurrency(meta.spend)}
        >
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={data} margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-spend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a5786" />
                  <stop offset="100%" stopColor="#98a3c9" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" vertical horizontal={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} width={36} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => formatCurrency(v, 2)} />
              <Bar dataKey="spend" fill="url(#grad-spend)" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </MetricBlock>

        <MetricBlock
          icon={<CplIcon className="h-4 w-4" />}
          name="Cost per lead"
          value={formatCurrency(meta.cpl, 2)}
        >
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={data} margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-cpl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1b2540" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#1b2540" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" vertical horizontal={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} width={36} />
              <Tooltip cursor={{ stroke: "rgba(0,0,0,0.14)" }} content={<CplTooltip />} />
              <Area
                type="monotone"
                dataKey="cplLine"
                stroke="#1b2540"
                strokeWidth={2}
                fill="url(#grad-cpl)"
                connectNulls
              />
              {/* invisible: guarantees the tooltip fires on skipped (0-lead) days too */}
              <Area
                type="monotone"
                dataKey="tip"
                stroke="none"
                fill="none"
                isAnimationActive={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </MetricBlock>

        <MetricBlock
          icon={<CtrIcon className="h-4 w-4" />}
          name="Unique Outbound CTR"
          value={formatPercent(meta.outbound_ctr, 2)}
        >
          <ResponsiveContainer width="100%" height={110}>
            <ScatterChart margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" vertical horizontal={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" allowDuplicatedCategory={false} />
              <YAxis dataKey="ctr" {...axis} width={36} unit="%" />
              <ZAxis range={[10, 10]} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => `${v}%`} />
              <Scatter data={data} fill="#4a5786">
                {data.map((_, i) => (
                  <Cell key={i} fill="#6e7aab" />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </MetricBlock>

        {tagCounts && (
          <div className="py-4 first:pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <TargetIcon className="h-4 w-4" />
                <span className="text-sm text-[var(--text)]">Lead Qualification</span>
              </div>
              <span className="text-sm font-semibold text-[var(--text)]">
                {formatNumber(tagCounts.red + tagCounts.orange + tagCounts.blue)} tagged
              </span>
            </div>
            <div className="flex items-center gap-3">
              <LeadQualityDonut red={tagCounts.red} orange={tagCounts.orange} blue={tagCounts.blue} />
              <div className="flex flex-col gap-1 text-[11px] text-[var(--text-faint)]">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
                  {tagCounts.red} high
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
                  {tagCounts.orange} mid
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
                  {tagCounts.blue} low
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </GlowPanel>
  );
}

function CplTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: { leads: number; cpl: number } }[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-[10px] border border-[var(--border-strong)] bg-[var(--panel2)] px-3 py-2 text-xs text-[var(--text)]">
      <p className="mb-0.5">{label}</p>
      <p>Leads: {row.leads}</p>
      <p>CPL: {row.leads > 0 ? formatCurrency(row.cpl, 2) : "N/A"}</p>
    </div>
  );
}

function PanelHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[var(--accent)]">{icon}</span>
        <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
      </div>
      <button className="icon-btn" aria-label="Options" disabled>
        <DotsIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function MetricBlock({
  icon,
  name,
  value,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 first:pt-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <span>{icon}</span>
          <span className="text-sm text-[var(--text)]">{name}</span>
        </div>
        <span className="text-sm font-semibold text-[var(--text)]">{value}</span>
      </div>
      {children}
    </div>
  );
}
