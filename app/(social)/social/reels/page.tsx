"use client";

import { useSocialRange } from "@/lib/social/context";
import { useSocialData } from "@/lib/social/use-social-data";
import { ReelsData } from "@/lib/social/types";
import { formatDate, formatDuration, formatNumber, formatPercent, shortDay } from "@/lib/format";
import { SocialPageHeader, NotConnectedPanel } from "@/components/social/shared";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ComboChart } from "@/components/social/ComboChart";
import { KpiTileRow } from "@/components/social/KpiTileRow";
import { DataTable, DataTableColumn } from "@/components/social/DataTable";
import { bucketMediaByDay } from "@/lib/social/period-series";

type ReelItem = ReelsData["items"][number];

const columns: DataTableColumn<ReelItem>[] = [
  { key: "date", label: "Date", render: (m) => formatDate(m.publishedAt), csvValue: (m) => m.publishedAt, sortValue: (m) => new Date(m.publishedAt).getTime() },
  { key: "reach", label: "Reach", render: (m) => formatNumber(m.metrics.reach ?? 0), csvValue: (m) => m.metrics.reach ?? 0, sortValue: (m) => m.metrics.reach ?? 0 },
  { key: "views", label: "Views", render: (m) => formatNumber(m.metrics.views ?? 0), csvValue: (m) => m.metrics.views ?? 0, sortValue: (m) => m.metrics.views ?? 0 },
  {
    key: "interactions",
    label: "Interactions",
    render: (m) => formatNumber(m.metrics.total_interactions ?? 0),
    csvValue: (m) => m.metrics.total_interactions ?? 0,
    sortValue: (m) => m.metrics.total_interactions ?? 0,
  },
  {
    key: "eng",
    label: "Eng. %",
    render: (m) => (m.engagementRate !== null ? `${m.engagementRate.toFixed(1)}%` : "—"),
    csvValue: (m) => (m.engagementRate !== null ? m.engagementRate.toFixed(1) : ""),
    sortValue: (m) => m.engagementRate ?? 0,
  },
  {
    key: "watch",
    label: "Avg watch time",
    render: (m) => (m.avgWatchTimeS !== null ? formatDuration(m.avgWatchTimeS) : "—"),
    csvValue: (m) => m.avgWatchTimeS ?? "",
    sortValue: (m) => m.avgWatchTimeS ?? 0,
  },
  {
    key: "duration",
    label: "Duration",
    render: (m) => (m.durationS ? formatDuration(m.durationS) : "—"),
    csvValue: (m) => m.durationS ?? "",
    sortValue: (m) => m.durationS ?? 0,
  },
  {
    key: "retention",
    label: "Retention %",
    render: (m) => (m.retentionPct !== null ? `${m.retentionPct.toFixed(1)}%` : "—"),
    csvValue: (m) => (m.retentionPct !== null ? m.retentionPct.toFixed(1) : ""),
    sortValue: (m) => m.retentionPct ?? 0,
  },
];

export default function ReelsPage() {
  const { range } = useSocialRange();
  const { data, loading } = useSocialData<ReelsData>("/api/social/media", range, { type: "reels" });

  const periodSeries = data ? bucketMediaByDay(data.items) : [];
  const totalLikes = data ? data.items.reduce((s, i) => s + (i.metrics.likes ?? 0), 0) : 0;
  const totalComments = data ? data.items.reduce((s, i) => s + (i.metrics.comments ?? 0), 0) : 0;
  const totalSaved = data ? data.items.reduce((s, i) => s + (i.metrics.saved ?? 0), 0) : 0;
  const totalShares = data ? data.items.reduce((s, i) => s + (i.metrics.shares ?? 0), 0) : 0;

  return (
    <div className="mt-8 space-y-5">
      <SocialPageHeader title="Reels" />

      {loading ? (
        <CardSkeleton className="h-72" />
      ) : !data?.connected ? (
        <NotConnectedPanel
          title="Instagram Analytics isn't connected yet"
          message={data?.error ?? "Missing Supabase credentials."}
          envVars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      ) : (
        <>
          <div className="panel p-4">
            <p className="mb-3 text-sm font-medium text-[var(--text)]">Reels published in period</p>
            <KpiTileRow
              tiles={[
                { label: "Engagement", value: formatPercent(data.tiles.engagementRate / 100) },
                { label: "Interactions", value: formatNumber(data.tiles.totalInteractions) },
                { label: "Avg reach/reel", value: formatNumber(data.tiles.avgReachPerReel) },
                { label: "Views", value: formatNumber(data.tiles.totalViews) },
                { label: "Reels", value: formatNumber(data.tiles.reelCount) },
              ]}
            />
            {periodSeries.length > 0 && (
              <div className="mt-4">
                <ComboChart
                  data={periodSeries.map((d) => ({ label: shortDay(d.date), views: d.views, reach: d.reach, interactions: d.interactions }))}
                  bar={{ key: "views", label: "Views" }}
                  lines={[
                    { key: "reach", label: "Reach" },
                    { key: "interactions", label: "Interactions" },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="panel p-4">
            <p className="mb-3 text-sm font-medium text-[var(--text)]">Organic interactions</p>
            <KpiTileRow
              tiles={[
                { label: "Likes", value: formatNumber(totalLikes) },
                { label: "Comments", value: formatNumber(totalComments) },
                { label: "Saved", value: formatNumber(totalSaved) },
                { label: "Shares", value: formatNumber(totalShares) },
              ]}
            />
          </div>

          {data.items.length === 0 ? (
            <NotConnectedPanel
              title="No reels in this range yet"
              message="Once the media-sync workflow has run, reels published in this period will appear here."
              envVars={["IG_USER_ID", "IG_ACCESS_TOKEN"]}
            />
          ) : (
            <div className="panel p-4">
              <p className="mb-3 text-sm font-medium text-[var(--text)]">List of reels</p>
              <DataTable
                rows={data.items}
                columns={columns}
                rowKey={(m) => m.id}
                getSearchText={(m) => m.caption ?? ""}
                csvFilename="reels.csv"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
