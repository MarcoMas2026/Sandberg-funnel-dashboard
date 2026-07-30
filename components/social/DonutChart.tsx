"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#ec4899", "#f5b942", "#a855f7", "#38bdf8", "#f97362", "#94a3b8"];

export function DonutChart({
  entries,
  height = 200,
  maxSlices = 7,
  labelFor,
}: {
  entries: { key: string; value: number }[];
  height?: number;
  maxSlices?: number;
  labelFor?: (key: string) => string;
}) {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, maxSlices).map((e) => ({ key: labelFor ? labelFor(e.key) : e.key, value: e.value }));
  const rest = sorted.slice(maxSlices);
  const restTotal = rest.reduce((s, e) => s + e.value, 0);
  const data = restTotal > 0 ? [...top, { key: "Others", value: restTotal }] : top;

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={height} height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="key" innerRadius="60%" outerRadius="90%" paddingAngle={1}>
            {data.map((entry, i) => (
              <Cell key={entry.key} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5">
        {data.map((entry, i) => (
          <div key={entry.key} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            {entry.key}
          </div>
        ))}
      </div>
    </div>
  );
}
