"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Binoculars,
  Buildings,
  Eye,
  FacebookLogo,
  Fire,
  InstagramLogo,
  ArrowSquareOut,
  Sparkle,
} from "@phosphor-icons/react";
import { GlowPanel } from "@/components/ui/glow-panel";
import { NotConnectedPanel } from "@/components/social/shared";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Sparkline, CountUp } from "@/components/viz";
import { formatDate, formatNumber } from "@/lib/format";
import { COMPETITOR_MAP } from "@/lib/config";
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

type TierFilter = "all" | "local" | "global";

const TIER_COLOR: Record<"local" | "global", string> = {
  local: "#02bbbb",
  global: "#8b8b8b",
};

const PLATFORM_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  facebook: FacebookLogo,
  instagram: InstagramLogo,
};

function daysSince(dateStr: string): number {
  const then = new Date(dateStr + "T00:00:00Z").getTime();
  return Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
}

function daysAgoLabel(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "today";
  return `${days}d ago`;
}

function initials(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function CompetitorAdsPage() {
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

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

  const longestRunningOverall = useMemo(() => {
    const days = (history?.summary ?? []).map((s) => s.longest_running_days ?? 0);
    return days.length ? Math.max(...days) : 0;
  }, [history]);

  const activeCompetitorCount = (history?.summary ?? []).filter((s) => s.active_ad_count > 0).length;

  const filteredSummary = useMemo(
    () => (history?.summary ?? []).filter((s) => tierFilter === "all" || s.tier === tierFilter),
    [history, tierFilter]
  );
  const filteredFeed = useMemo(
    () => (history?.feed ?? []).filter((f) => tierFilter === "all" || f.tier === tierFilter),
    [history, tierFilter]
  );

  const localCount = (history?.summary ?? []).filter((s) => s.tier === "local").length;
  const globalCount = (history?.summary ?? []).filter((s) => s.tier === "global").length;

  const isConnected = live?.connected && history?.connected;
  const hasData = (live?.ads.length ?? 0) > 0 || (history?.summary.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
            <Binoculars className="h-3.5 w-3.5" />
            Competitor Intelligence
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Competitor Ads</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Live creative from the Meta Ads Library — Mallorca competitors and global luxury brands.
            Meta only discloses spend for political ads, so this tracks creative, cadence, and reach — not spend.
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-[var(--panel2)] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
          {loading ? (
            "Loading…"
          ) : !isConnected ? (
            "Not connected"
          ) : hasData ? (
            <>
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live · {live?.ads.length ?? 0} ad{live?.ads.length === 1 ? "" : "s"} tracked
            </>
          ) : (
            "Connected · awaiting first sync"
          )}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !isConnected ? (
        <NotConnectedPanel
          title="Competitor Ads isn't connected yet"
          message={live?.error ?? history?.error ?? "Missing KV or Supabase credentials."}
          envVars={["KV_REST_API_URL", "KV_REST_API_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      ) : !hasData ? (
        <div className="fade-up space-y-4">
          <GlowPanel className="panel p-5">
            <p className="text-sm font-medium text-[var(--text)]">No ad data synced yet</p>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              The Ads Library Sync n8n workflow hasn't landed a successful pull yet — the {COMPETITOR_MAP.length}{" "}
              competitors below are configured and waiting on the first run.
            </p>
          </GlowPanel>
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              Tracked competitors ({COMPETITOR_MAP.length})
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {COMPETITOR_MAP.map((c, i) => {
                const color = TIER_COLOR[c.tier];
                return (
                  <GlowPanel
                    key={c.key}
                    wrapperClassName="fade-up"
                    style={{ animationDelay: `${0.03 + i * 0.02}s` }}
                    className="panel flex items-center gap-3 p-3"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ background: `${color}22`, color }}
                    >
                      {initials(c.label)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--text)]">{c.label}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className="inline-flex rounded-full border px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide"
                          style={{ borderColor: `${color}55`, color }}
                        >
                          {c.tier === "local" ? "Mallorca" : "Global"}
                        </span>
                        <span className="text-[10px] text-[var(--text-faint)]">
                          {c.match_type === "page" ? "tracked page" : "keyword search"}
                        </span>
                      </div>
                    </div>
                  </GlowPanel>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="fade-up grid grid-cols-1 gap-4 sm:grid-cols-4" style={{ animationDelay: "0.05s" }}>
            <StatCard icon={Eye} label="Active ads tracked" value={live?.ads.length ?? 0} accent="#02bbbb" />
            <StatCard icon={Buildings} label="Competitors with activity" value={activeCompetitorCount} accent="#7a9bff" />
            <StatCard icon={Sparkle} label="New ads this week" value={newThisWeek} accent="#34d399" />
            <StatCard icon={Fire} label="Longest running ad" value={longestRunningOverall} suffix="d" accent="#fbbf24" />
          </div>

          <div className="fade-up flex flex-wrap gap-2" style={{ animationDelay: "0.08s" }}>
            <TierChip active={tierFilter === "all"} onClick={() => setTierFilter("all")} label={`All (${localCount + globalCount})`} />
            <TierChip
              active={tierFilter === "local"}
              onClick={() => setTierFilter("local")}
              label={`Mallorca (${localCount})`}
              dot={TIER_COLOR.local}
            />
            <TierChip
              active={tierFilter === "global"}
              onClick={() => setTierFilter("global")}
              label={`Global (${globalCount})`}
              dot={TIER_COLOR.global}
            />
          </div>

          <div className="fade-up" style={{ animationDelay: "0.12s" }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">By competitor</h2>
              {live?.lastUpdated && (
                <span className="text-[11px] text-[var(--text-faint)]">last synced {formatDate(live.lastUpdated)}</span>
              )}
            </div>
            {filteredSummary.length === 0 ? (
              <GlowPanel className="panel flex items-center justify-center p-8 text-sm text-[var(--text-faint)]">
                No competitors in this filter.
              </GlowPanel>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredSummary.map((row, i) => {
                  const trend = trendByCompetitor.get(row.competitor_key) ?? [];
                  const color = TIER_COLOR[row.tier];
                  return (
                    <Link key={row.competitor_key} href={`/competitor-ads/${row.competitor_key}`} className="fade-up block" style={{ animationDelay: `${0.14 + i * 0.03}s` }}>
                    <GlowPanel
                      as="article"
                      className="panel p-4 transition hover:border-[var(--border-strong)] cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                            style={{ background: `${color}22`, color }}
                          >
                            {initials(row.competitor_label)}
                          </span>
                          <div>
                            <p className="text-sm font-medium leading-tight text-[var(--text)]">{row.competitor_label}</p>
                            <span
                              className="mt-0.5 inline-flex rounded-full border px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide"
                              style={{ borderColor: `${color}55`, color }}
                            >
                              {row.tier === "local" ? "Mallorca" : "Global"}
                            </span>
                          </div>
                        </div>
                        {trend.length > 1 ? (
                          <Sparkline data={trend.map((t) => t.active_ad_count)} width={80} height={30} stroke={color} />
                        ) : (
                          <span className="pt-2 text-[11px] text-[var(--text-faint)]">—</span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3">
                        <MiniStat label="Active" value={String(row.active_ad_count)} />
                        <MiniStat label="Running" value={row.longest_running_days !== null ? `${row.longest_running_days}d` : "—"} />
                        <MiniStat
                          label="Last new"
                          value={row.last_new_ad_date ? daysAgoLabel(daysSince(row.last_new_ad_date)) : "—"}
                        />
                      </div>
                    </GlowPanel>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="fade-up" style={{ animationDelay: "0.2s" }}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Recent ad feed</h2>
            {filteredFeed.length === 0 ? (
              <GlowPanel className="panel flex items-center justify-center p-8 text-sm text-[var(--text-faint)]">
                No ads observed yet in this filter.
              </GlowPanel>
            ) : (
              <div className="space-y-3">
                {filteredFeed.slice(0, 30).map((ad, i) => {
                  const color = TIER_COLOR[ad.tier];
                  const isNew = daysSince(ad.first_seen_date) <= 3;
                  return (
                    <GlowPanel
                      key={ad.ad_archive_id}
                      as="article"
                      wrapperClassName="fade-up"
                      style={{ animationDelay: `${0.22 + i * 0.02}s` }}
                      className="panel relative overflow-hidden p-4 pl-5"
                    >
                      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[var(--text)]">{ad.competitor_label}</span>
                          <span
                            className="inline-flex rounded-full border px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide"
                            style={{ borderColor: `${color}55`, color }}
                          >
                            {ad.tier === "local" ? "Mallorca" : "Global"}
                          </span>
                          {isNew && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
                              <Sparkle className="h-2.5 w-2.5" weight="fill" />
                              New
                            </span>
                          )}
                        </div>
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
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {ad.publisher_platforms.map((p) => {
                          const Icon = PLATFORM_ICON[p.toLowerCase()];
                          return (
                            <span
                              key={p}
                              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[10px] text-[var(--text-faint)]"
                            >
                              {Icon && <Icon className="h-3 w-3" />}
                              {p}
                            </span>
                          );
                        })}
                        {ad.ad_snapshot_url && (
                          <a
                            href={ad.ad_snapshot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
                          >
                            View ad
                            <ArrowSquareOut className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </GlowPanel>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix = "",
  accent,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  suffix?: string;
  accent: string;
}) {
  return (
    <GlowPanel className="panel p-4">
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: `${accent}1c`, color: accent }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs font-medium text-[var(--text-faint)]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-[var(--text)]">
        <CountUp value={value} format={(v) => `${formatNumber(Math.round(v))}${suffix}`} />
      </p>
    </GlowPanel>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}

function TierChip({ label, active, onClick, dot }: { label: string; active: boolean; onClick: () => void; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active ? "accent-gradient text-white" : "bg-[var(--panel2)] text-[var(--text-muted)] hover:text-[var(--text)]"
      }`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {label}
    </button>
  );
}
