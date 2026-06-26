"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MetricCard from "@/components/MetricCard";
import { FunnelCampaign, FunnelData } from "@/lib/types";

export default function ComparePage() {
  const [campaigns, setCampaigns] = useState<FunnelCampaign[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/funnel");
        const data: FunnelData = await res.json();
        setCampaigns(data.campaigns);
        setSelected(data.campaigns.slice(0, 2).map((c) => c.campaign_id));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  const selectedCampaigns = campaigns.filter((c) => selected.includes(c.campaign_id));

  const chartData = selectedCampaigns.map((c) => ({
    name: c.property,
    "CPL (€)": Number(c.meta.cpl.toFixed(2)),
    "Click→Form %": Number((c.derived.click_to_form_start_rate * 100).toFixed(0)),
    "Completion %": Number((c.derived.form_completion_rate * 100).toFixed(0)),
    "Cost/Lead (€)": Number(c.derived.cost_per_qualified_lead.toFixed(2)),
  }));

  if (loading) {
    return <p className="text-sm text-slate-400">Loading campaigns…</p>;
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-slate-500">No campaigns to compare yet.</p>;
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-navy">Compare Campaigns</h1>
      <p className="mb-6 text-sm text-slate-500">Select 2–4 campaigns to compare side by side</p>

      <div className="mb-8 flex flex-wrap gap-3">
        {campaigns.map((c) => (
          <label
            key={c.campaign_id}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              selected.includes(c.campaign_id)
                ? "border-navy bg-navy text-white"
                : "border-border bg-white text-slate-600"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(c.campaign_id)}
              onChange={() => toggle(c.campaign_id)}
              className="hidden"
            />
            {c.property}
          </label>
        ))}
      </div>

      {selectedCampaigns.length > 0 && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {selectedCampaigns.map((c) => (
              <div key={c.campaign_id} className="space-y-3">
                <p className="text-sm font-semibold text-navy">{c.property}</p>
                <MetricCard label="Spend" value={`€${c.meta.spend.toLocaleString()}`} />
                <MetricCard label="CPL" value={`€${c.meta.cpl.toFixed(2)}`} />
                <MetricCard
                  label="Click→Form"
                  value={`${(c.derived.click_to_form_start_rate * 100).toFixed(0)}%`}
                />
                <MetricCard
                  label="Completion Rate"
                  value={`${(c.derived.form_completion_rate * 100).toFixed(0)}%`}
                />
                <MetricCard
                  label="Cost/Qualified Lead"
                  value={`€${c.derived.cost_per_qualified_lead.toFixed(2)}`}
                />
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-white p-5">
            <p className="mb-4 text-sm font-semibold text-navy">Key metrics comparison</p>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="CPL (€)" fill="#0f172a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Click→Form %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Completion %" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cost/Lead (€)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
