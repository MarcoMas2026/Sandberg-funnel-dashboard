"use client";

import { useSocialRange } from "@/lib/social/context";
import { useSocialData } from "@/lib/social/use-social-data";
import { SocialSummaryData } from "@/lib/social/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { SocialPageHeader, NotConnectedPanel, Tile } from "@/components/social/shared";
import { CardSkeleton } from "@/components/ui/skeleton";

export default function SocialOverviewPage() {
  const { range, compare } = useSocialRange();
  const { data, loading } = useSocialData<SocialSummaryData>("/api/social/summary", range);

  return (
    <div className="mt-8 space-y-5">
      <SocialPageHeader title="Social" />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <CardSkeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !data?.connected ? (
        <NotConnectedPanel
          title="Instagram Analytics isn't connected yet"
          message={data?.error ?? "Missing Supabase credentials, or the IG account hasn't been linked yet."}
          envVars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      ) : (
        <>
          {data.username && <p className="text-sm text-[var(--text-muted)]">@{data.username}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Tile
              label="Followers"
              value={formatNumber(data.tiles.followers)}
              deltaPct={compare ? data.tiles.followersDeltaPct : undefined}
            />
            <Tile label="Reach" value={formatNumber(data.tiles.reach)} deltaPct={compare ? data.tiles.reachDeltaPct : undefined} />
            <Tile label="Views" value={formatNumber(data.tiles.views)} deltaPct={compare ? data.tiles.viewsDeltaPct : undefined} />
            <Tile
              label="Interactions"
              value={formatNumber(data.tiles.interactions)}
              deltaPct={compare ? data.tiles.interactionsDeltaPct : undefined}
            />
            <Tile
              label="Engagement rate"
              value={formatPercent(data.tiles.engagementRatePct / 100)}
              deltaPct={compare ? data.tiles.engagementRateDeltaPct : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}
