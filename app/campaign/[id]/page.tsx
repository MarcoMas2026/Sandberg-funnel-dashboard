"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDashboard } from "@/lib/dashboard-context";
import { HistoricalCampaign } from "@/lib/types";
import { todayISOMadrid } from "@/lib/format";
import { buildPreviewFunnelCampaign } from "@/lib/historical-preview";
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

  const liveCampaign = data?.campaigns.find((c) => c.campaign_id === params.id);
  const historicalCampaign = historical.find((h) => h.campaign_id === params.id);

  // Historical-only records have no daily/video/engagement breakdown, only
  // lifetime totals — buildPreviewFunnelCampaign spreads each real total
  // across a modeled multi-day curve so the same graphs + funnel UI used for
  // live campaigns can render here too. Every total shown is real; only the
  // day-by-day split is modeled (deterministically, so it's stable on
  // reload). Memoized on the campaign id so it doesn't reshuffle every
  // render.
  const previewCampaign = useMemo(
    () => (historicalCampaign ? buildPreviewFunnelCampaign(historicalCampaign, todayISOMadrid()) : null),
    [historicalCampaign]
  );

  const campaign = liveCampaign ?? previewCampaign;
  const isPreview = !liveCampaign && !!previewCampaign;

  if (loading || (!liveCampaign && historicalLoading)) {
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
      {isPreview && (
        <div
          className="flex items-center gap-2 rounded-full bg-[var(--panel2)] px-4 py-2 text-xs text-[var(--text-faint)] w-fit"
          title="Totals are real (verified historical record); the day-by-day split is modeled, since this campaign isn't in the live Meta feed right now"
        >
          Preview — real totals, modeled daily breakdown (not live)
        </div>
      )}
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
