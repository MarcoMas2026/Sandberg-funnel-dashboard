"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const RANK_COLORS = ["#98a3c9", "#b3bcd8", "#c7cfe0"]; // historical #1 -> #3, lightening
const ACTIVE_COLOR = "#1b2540";

export interface CompareBar {
  name: string;
  value: number;
  isActive?: boolean;
}

export default function MetricCompareChart({
  label,
  bars,
  formatter,
  higherIsBetter,
}: {
  label: string;
  bars: CompareBar[]; // first item is always the active campaign
  formatter: (v: number) => string;
  higherIsBetter: boolean;
}) {
  const [active, ...historical] = bars;
  const histAvg = historical.length
    ? historical.reduce((s, b) => s + b.value, 0) / historical.length
    : null;
  const delta = histAvg !== null && histAvg !== 0 ? (active.value - histAvg) / histAvg : null;
  const isBetter = delta !== null ? (higherIsBetter ? delta > 0 : delta < 0) : null;

  const data = bars.map((b, i) => ({
    name: b.isActive ? "Your Campaign" : b.name,
    value: b.value,
    color: b.isActive ? ACTIVE_COLOR : RANK_COLORS[i - 1] ?? RANK_COLORS[RANK_COLORS.length - 1],
  }));

  return (
    <div className="rounded-xl bg-[var(--panel2)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text)]">{label}</span>
        {delta !== null && (
          <span
            className={`text-xs font-semibold ${
              isBetter ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(0)}% vs avg
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fill: "#8b93a6", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#1b2540",
              border: "none",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: "#ffffff" }}
            itemStyle={{ color: "#ffffff" }}
            formatter={(v: number) => formatter(v)}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: number) => formatter(v)}
              fill="#1b2540"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
