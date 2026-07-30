"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSocialRange } from "@/lib/social/context";
import { useSocialData } from "@/lib/social/use-social-data";
import { CommunityData } from "@/lib/social/types";
import { formatNumber, shortDay } from "@/lib/format";
import { SocialPageHeader, NotConnectedPanel } from "@/components/social/shared";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ComboChart } from "@/components/social/ComboChart";
import { KpiTileRow } from "@/components/social/KpiTileRow";

export default function CommunityPage() {
  const { range } = useSocialRange();
  const { data, loading } = useSocialData<CommunityData>("/api/social/community", range);

  return (
    <div className="mt-8 space-y-5">
      <SocialPageHeader title="Community" />

      {loading ? (
        <CardSkeleton className="h-72" />
      ) : !data?.connected ? (
        <NotConnectedPanel
          title="Instagram Analytics isn't connected yet"
          message={data?.error ?? "Missing Supabase credentials."}
          envVars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      ) : data.growth.length === 0 ? (
        <NotConnectedPanel
          title="No history yet"
          message="Once the daily-account-etl workflow starts polling, follower history will build up here one day at a time."
          envVars={["IG_USER_ID", "IG_ACCESS_TOKEN"]}
        />
      ) : (
        <>
          <div className="panel p-4">
            <p className="mb-3 text-sm font-medium text-[var(--text)]">Growth</p>
            <KpiTileRow
              tiles={[
                { label: "Followers", value: formatNumber(data.growth[data.growth.length - 1].followers) },
                { label: "Following", value: formatNumber(data.growth[data.growth.length - 1].following) },
                { label: "Total content", value: formatNumber(data.growth[data.growth.length - 1].mediaCount) },
              ]}
            />
            <div className="mt-4">
              <ComboChart
                data={data.growth.map((g, i) => ({
                  label: shortDay(g.date),
                  newContent: i === 0 ? 0 : Math.max(0, g.mediaCount - data.growth[i - 1].mediaCount),
                  followers: g.followers,
                  following: g.following,
                }))}
                bar={{ key: "newContent", label: "New content" }}
                lines={[
                  { key: "followers", label: "Followers" },
                  { key: "following", label: "Following" },
                ]}
              />
            </div>
          </div>

          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--text)]">Balance of Followers</p>
              <div className="rounded-xl bg-[#dcf5e6] px-4 py-2">
                <p className="text-lg font-semibold text-[#15803d]">{formatNumber(data.tiles.followersGrowth)}</p>
                <p className="text-[10px] font-medium text-[#15803d] opacity-80">Net change</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.balance.map((b) => ({ ...b, label: shortDay(b.date) }))}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip formatter={(v: number) => formatNumber(v)} />
                <Bar dataKey="delta" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Followers", value: formatNumber(data.growth[data.growth.length - 1].followers) },
              { label: "Daily followers", value: data.tiles.avgFollowersPerDay.toFixed(1) },
              { label: "Followers per post", value: data.tiles.followersPerPost.toFixed(1) },
              { label: "Following", value: formatNumber(data.growth[data.growth.length - 1].following) },
              { label: "Daily posts", value: data.tiles.postsPerDay.toFixed(2) },
              { label: "Posts per week", value: (data.tiles.postsPerDay * 7).toFixed(2) },
            ].map((tile) => (
              <div key={tile.label} className="rounded-xl bg-[var(--panel2)] p-4 text-center">
                <p className="text-xl font-semibold text-[var(--text)]">{tile.value}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{tile.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
