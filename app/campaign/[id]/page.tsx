"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MetricCard from "@/components/MetricCard";
import DropoffChart from "@/components/DropoffChart";
import CampaignStatusBadge from "@/components/CampaignStatusBadge";
import { FunnelCampaign, FunnelData } from "@/lib/types";
import { MOCK_TIME_SERIES } from "@/lib/mockData";

export default function CampaignDeepDivePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [campaign, setCampaign] = useState<FunnelCampaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/funnel");
        const data: FunnelData = await res.json();
        setCampaign(data.campaigns.find((c) => c.campaign_id === id) ?? null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading campaign…</p>;
  }

  if (!campaign) {
    return (
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-navy">
          ← Back to overview
        </Link>
        <p className="mt-6 text-sm text-slate-500">Campaign not found.</p>
      </div>
    );
  }

  const { meta, typeform, derived } = campaign;

  return (
    <div>
      <Link href="/" className="text-sm text-slate-500 hover:text-navy">
        ← Back to overview
      </Link>

      <div className="mt-4 mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">{campaign.property}</h1>
          <p className="text-sm text-slate-500">{campaign.campaign_name}</p>
        </div>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Meta Ads
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Spend" value={`€${meta.spend.toLocaleString()}`} />
          <MetricCard label="Impressions" value={meta.impressions.toLocaleString()} />
          <MetricCard label="CPM" value={`€${meta.cpm.toFixed(2)}`} />
          <MetricCard label="CTR" value={`${(meta.ctr * 100).toFixed(2)}%`} />
          <MetricCard label="Link Clicks" value={meta.link_clicks.toLocaleString()} />
          <MetricCard label="CPL" value={`€${meta.cpl.toFixed(2)}`} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Typeform
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Views" value={typeform.views.toLocaleString()} />
          <MetricCard label="Starts" value={typeform.starts.toLocaleString()} />
          <MetricCard label="Completions" value={typeform.completions.toLocaleString()} />
          <MetricCard
            label="Completion Rate"
            value={`${(typeform.completion_rate * 100).toFixed(0)}%`}
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Derived
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard
            label="Click → Form Start"
            value={`${(derived.click_to_form_start_rate * 100).toFixed(0)}%`}
          />
          <MetricCard
            label="Form Completion Rate"
            value={`${(derived.form_completion_rate * 100).toFixed(0)}%`}
          />
          <MetricCard
            label="Cost / Qualified Lead"
            value={`€${derived.cost_per_qualified_lead.toFixed(2)}`}
          />
        </div>
      </section>

      <section className="mb-8">
        <DropoffChart fields={typeform.fields} />
      </section>

      <section>
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="mb-1 text-sm font-semibold text-navy">Performance over time</p>
          <p className="mb-4 text-xs text-slate-400">
            Placeholder data — real time-series lands in v2
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={MOCK_TIME_SERIES}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="spend" stroke="#0f172a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="link_clicks" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completions" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
