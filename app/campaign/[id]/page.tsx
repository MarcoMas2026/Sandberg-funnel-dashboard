"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";
import CampaignInfoBar from "@/components/CampaignInfoBar";
import MetricsPanel from "@/components/MetricsPanel";
import SummaryPanel from "@/components/SummaryPanel";
import IsometricFunnel from "@/components/IsometricFunnel";
import LandingEngagementPanel from "@/components/LandingEngagementPanel";
import { FunnelCampaign, LeadRecord } from "@/lib/types";
import { GlowPanel } from "@/components/ui/glow-panel";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

// NaN — same "not recoverable" sentinel lib/format.ts renders as "xxx".
const NA_TAGS = { red: NaN, orange: NaN, blue: NaN };

export default function CampaignPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <CampaignPageInner id={params.id} />
    </Suspense>
  );
}

function CampaignPageInner({ id }: { id: string }) {
  const { data, loading } = useDashboard();
  const [tagCounts, setTagCounts] = useState({ red: 0, orange: 0, blue: 0 });
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month"); // "YYYY-MM", set when linked from a historical Paid Campaigns card

  const campaign = data?.campaigns.find((c) => c.campaign_id === id);

  const [histCampaign, setHistCampaign] = useState<FunnelCampaign | null | undefined>(undefined);

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

  // Campaign not in the live funnel feed (e.g. dropped from lib/config.ts) —
  // reconstruct the same FunnelCampaign shape from Supabase history for the
  // requested month, so the exact same components below can render it.
  useEffect(() => {
    if (campaign || loading || !monthParam) return;
    setHistCampaign(undefined);
    fetch(`/api/history/campaign-detail?id=${encodeURIComponent(id)}&month=${monthParam}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setHistCampaign(json.campaign ?? null))
      .catch(() => setHistCampaign(null));
  }, [campaign, loading, id, monthParam]);

  if (loading) {
    return (
      <div className="space-y-5 pt-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!campaign && monthParam) {
    if (histCampaign === undefined) {
      return (
        <div className="space-y-5 pt-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-72" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }
    if (histCampaign) {
      return <CampaignDetail campaign={histCampaign} tagCounts={NA_TAGS} lastUpdated={null} isHistorical monthLabel={monthLabelFor(monthParam)} />;
    }
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

  return <CampaignDetail campaign={campaign} tagCounts={tagCounts} lastUpdated={data?.last_updated ?? null} />;
}

function monthLabelFor(monthParam: string): string {
  return new Date(`${monthParam}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Same tree for a live campaign and a reconstructed historical month — only
// difference is which FunnelCampaign gets passed in, plus a small banner and
// disabled layer drill-down when it's historical (see IsometricFunnel's
// disableDrilldown — the drill-down pages need data with no historical store
// at all: per-ad breakdowns, Clarity, video).
function CampaignDetail({
  campaign,
  tagCounts,
  lastUpdated,
  isHistorical,
  monthLabel,
}: {
  campaign: FunnelCampaign;
  tagCounts: { red: number; orange: number; blue: number };
  lastUpdated: string | null;
  isHistorical?: boolean;
  monthLabel?: string;
}) {
  return (
    <div className="space-y-5 pt-2">
      {isHistorical && (
        <GlowPanel className="panel p-4">
          <p className="text-xs text-[var(--text-faint)]">
            Reconstructed for {monthLabel} — this campaign is no longer live-tracked, so <strong>xxx</strong> marks numbers that genuinely can't be
            recovered (lead qualification tags, landing-page engagement, Clarity friction, per-ad drill-down). Spend, Meta funnel stages, and
            verified Typeform submissions are real.
          </p>
        </GlowPanel>
      )}
      <CampaignInfoBar campaign={campaign} lastUpdated={lastUpdated} />

      {/* Mobile: Metrics, then Funnel, then Summary/Landing (order-* below).
          Desktop (lg+): unchanged 2-column layout — left stack, right funnel
          spanning its full height — via explicit grid placement. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[35fr_65fr]">
        <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">
          <MetricsPanel meta={campaign.meta} tagCounts={tagCounts} />
        </div>
        <div className="order-2 h-[560px] lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:h-full">
          <IsometricFunnel campaign={campaign} tagCounts={tagCounts} disableDrilldown={isHistorical} />
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
