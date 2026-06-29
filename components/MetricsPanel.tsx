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
import { CplIcon, CtrIcon, DotsIcon, LeadIcon, PieIcon, SpendIcon } from "./icons";

const axis = {
  stroke: "transparent",
  tick: { fill: "#5c5c66", fontSize: 10 },
  tickLine: false,
  axisLine: false,
};

function tooltipStyle() {
  return {
    contentStyle: {
      background: "#1a1a1f",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      fontSize: 12,
    },
    labelStyle: { color: "#ededf2" },
    itemStyle: { color: "#ededf2" },
    cursor: { fill: "rgba(255,255,255,0.04)" },
  };
}

export default function MetricsPanel({ meta }: { meta: MetaCampaign }) {
  const data = meta.daily.map((d) => ({
    label: shortDay(d.date),
    leads: d.leads,
    spend: Number(d.spend.toFixed(2)),
    cpl: Number(d.cpl.toFixed(2)),
    ctr: Number((d.outbound_ctr * 100).toFixed(2)),
  }));

  return (
    <div className="panel p-5">
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
                  <stop offset="0%" stopColor="#d4e84a" />
                  <stop offset="100%" stopColor="#7bbf3f" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" vertical horizontal={false} />
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
                  <stop offset="0%" stopColor="#4fd3e8" />
                  <stop offset="100%" stopColor="#3b7cf7" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" vertical horizontal={false} />
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
                  <stop offset="0%" stopColor="#6c4bdb" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#6c4bdb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" vertical horizontal={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} width={36} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => formatCurrency(v, 2)} />
              <Area
                type="monotone"
                dataKey="cpl"
                stroke="#9a7cff"
                strokeWidth={2}
                fill="url(#grad-cpl)"
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
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" vertical horizontal={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" allowDuplicatedCategory={false} />
              <YAxis dataKey="ctr" {...axis} width={36} unit="%" />
              <ZAxis range={[10, 10]} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => `${v}%`} />
              <Scatter data={data} fill="#4f7cf7">
                {data.map((_, i) => (
                  <Cell key={i} fill="#7a9bff" />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </MetricBlock>
      </div>
    </div>
  );
}

function PanelHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[var(--accent)]">{icon}</span>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
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
          <span className="text-sm text-white">{name}</span>
        </div>
        <span className="text-sm font-semibold text-white">{value}</span>
      </div>
      {children}
    </div>
  );
}
