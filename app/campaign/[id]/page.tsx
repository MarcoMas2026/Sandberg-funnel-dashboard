"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboard } from "@/lib/dashboard-context";
import CampaignInfoBar from "@/components/CampaignInfoBar";
import MetricsPanel from "@/components/MetricsPanel";
import SummaryPanel from "@/components/SummaryPanel";
import MarketingFunnel from "@/components/MarketingFunnel";
import { LeadRecord } from "@/lib/types";

export default function CampaignPage({ params }: { params: { id: string } }) {
  const { data, loading } = useDashboard();
  const [tagCounts, setTagCounts] = useState({ red: 0, orange: 0, blue: 0 });

  const campaign = data?.campaigns.find((c) => c.campaign_id === params.id);

  useEffect(() => {
    if (!campaign) return;
    fetch(`/api/leads?campaign_id=${encodeURIComponent(campaign.campaign_id)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const leads: LeadRecord[] = json.leads ?? [];
        setTagCounts({
          red: leads.filter((l) => l.tag === "red").length,
          orange: leads.filter((l) => l.tag === "orange").length,
          blue: leads.filter((l) => l.tag === "blue").length,
        });
      });
  }, [campaign?.campaign_id]);

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
        <MarketingFunnel campaign={campaign} tagCounts={tagCounts} />
      </div>
    </div>
  );
}
