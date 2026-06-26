"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TypeformField } from "@/lib/types";

export default function DropoffChart({ fields }: { fields: TypeformField[] }) {
  const data = fields.map((field) => ({
    label: field.label,
    completed: field.views - field.dropoffs,
    dropped: field.dropoffs,
    dropoff_rate: field.dropoff_rate,
  }));

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <p className="mb-4 text-sm font-semibold text-navy">Field-level drop-off</p>
      <ResponsiveContainer width="100%" height={Math.max(240, data.length * 56)}>
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" stroke="#64748b" fontSize={12} />
          <YAxis
            type="category"
            dataKey="label"
            width={160}
            stroke="#64748b"
            fontSize={12}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              value.toLocaleString(),
              name === "completed" ? "Completed" : "Dropped off",
            ]}
          />
          <Bar dataKey="completed" stackId="a" fill="#3b82f6" radius={[4, 0, 0, 4]} />
          <Bar dataKey="dropped" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="dropoff_rate"
              position="right"
              formatter={(value: number) => `${(value * 100).toFixed(0)}%`}
              fontSize={12}
              fill="#64748b"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
