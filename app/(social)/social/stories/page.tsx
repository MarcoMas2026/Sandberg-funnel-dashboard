"use client";

import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSocialRange } from "@/lib/social/context";
import { useSocialData } from "@/lib/social/use-social-data";
import { StoriesData } from "@/lib/social/types";
import { formatDate, formatNumber, shortDay } from "@/lib/format";
import { SocialPageHeader, NotConnectedPanel } from "@/components/social/shared";
import { CardSkeleton } from "@/components/ui/skeleton";

export default function StoriesPage() {
  const { range } = useSocialRange();
  const { data, loading } = useSocialData<StoriesData>("/api/social/media", range, { type: "stories" });

  return (
    <div className="mt-8 space-y-5">
      <SocialPageHeader title="Stories" />

      {loading ? (
        <CardSkeleton className="h-72" />
      ) : !data?.connected ? (
        <NotConnectedPanel
          title="Instagram Analytics isn't connected yet"
          message={data?.error ?? "Missing Supabase credentials."}
          envVars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      ) : data.evolution.length === 0 ? (
        <NotConnectedPanel
          title="No stories captured yet"
          message="Stories only exist for 24h on the API, so this needs the story-poller workflow running every few hours to catch any — nothing to backfill retroactively."
          envVars={["IG_USER_ID", "IG_ACCESS_TOKEN"]}
        />
      ) : (
        <>
          <div className="panel p-4">
            <p className="mb-2 text-sm font-medium text-[var(--text)]">Views &amp; story count</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.evolution.map((e) => ({ ...e, label: shortDay(e.date) }))}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(v: number) => formatNumber(v)} />
                <Line type="monotone" dataKey="views" stroke="#02bbbb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="panel p-4">
            <p className="mb-2 text-sm font-medium text-[var(--text)]">Stories per day</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.evolution.map((e) => ({ ...e, label: shortDay(e.date) }))}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#02bbbb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel overflow-x-auto p-4">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="text-xs text-[var(--text-muted)]">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Reach</th>
                  <th className="pb-2 font-medium">Views</th>
                  <th className="pb-2 font-medium">Replies</th>
                  <th className="pb-2 font-medium">Taps back</th>
                  <th className="pb-2 font-medium">Taps forward</th>
                  <th className="pb-2 font-medium">Exits</th>
                  <th className="pb-2 font-medium">Exit rate</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--panel2)]">
                    <td className="py-2 text-[var(--text)]">{formatDate(item.publishedAt)}</td>
                    <td className="py-2 text-[var(--text)]">{formatNumber(item.metrics.reach ?? 0)}</td>
                    <td className="py-2 text-[var(--text)]">{formatNumber(item.metrics.views ?? 0)}</td>
                    <td className="py-2 text-[var(--text)]">{formatNumber(item.metrics.replies ?? 0)}</td>
                    <td className="py-2 text-[var(--text)]">{formatNumber(item.metrics["navigation:tap_back"] ?? 0)}</td>
                    <td className="py-2 text-[var(--text)]">{formatNumber(item.metrics["navigation:tap_forward"] ?? 0)}</td>
                    <td className="py-2 text-[var(--text)]">{formatNumber(item.metrics["navigation:tap_exit"] ?? 0)}</td>
                    <td className="py-2 text-[var(--text)]">
                      {item.exitRatePct !== null ? `${item.exitRatePct.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
