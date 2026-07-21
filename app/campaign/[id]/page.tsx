"use client";

import Link from "next/link";
import { useDashboard } from "@/lib/dashboard-context";
import CampaignInfoBar from "@/components/CampaignInfoBar";
import MetricsPanel from "@/components/MetricsPanel";
import SummaryPanel from "@/components/SummaryPanel";
import MarketingFunnel from "@/components/MarketingFunnel";

export default function CampaignPage({ params }: { params: { id: string } }) {
  const { data, loading } = useDashboard();

  const campaign = data?.campaigns.find((c) => c.campaign_id === params.id);

  if (loading) {
    return <p className="pt-2 text-sm text-[var(--text-muted)]">Loading campaign…</p>;
  }

  if (!campaign) {
    return (
      <div className="pt-2">
        <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          ← Back to overview
        </Link>
        <p className="mt-6 text-sm text-[var(--text-muted)]">Campaign not found.</p>
      </div>
    );
  }

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
