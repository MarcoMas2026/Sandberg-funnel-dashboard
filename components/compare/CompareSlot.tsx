"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { FunnelCampaign, LeadRecord } from "@/lib/types";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import ComparePicker, { CompareCatalogCampaign } from "./ComparePicker";
import SummaryPanel from "@/components/SummaryPanel";
import IsometricFunnel from "@/components/IsometricFunnel";
import { GlowPanel } from "@/components/ui/glow-panel";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

// Same "not recoverable" sentinel used on the campaign detail page for a
// reconstructed historical campaign — lib/format.ts renders it as "xxx".
const NA_TAGS = { red: NaN, orange: NaN, blue: NaN };

export default function CompareSlot({ catalog }: { catalog: CompareCatalogCampaign[] }) {
  const { data } = useDashboard();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historical, setHistorical] = useState<FunnelCampaign | null | undefined>(undefined);
  const [tagCounts, setTagCounts] = useState({ red: 0, orange: 0, blue: 0 });

  const live = data?.campaigns.find((c) => c.campaign_id === selectedId);

  // Only reconstruct from history when the pick isn't in the live feed —
  // same split as the campaign detail page (app/campaign/[id]/page.tsx).
  useEffect(() => {
    if (!selectedId || live) {
      setHistorical(undefined);
      return;
    }
    setHistorical(undefined);
    fetch(`/api/history/campaign-detail?id=${encodeURIComponent(selectedId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setHistorical(json.campaign ?? null))
      .catch(() => setHistorical(null));
  }, [selectedId, live]);

  useEffect(() => {
    if (!live) {
      setTagCounts({ red: 0, orange: 0, blue: 0 });
      return;
    }
    fetch(`/api/leads?campaign_id=${encodeURIComponent(live.campaign_id)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const leads: LeadRecord[] = json.leads ?? [];
        setTagCounts({
          red: leads.filter((l) => l.tag === "red").length,
          orange: leads.filter((l) => l.tag === "orange").length,
          blue: leads.filter((l) => l.tag === "blue").length,
        });
      });
  }, [live?.campaign_id, data?.last_updated]);

  const campaign = live ?? (historical ?? undefined);
  const isHistorical = !live && Boolean(historical);

  return (
    <div className="space-y-4">
      <ComparePicker campaigns={catalog} value={selectedId} onChange={setSelectedId} />

      {!selectedId && (
        <GlowPanel className="panel flex h-96 items-center justify-center p-6 text-center text-sm text-[var(--text-faint)]">
          Pick a campaign to compare
        </GlowPanel>
      )}

      {selectedId && !campaign && historical === undefined && (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <CardSkeleton className="h-24" />
          <Skeleton className="h-96 w-full" />
        </div>
      )}

      {selectedId && !campaign && historical === null && (
        <GlowPanel className="panel flex h-96 items-center justify-center p-6 text-center text-sm text-[var(--text-faint)]">
          No data available for this campaign.
        </GlowPanel>
      )}

      {campaign && (
        <div className="space-y-4">
          <GlowPanel className="panel flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text)]">{campaign.property}</p>
              <p className="truncate text-xs text-[var(--text-faint)]">
                Ref {campaign.ref}
                {campaign.meta.start_date && ` · Started ${formatDate(campaign.meta.start_date)}`}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${
                campaign.status === "ACTIVE"
                  ? "bg-emerald-400/15 text-emerald-600"
                  : "bg-[var(--panel2)] text-[var(--text-faint)]"
              }`}
            >
              {campaign.status === "ACTIVE" ? "Live" : "Inactive"}
            </span>
          </GlowPanel>

          <SummaryPanel meta={campaign.meta} campaignId={campaign.campaign_id} />

          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Click → form start" value={formatPercent(campaign.derived.click_to_form_start_rate, 1)} />
            <MiniStat label="Form completion" value={formatPercent(campaign.derived.form_completion_rate, 1)} />
            <MiniStat label="Cost / qualified lead" value={formatCurrency(campaign.derived.cost_per_qualified_lead, 2)} />
            <MiniStat label="Landing page views" value={campaign.landing_engagement.page_views.toLocaleString()} />
          </div>

          <div className="h-[520px]">
            <IsometricFunnel campaign={campaign} tagCounts={isHistorical ? NA_TAGS : tagCounts} disableDrilldown />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--panel2)] p-3">
      <p className="text-base font-semibold text-[var(--text)]">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
