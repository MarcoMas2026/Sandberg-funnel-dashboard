"use client";

import { useEffect, useMemo, useState } from "react";
import { GlowPanel } from "@/components/ui/glow-panel";
import { NotConnectedPanel } from "@/components/social/shared";
import { Sparkline } from "@/components/viz";
import { formatDate } from "@/lib/format";
import type { CompetitorAdSnapshot } from "@/lib/types";

interface LiveResponse {
  connected: boolean;
  lastUpdated: string | null;
  ads: CompetitorAdSnapshot[];
  error?: string;
}

interface SummaryRow {
  competitor_key: string;
  competitor_label: string;
  tier: "local" | "global";
  active_ad_count: number;
  longest_running_days: number | null;
  last_new_ad_date: string | null;
}

interface FeedItem {
  ad_archive_id: string;
  competitor_key: string;
  competitor_label: string;
  tier: "local" | "global";
  ad_creative_body: string | null;
  ad_creative_link_title: string | null;
  ad_snapshot_url: string | null;
  publisher_platforms: string[];
  languages: string[];
  first_seen_date: string;
  ad_delivery_start_time: string | null;
}

interface TrendPoint {
  date: string;
  competitor_key: string;
  active_ad_count: number;
}

interface HistoryResponse {
  connected: boolean;
  summary: SummaryRow[];
  feed: FeedItem[];
  trend: TrendPoint[];
  error?: string;
}

function daysAgoLabel(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "today";
  return `${days}d`;
}

export default function CompetitorAdsPage() {
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/competitor-ads/live", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/competitor-ads/history?days=30", { cache: "no-store" }).then((res) => res.json()),
    ])
      .then(([liveJson, historyJson]) => {
        setLive(liveJson);
        setHistory(historyJson);
      })
      .finally(() => setLoading(false));
  }, []);

  const trendByCompetitor = useMemo(() => {
    const map = new Map<string, TrendPoint[]>();
    for (const point of history?.trend ?? []) {
      if (!map.has(point.competitor_key)) map.set(point.competitor_key, []);
      map.get(point.competitor_key)!.push(point);
    }
    return map;
  }, [history]);

  const newThisWeek = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return (history?.feed ?? []).filter((f) => f.first_seen_date >= cutoffStr).length;
  }, [history]);

  const activeCompetitorCount = (history?.summary ?? []).filter((s) => s.active_ad_count > 0).length;

  return (
    <div className="space-y-5 pt-2">
      <GlowPanel className="panel p-5">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-[var(--text)]">Competitor Ads</h1>
          <span className="text-xs text-[var(--text-faint)]">
            Live creative from the Meta Ads Library — Mallorca competitors + global luxury brands
          </span>
        </div>
        <p className="mt-3 text-xs text-[var(--text-faint)]">
          Meta only discloses spend/impressions for political ads — this tracks creative, cadence,
          and reach markets, not competitor spend.
        </p>
      </GlowPanel>

      {loading ? (
        <GlowPanel className="panel p-6">
          <p className="text-sm text-[var(--text-faint)]">Loading…</p>
        </GlowPanel>
      ) : !live?.connected || !history?.connected ? (
        <NotConnectedPanel
          title="Competitor Ads isn't connected yet"
          message={live?.error ?? history?.error ?? "Missing KV or Supabase credentials."}
          envVars={["KV_REST_API_URL", "KV_REST_API_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      ) : (live.ads.length === 0 && history.summary.length === 0) ? (
        <NotConnectedPanel
          title="No competitor ad data yet"
          message="The Ads Library Sync n8n workflow hasn't run yet, or none of the tracked competitors currently have active ads."
          envVars={["META_ADS_LIBRARY_TOKEN"]}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Active ads tracked" value={live.ads.length} />
            <StatCard label="Competitors with activity" value={activeCompetitorCount} />
            <StatCard label="New ads this week" value={newThisWeek} />
          </div>

          <GlowPanel className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                By competitor
              </h2>
              {live.lastUpdated && (
                <span className="text-[11px] text-[var(--text-faint)]">
                  last synced {formatDate(live.lastUpdated)}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                    <th className="pb-2 pl-1">Competitor</th>
                    <th className="pb-2">Tier</th>
                    <th className="pb-2 text-right">Active ads</th>
                    <th className="pb-2 text-right">Longest running</th>
                    <th className="pb-2 text-right">Last new ad</th>
                    <th className="pb-2 pr-1 text-right">30d trend</th>
                  </tr>
                </thead>
                <tbody>
                  {history.summary.map((row) => {
                    const trend = trendByCompetitor.get(row.competitor_key) ?? [];
                    return (
                      <tr key={row.competitor_key} className="border-t border-[var(--border)]">
                        <td className="py-2.5 pl-1 font-medium text-[var(--text)]">{row.competitor_label}</td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              row.tier === "local"
                                ? "border-[var(--accent)]/40 text-[var(--accent)]"
                                : "border-[var(--border-strong)] text-[var(--text-faint)]"
                            }`}
                          >
                            {row.tier === "local" ? "Mallorca" : "Global"}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums text-[var(--text)]">
                          {row.active_ad_count}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-[var(--text-faint)]">
                          {row.longest_running_days !== null ? `${row.longest_running_days}d` : "—"}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-[var(--text-faint)]">
                          {row.last_new_ad_date ? daysAgoLabel(daysSince(row.last_new_ad_date)) : "—"}
                        </td>
                        <td className="py-2.5 pr-1 text-right">
                          {trend.length > 1 ? (
                            <Sparkline data={trend.map((t) => t.active_ad_count)} width={90} height={28} />
                          ) : (
                            <span className="text-[11px] text-[var(--text-faint)]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlowPanel>

          <GlowPanel className="panel p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              Recent ad feed
            </h2>
            {history.feed.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)]">No ads observed yet.</p>
            ) : (
              <div className="space-y-3">
                {history.feed.slice(0, 30).map((ad) => (
                  <div
                    key={ad.ad_archive_id}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel2)] p-4"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-[var(--text)]">{ad.competitor_label}</span>
                      <span className="shrink-0 text-[11px] text-[var(--text-faint)]">
                        first seen {formatDate(ad.first_seen_date)}
                      </span>
                    </div>
                    {ad.ad_creative_link_title && (
                      <p className="text-[13px] font-medium text-[var(--text)]">{ad.ad_creative_link_title}</p>
                    )}
                    {ad.ad_creative_body && (
                      <p className="mt-1 line-clamp-2 text-[12px] text-[var(--text-muted)]">{ad.ad_creative_body}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {ad.publisher_platforms.map((p) => (
                        <span
                          key={p}
                          className="rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[10px] text-[var(--text-faint)]"
                        >
                          {p}
                        </span>
                      ))}
                      {ad.ad_snapshot_url && (
                        <a
                          href={ad.ad_snapshot_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-[11px] font-medium text-[var(--accent)] hover:underline"
                        >
                          View on Facebook →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlowPanel>
        </>
      )}
    </div>
  );
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr + "T00:00:00Z").getTime();
  return Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <GlowPanel className="panel p-4">
      <p className="text-xs font-medium text-[var(--text-faint)]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-[var(--text)]">{value}</p>
    </GlowPanel>
  );
}
