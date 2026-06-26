"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { FunnelCampaign, FunnelData } from "@/lib/types";

function heatColor(rate: number): string {
  if (rate >= 0.5) return "bg-red-500/80 text-white";
  if (rate >= 0.3) return "bg-amber-400/80 text-white";
  if (rate >= 0.15) return "bg-amber-200 text-slate-700";
  return "bg-emerald-200 text-slate-700";
}

export default function TrendsPage() {
  const [campaigns, setCampaigns] = useState<FunnelCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/funnel");
        const data: FunnelData = await res.json();
        setCampaigns(data.campaigns);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading trends…</p>;
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-slate-500">No data yet — trends will appear once campaigns are loaded.</p>;
  }

  const questionLabels = Array.from(
    new Set(campaigns.flatMap((c) => c.typeform.fields.map((f) => f.label)))
  );

  const cplData = campaigns.map((c) => ({
    name: c.property,
    CPL: Number(c.meta.cpl.toFixed(2)),
  }));

  const scatterData = campaigns.map((c) => ({
    name: c.property,
    spend: c.meta.spend,
    qualified_leads: c.typeform.completions,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Trends & Patterns</h1>
        <p className="text-sm text-slate-500">Cross-campaign drop-off, cost, and lead-volume patterns</p>
      </div>

      <section className="rounded-xl border border-border bg-white p-5">
        <p className="mb-4 text-sm font-semibold text-navy">Drop-off heatmap</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs font-medium uppercase text-slate-500">Question</th>
                {campaigns.map((c) => (
                  <th key={c.campaign_id} className="p-2 text-left text-xs font-medium uppercase text-slate-500">
                    {c.property}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {questionLabels.map((label) => (
                <tr key={label}>
                  <td className="p-2 text-slate-600">{label}</td>
                  {campaigns.map((c) => {
                    const field = c.typeform.fields.find((f) => f.label === label);
                    return (
                      <td key={c.campaign_id} className="p-2">
                        {field ? (
                          <span
                            className={`inline-flex w-16 justify-center rounded-md px-2 py-1 text-xs font-semibold ${heatColor(
                              field.dropoff_rate
                            )}`}
                          >
                            {(field.dropoff_rate * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5">
        <p className="mb-4 text-sm font-semibold text-navy">CPL by campaign</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={cplData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip />
            <Bar dataKey="CPL" fill="#0f172a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-xl border border-border bg-white p-5">
        <p className="mb-4 text-sm font-semibold text-navy">Spend vs. qualified leads</p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" dataKey="spend" name="Spend (€)" stroke="#64748b" fontSize={12} />
            <YAxis
              type="number"
              dataKey="qualified_leads"
              name="Qualified Leads"
              stroke="#64748b"
              fontSize={12}
            />
            <ZAxis range={[120, 120]} />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === "spend" ? [`€${value}`, "Spend"] : [value, "Qualified Leads"]
              }
              labelFormatter={() => ""}
            />
            <Scatter data={scatterData} fill="#3b82f6" />
          </ScatterChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
