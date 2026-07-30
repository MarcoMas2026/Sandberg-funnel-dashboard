"use client";

import { useState } from "react";
import { useSocialRange } from "@/lib/social/context";
import { useSocialData } from "@/lib/social/use-social-data";
import { AccountData } from "@/lib/social/types";
import { formatNumber, shortDay } from "@/lib/format";
import { SocialPageHeader, NotConnectedPanel } from "@/components/social/shared";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ComboChart } from "@/components/social/ComboChart";
import { KpiTileRow } from "@/components/social/KpiTileRow";

const TABS = ["General evolution", "Reach / Views", "Interactions", "Profile activity"] as const;
type Tab = (typeof TABS)[number];

function sum(points: { value: number }[]) {
  return points.reduce((s, p) => s + p.value, 0);
}
function avg(points: { value: number }[]) {
  return points.length ? sum(points) / points.length : 0;
}

export default function AccountPage() {
  const { range } = useSocialRange();
  const { data, loading } = useSocialData<AccountData>("/api/social/account", range);
  const [tab, setTab] = useState<Tab>("General evolution");

  return (
    <div className="mt-8 space-y-5">
      <SocialPageHeader title="Account" />

      {loading ? (
        <CardSkeleton className="h-72" />
      ) : !data?.connected ? (
        <NotConnectedPanel
          title="Instagram Analytics isn't connected yet"
          message={data?.error ?? "Missing Supabase credentials."}
          envVars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      ) : data.reach.length === 0 ? (
        <NotConnectedPanel
          title="No account insights yet"
          message="Once the daily-account-etl workflow has run, reach/views/interactions will appear here."
          envVars={["IG_USER_ID", "IG_ACCESS_TOKEN"]}
        />
      ) : (
        <div className="panel p-4">
          <div className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-[var(--panel2)] p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  tab === t ? "bg-[var(--panel)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "General evolution" && (
            <>
              <KpiTileRow
                tiles={[
                  { label: "Views", value: formatNumber(sum(data.views)) },
                  { label: "Avg. reach per day", value: formatNumber(avg(data.reach)) },
                  { label: "Accounts engaged", value: formatNumber(sum(data.accountsEngagedDaily)) },
                  { label: "Total interactions", value: formatNumber(data.interactions.reduce((s, d) => s + d.total, 0)) },
                ]}
              />
              <div className="mt-4">
                <ComboChart
                  data={data.views.map((v, i) => ({
                    label: shortDay(v.date),
                    views: v.value,
                    reach: data.reach[i]?.value ?? 0,
                    accountsEngaged: data.accountsEngagedDaily[i]?.value ?? 0,
                  }))}
                  bar={{ key: "views", label: "Views" }}
                  lines={[
                    { key: "reach", label: "Reach" },
                    { key: "accountsEngaged", label: "Accounts engaged" },
                  ]}
                />
              </div>
            </>
          )}

          {tab === "Reach / Views" && (
            <>
              <KpiTileRow
                tiles={[
                  { label: "Total reach", value: formatNumber(sum(data.reach)) },
                  { label: "Total views", value: formatNumber(sum(data.views)) },
                ]}
              />
              <div className="mt-4">
                <ComboChart
                  data={data.reach.map((r, i) => ({ label: shortDay(r.date), views: data.views[i]?.value ?? 0, reach: r.value }))}
                  bar={{ key: "views", label: "Views" }}
                  lines={[{ key: "reach", label: "Reach" }]}
                />
              </div>
            </>
          )}

          {tab === "Interactions" && (
            <>
              <KpiTileRow
                tiles={[
                  { label: "Likes", value: formatNumber(data.interactions.reduce((s, d) => s + d.likes, 0)) },
                  { label: "Comments", value: formatNumber(data.interactions.reduce((s, d) => s + d.comments, 0)) },
                  { label: "Saves", value: formatNumber(data.interactions.reduce((s, d) => s + d.saves, 0)) },
                  { label: "Shares", value: formatNumber(data.interactions.reduce((s, d) => s + d.shares, 0)) },
                ]}
              />
              <div className="mt-4">
                <ComboChart
                  data={data.interactions.map((d) => ({ label: shortDay(d.date), total: d.total, likes: d.likes, comments: d.comments }))}
                  bar={{ key: "total", label: "Total interactions" }}
                  lines={[
                    { key: "likes", label: "Likes" },
                    { key: "comments", label: "Comments" },
                  ]}
                />
              </div>
            </>
          )}

          {tab === "Profile activity" && (
            <>
              <KpiTileRow
                tiles={[
                  { label: "Accounts engaged", value: formatNumber(data.profileActivity.accountsEngaged) },
                  {
                    label: "Profile link taps",
                    value: formatNumber(data.profileActivity.profileLinkTaps.reduce((s, t) => s + t.value, 0)),
                  },
                ]}
              />
              {data.profileActivity.profileLinkTaps.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {data.profileActivity.profileLinkTaps.map((e) => (
                    <div key={e.type} className="rounded-xl bg-[var(--panel2)] px-4 py-2">
                      <p className="text-xs text-[var(--text-muted)]">{e.type}</p>
                      <p className="text-lg font-semibold text-[var(--text)]">{formatNumber(e.value)}</p>
                    </div>
                  ))}
                </div>
              )}
              {data.viewsBreakdown.byFollowerType.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">Views by follower type</p>
                  <div className="flex flex-wrap gap-3">
                    {data.viewsBreakdown.byFollowerType.map((e) => (
                      <div key={e.key} className="rounded-xl bg-[var(--panel2)] px-4 py-2">
                        <p className="text-xs text-[var(--text-muted)]">{e.key}</p>
                        <p className="text-lg font-semibold text-[var(--text)]">{formatNumber(e.value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
