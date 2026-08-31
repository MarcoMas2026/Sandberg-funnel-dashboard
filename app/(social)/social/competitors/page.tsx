"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSocialData } from "@/lib/social/use-social-data";
import { CompetitorsData } from "@/lib/social/types";
import { formatDate, formatNumber, shortDay } from "@/lib/format";
import { SocialPageHeader, NotConnectedPanel } from "@/components/social/shared";
import { CardSkeleton } from "@/components/ui/skeleton";

export default function CompetitorsPage() {
  const { data, loading } = useSocialData<CompetitorsData>("/api/social/competitors");

  return (
    <div className="mt-8 space-y-5">
      <SocialPageHeader title="Competitors" />

      {loading ? (
        <CardSkeleton className="h-72" />
      ) : !data?.connected ? (
        <NotConnectedPanel
          title="Instagram Analytics isn't connected yet"
          message={data?.error ?? "Missing Supabase credentials."}
          envVars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      ) : data.competitors.length === 0 ? (
        <NotConnectedPanel
          title="No competitors tracked yet"
          message="Add competitor IG usernames to the social-competitors n8n workflow (public accounts only — business_discovery doesn't cover reach/views, same limitation Metricool has)."
          envVars={["IG_USER_ID", "IG_ACCESS_TOKEN"]}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.competitors.map((c) => (
            <div key={c.username} className="panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text)]">@{c.username}</p>
                {c.latest && <p className="text-xs text-[var(--text-faint)]">as of {formatDate(c.latest.date)}</p>}
              </div>
              {c.latest && (
                <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniStat label="Followers" value={formatNumber(c.latest.followers)} />
                  <MiniStat
                    label="30d Δ"
                    value={c.followersDelta30d !== null ? formatNumber(c.followersDelta30d) : "—"}
                  />
                  <MiniStat label="Posts" value={formatNumber(c.latest.mediaCount)} />
                  <MiniStat label="Avg likes" value={c.latest.avgLikes.toFixed(0)} />
                </div>
              )}
              {c.history.length > 1 && (
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={c.history.map((h) => ({ ...h, label: shortDay(h.date) }))}>
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Tooltip formatter={(v: number) => formatNumber(v)} />
                    <Line type="monotone" dataKey="followers" stroke="#02bbbb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-faint)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}
