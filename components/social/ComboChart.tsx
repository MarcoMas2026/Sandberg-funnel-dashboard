"use client";

import { Bar, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const BAR_COLOR = "#f5b942";
const LINE_COLORS = ["#6366f1", "#22c55e", "#ec4899", "#a855f7"];

export interface ComboSeries {
  key: string;
  label: string;
}

// Bar + multi-line combo on a dual y-axis (bar metric is typically a much larger
// scale than the line metrics — e.g. total views vs. avg-reach-per-day) — same
// chart shape used across Community/Account/Posts/Reels "evolution" panels.
export function ComboChart({
  data,
  bar,
  lines,
  height = 260,
}: {
  data: Record<string, string | number>[];
  bar?: ComboSeries;
  lines: ComboSeries[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={55} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={45} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bar && <Bar yAxisId="left" dataKey={bar.key} name={bar.label} fill={BAR_COLOR} radius={[3, 3, 0, 0]} />}
        {lines.map((line, i) => (
          <Line
            key={line.key}
            yAxisId="right"
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
