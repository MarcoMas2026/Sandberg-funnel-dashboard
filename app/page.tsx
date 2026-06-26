"use client";

import { useDashboard } from "@/lib/dashboard-context";
import CampaignCard from "@/components/CampaignCard";

export default function OverviewPage() {
  const { data, loading } = useDashboard();

  const active = (data?.campaigns ?? []).filter((c) => c.status === "ACTIVE");

  return (
    <div className="pt-2">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Active Campaigns</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Select a campaign to explore its full marketing funnel
        </p>
      </div>

      {loading && (
        <p className="text-sm text-[var(--text-muted)]">Loading campaigns…</p>
      )}

      {!loading && active.length === 0 && (
        <div className="panel flex flex-col items-center justify-center py-24 text-center">
          <p className="text-base font-medium text-white">No active campaigns</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Click Update to load your funnel data
          </p>
        </div>
      )}

      {!loading && active.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((c) => (
            <CampaignCard key={c.campaign_id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}
