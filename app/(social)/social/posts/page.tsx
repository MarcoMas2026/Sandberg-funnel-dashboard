"use client";

import { useSocialRange } from "@/lib/social/context";
import { useSocialData } from "@/lib/social/use-social-data";
import { PostsData, HashtagsData, HeatmapData, MediaItem } from "@/lib/social/types";
import { formatDate, formatNumber, formatPercent, shortDay } from "@/lib/format";
import { SocialPageHeader, NotConnectedPanel } from "@/components/social/shared";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { ComboChart } from "@/components/social/ComboChart";
import { KpiTileRow } from "@/components/social/KpiTileRow";
import { DataTable, DataTableColumn } from "@/components/social/DataTable";
import { bucketMediaByDay } from "@/lib/social/period-series";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const columns: DataTableColumn<MediaItem>[] = [
  { key: "date", label: "Date", render: (m) => formatDate(m.publishedAt), csvValue: (m) => m.publishedAt, sortValue: (m) => new Date(m.publishedAt).getTime() },
  { key: "type", label: "Type", render: (m) => m.mediaType ?? "—", csvValue: (m) => m.mediaType ?? "" },
  { key: "reach", label: "Reach", render: (m) => formatNumber(m.metrics.reach ?? 0), csvValue: (m) => m.metrics.reach ?? 0, sortValue: (m) => m.metrics.reach ?? 0 },
  { key: "views", label: "Views", render: (m) => formatNumber(m.metrics.views ?? 0), csvValue: (m) => m.metrics.views ?? 0, sortValue: (m) => m.metrics.views ?? 0 },
  { key: "likes", label: "Likes", render: (m) => formatNumber(m.metrics.likes ?? 0), csvValue: (m) => m.metrics.likes ?? 0, sortValue: (m) => m.metrics.likes ?? 0 },
  { key: "comments", label: "Comments", render: (m) => formatNumber(m.metrics.comments ?? 0), csvValue: (m) => m.metrics.comments ?? 0, sortValue: (m) => m.metrics.comments ?? 0 },
  { key: "saved", label: "Saved", render: (m) => formatNumber(m.metrics.saved ?? 0), csvValue: (m) => m.metrics.saved ?? 0, sortValue: (m) => m.metrics.saved ?? 0 },
  { key: "shares", label: "Shares", render: (m) => formatNumber(m.metrics.shares ?? 0), csvValue: (m) => m.metrics.shares ?? 0, sortValue: (m) => m.metrics.shares ?? 0 },
  {
    key: "eng",
    label: "Eng. %",
    render: (m) => (m.engagementRate !== null ? `${m.engagementRate.toFixed(1)}%` : "—"),
    csvValue: (m) => (m.engagementRate !== null ? m.engagementRate.toFixed(1) : ""),
    sortValue: (m) => m.engagementRate ?? 0,
  },
];

export default function PostsPage() {
  const { range } = useSocialRange();
  const { data, loading } = useSocialData<PostsData>("/api/social/media", range, { type: "posts" });
  const { data: hashtags } = useSocialData<HashtagsData>("/api/social/hashtags", range);
  const { data: heatmap } = useSocialData<HeatmapData>("/api/social/heatmap");

  const periodSeries = data ? bucketMediaByDay(data.items) : [];

  return (
    <div className="mt-8 space-y-5">
      <SocialPageHeader title="Posts" />

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
            <p className="mb-3 text-sm font-medium text-[var(--text)]">Posts published in period</p>
            <KpiTileRow
              tiles={[
                { label: "Engagement", value: formatPercent(data.tiles.engagementRate / 100) },
                { label: "Interactions", value: formatNumber(data.tiles.totalInteractions) },
                { label: "Avg reach/post", value: formatNumber(data.tiles.avgReachPerPost) },
                { label: "Views", value: formatNumber(data.tiles.totalViews) },
                { label: "Posts", value: formatNumber(data.tiles.postCount) },
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
                { label: "Likes", value: formatNumber(data.interactions.likes) },
                { label: "Comments", value: formatNumber(data.interactions.comments) },
                { label: "Saved", value: formatNumber(data.interactions.saved) },
                { label: "Shares", value: formatNumber(data.interactions.shares) },
              ]}
            />
          </div>

          {data.items.length === 0 ? (
            <NotConnectedPanel
              title="No posts in this range yet"
              message="Once the media-sync workflow has run, posts published in this period will appear here."
              envVars={["IG_USER_ID", "IG_ACCESS_TOKEN"]}
            />
          ) : (
            <div className="panel p-4">
              <p className="mb-3 text-sm font-medium text-[var(--text)]">List of posts</p>
              <DataTable
                rows={data.items}
                columns={columns}
                rowKey={(m) => m.id}
                getSearchText={(m) => m.caption ?? ""}
                csvFilename="posts.csv"
              />
            </div>
          )}

          <div className="panel p-4">
            <p className="mb-2 text-sm font-medium text-[var(--text)]">Hashtags</p>
            {!hashtags ? (
              <TableSkeleton rows={3} cols={4} />
            ) : hashtags.hashtags.length === 0 ? (
              <p className="text-xs text-[var(--text-faint)]">No hashtags found in captions for this period.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-[var(--text-muted)]">
                    <th className="pb-2 font-medium">Hashtag</th>
                    <th className="pb-2 font-medium">Posts</th>
                    <th className="pb-2 font-medium">Total views</th>
                    <th className="pb-2 font-medium">Avg likes</th>
                    <th className="pb-2 font-medium">Avg comments</th>
                  </tr>
                </thead>
                <tbody>
                  {hashtags.hashtags.slice(0, 15).map((h) => (
                    <tr key={h.hashtag} className="border-t border-[var(--panel2)]">
                      <td className="py-2 text-[var(--text)]">#{h.hashtag}</td>
                      <td className="py-2 text-[var(--text)]">{h.posts}</td>
                      <td className="py-2 text-[var(--text)]">{formatNumber(h.totalViews)}</td>
                      <td className="py-2 text-[var(--text)]">{h.avgLikes.toFixed(1)}</td>
                      <td className="py-2 text-[var(--text)]">{h.avgComments.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel overflow-x-auto p-4">
            <p className="mb-2 text-sm font-medium text-[var(--text)]">Best time to post</p>
            <p className="mb-3 text-xs text-[var(--text-faint)]">
              Based on average reach of your own historical posts &amp; reels, bucketed by publish weekday/hour.
            </p>
            {!heatmap || heatmap.cells.length === 0 ? (
              <p className="text-xs text-[var(--text-faint)]">Not enough published history yet.</p>
            ) : (
              <HeatmapGrid cells={heatmap.cells} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function HeatmapGrid({ cells }: { cells: HeatmapData["cells"] }) {
  const max = Math.max(1, ...cells.map((c) => c.avgReach));
  const byKey = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c]));
  return (
    <div className="min-w-[720px]">
      <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5">
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center text-[9px] text-[var(--text-faint)]">
            {h}
          </div>
        ))}
        {WEEKDAY_LABELS.map((label, weekday) => (
          <div key={label} className="contents">
            <div className="flex items-center text-[10px] text-[var(--text-muted)]">{label}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = byKey.get(`${weekday}:${hour}`);
              const intensity = cell ? cell.avgReach / max : 0;
              return (
                <div
                  key={hour}
                  title={cell ? `${label} ${hour}:00 — avg reach ${Math.round(cell.avgReach)} (n=${cell.sampleSize})` : ""}
                  className="aspect-square rounded-sm"
                  style={{ backgroundColor: `rgba(27,37,64,${0.08 + intensity * 0.85})` }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
