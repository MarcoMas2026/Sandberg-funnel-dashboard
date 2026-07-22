"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboard } from "@/lib/dashboard-context";
import { HistoricalCampaign } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { GlowPanel } from "@/components/ui/glow-panel";
import { HomeIcon } from "@/components/icons";
import CampaignInfoBar from "@/components/CampaignInfoBar";
import MetricsPanel from "@/components/MetricsPanel";
import SummaryPanel from "@/components/SummaryPanel";
import MarketingFunnel from "@/components/MarketingFunnel";

export default function CampaignPage({ params }: { params: { id: string } }) {
  const { data, loading } = useDashboard();
  const [historical, setHistorical] = useState<HistoricalCampaign[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(true);

  useEffect(() => {
    fetch("/api/historical", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setHistorical(d.campaigns ?? []))
      .catch(() => {})
      .finally(() => setHistoricalLoading(false));
  }, []);

  const campaign = data?.campaigns.find((c) => c.campaign_id === params.id);

  if (loading || (!campaign && historicalLoading)) {
    return <p className="pt-2 text-sm text-[var(--text-muted)]">Loading campaign…</p>;
  }

  if (campaign) {
    return (
      <div className="space-y-5 pt-2">
        <CampaignInfoBar campaign={campaign} lastUpdated={data?.last_updated ?? null} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[35fr_65fr]">
          <div className="space-y-5">
            <MetricsPanel meta={campaign.meta} />
            <SummaryPanel meta={campaign.meta} />
          </div>
          <MarketingFunnel campaign={campaign} />
        </div>
      </div>
    );
  }

  const historicalCampaign = historical.find((h) => h.campaign_id === params.id);

  if (historicalCampaign) {
    return <HistoricalCampaignPreview campaign={historicalCampaign} />;
  }

  return (
    <div className="pt-2">
      <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
        ← Back to overview
      </Link>
      <p className="mt-6 text-sm text-[var(--text-muted)]">Campaign not found.</p>
    </div>
  );
}

// Shown when a campaign only exists in verified historical data (not the
// live Meta feed) — every number here is real, but there's no day-by-day
// breakdown or video/engagement tracking to back the full animated funnel
// or daily charts, so this is a simpler, honestly-labeled summary instead.
function HistoricalCampaignPreview({ campaign: c }: { campaign: HistoricalCampaign }) {
  const stages = [
    { name: "Ad Appears", sub: "impressions", value: c.impressions },
    { name: "Enters Landing Page", sub: "link clicks", value: c.link_clicks },
    { name: "Enters Typeform", sub: "form starts", value: c.starts },
    { name: "Fills Typeform", sub: "submissions", value: c.leads },
  ];

  return (
    <div className="space-y-5 pt-2">
      <GlowPanel className="panel flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--panel2)] text-[var(--accent)]">
            <HomeIcon className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold text-[var(--text)]">{c.property}</span>
          <span className="h-5 w-px bg-[var(--border-strong)]" />
          <span className="text-sm text-[var(--text-muted)]">Ref {c.ref}</span>
        </div>
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--panel2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-faint)]"
          title="Shown from verified historical data, not the live Meta feed"
        >
          Preview — historical snapshot, not live
        </span>
      </GlowPanel>

      <GlowPanel className="panel p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Campaign Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Total Spend" value={formatCurrency(c.spend)} />
          <Kpi label="Total Leads" value={formatNumber(c.leads)} accent />
          <Kpi label="Avg Cost / Lead" value={formatCurrency(c.cpl, 2)} />
          <Kpi label="Overall CTR" value={formatPercent(c.ctr, 2)} />
        </div>
      </GlowPanel>

      <GlowPanel className="panel p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Marketing Funnel</h2>
        <div className="flex flex-col gap-3">
          {stages.map((s, i) => {
            const rate = i === 0 || stages[i - 1].value === 0 ? null : s.value / stages[i - 1].value;
            return (
              <div key={s.name} className="flex items-center justify-between rounded-xl bg-[var(--panel2)] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">{s.name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{s.sub}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-[var(--text)]">{formatNumber(s.value)}</p>
                  {rate !== null && (
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{formatPercent(rate)} convert</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-[var(--text-faint)]">
          No day-by-day breakdown or video/engagement tracking exists for this record, so daily charts and the full
          animated funnel aren&apos;t available here — the stages above use the same verified totals shown in Compare.
        </p>
      </GlowPanel>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--panel2)] p-4">
      <p className={`text-2xl font-semibold ${accent ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
