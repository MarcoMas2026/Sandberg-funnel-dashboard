"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboard } from "@/lib/dashboard-context";
import CampaignInfoBar from "@/components/CampaignInfoBar";
import MetricsPanel from "@/components/MetricsPanel";
import SummaryPanel from "@/components/SummaryPanel";
import IsometricFunnel from "@/components/IsometricFunnel";
import LandingEngagementPanel from "@/components/LandingEngagementPanel";
import { LeadRecord } from "@/lib/types";

export default function CampaignPage({ params }: { params: { id: string } }) {
  const { data, loading } = useDashboard();
  const [tagCounts, setTagCounts] = useState({ red: 0, orange: 0, blue: 0 });

  const campaign = data?.campaigns.find((c) => c.campaign_id === params.id);

  // Re-pulls tag counts whenever the shared dashboard data refreshes (not just
  // on first mount), so this panel stays in step with every other element
  // fed by the same funnel:merged snapshot.
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
  }, [campaign?.campaign_id, data?.last_updated]);

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

      {/* Mobile: Metrics, then Funnel, then Summary/Landing (order-* below).
          Desktop (lg+): unchanged 2-column layout — left stack, right funnel
          spanning its full height — via explicit grid placement. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[35fr_65fr]">
        <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">
          <MetricsPanel meta={campaign.meta} tagCounts={tagCounts} />
        </div>
        <div className="order-2 h-[560px] lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:h-full">
          <IsometricFunnel campaign={campaign} tagCounts={tagCounts} />
        </div>
        <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2">
          <SummaryPanel meta={campaign.meta} />
        </div>
        <div className="order-4 lg:order-none lg:col-start-1 lg:row-start-3">
          <LandingEngagementPanel engagement={campaign.landing_engagement} />
        </div>
      </div>
    </div>
  );
}
