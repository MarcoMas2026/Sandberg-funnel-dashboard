"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowSquareOut, ChartBar, Sparkle } from "@phosphor-icons/react";
import { GlowPanel } from "@/components/ui/glow-panel";
import { NotConnectedPanel } from "@/components/social/shared";
import { CardSkeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { CompetitorAdWithEstimate } from "@/app/api/competitor-ads/[key]/route";

interface DetailResponse {
  connected: boolean;
  competitor_label: string | null;
  ads: CompetitorAdWithEstimate[];
  error?: string;
}

const CONFIDENCE_STYLE: Record<string, { label: string; color: string }> = {
  high: { label: "High confidence", color: "#34d399" },
  medium: { label: "Medium confidence", color: "#fbbf24" },
  low: { label: "Low confidence", color: "#f87171" },
  none: { label: "No estimate", color: "#8b8b8b" },
};

const PAGE_SIZE = 20;

export default function CompetitorDetailPage() {
  const params = useParams<{ key: string }>();
  const key = params.key;
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/competitor-ads/${key}`, { cache: "no-store" })
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [key]);

  const visibleAds = useMemo(() => data?.ads.slice(0, visibleCount) ?? [], [data, visibleCount]);

  return (
    <div className="space-y-5">
      <Link
        href="/competitor-ads"
        className="fade-up inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-faint)] hover:text-[var(--text)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Competitor Ads
      </Link>

      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-faint)]">Competitor detail</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            {data?.competitor_label ?? "Loading…"}
          </h1>
        </div>
        {data && (
          <span className="rounded-full bg-[var(--panel2)] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
            {data.ads.length} active ad{data.ads.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i} className="h-40" />
          ))}
        </div>
      ) : !data?.connected ? (
        <NotConnectedPanel
          title="Competitor Ads isn't connected yet"
          message={data?.error ?? "Missing Supabase credentials."}
          envVars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      ) : data.ads.length === 0 ? (
        <GlowPanel className="panel flex items-center justify-center p-10 text-sm text-[var(--text-faint)]">
          No active ads found for this competitor right now.
        </GlowPanel>
      ) : (
        <>
          <div className="space-y-4">
            {visibleAds.map((ad, i) => (
              <AdCard key={ad.ad_archive_id} ad={ad} delay={i * 0.02} />
            ))}
          </div>
          {visibleCount < data.ads.length && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                className="rounded-full bg-[var(--panel2)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Show more ({data.ads.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AdCard({ ad, delay }: { ad: CompetitorAdWithEstimate; delay: number }) {
  const [expanded, setExpanded] = useState(false);
  const primaryVariant = ad.variants[0];
  const extraVariants = ad.variants.slice(1);
  const confStyle = CONFIDENCE_STYLE[ad.estimate.confidence];

  return (
    <GlowPanel as="article" wrapperClassName="fade-up" style={{ animationDelay: `${delay}s` }} className="panel p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
          <span>Running {ad.days_running}d</span>
          <span>·</span>
          <span>First seen {ad.first_seen_date}</span>
          {ad.variants.length > 1 && (
            <>
              <span>·</span>
              <span>{ad.variants.length} listings in rotation</span>
            </>
          )}
        </div>
        {ad.ad_snapshot_url && (
          <a
            href={ad.ad_snapshot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
          >
            View real ad
            <ArrowSquareOut className="h-3 w-3" />
          </a>
        )}
      </div>

      {primaryVariant && (
        <div>
          {primaryVariant.title && <p className="text-[14px] font-semibold text-[var(--text)]">{primaryVariant.title}</p>}
          {primaryVariant.description && (
            <p className="mt-0.5 text-[12px] font-medium text-[var(--text-muted)]">{primaryVariant.description}</p>
          )}
          {primaryVariant.body && (
            <p className="mt-1 line-clamp-2 text-[12px] text-[var(--text-faint)]">{primaryVariant.body}</p>
          )}
        </div>
      )}

      {extraVariants.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-medium text-[var(--accent)] hover:underline"
          >
            {expanded ? "Hide" : `Show all ${ad.variants.length} listings`}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2 border-t border-[var(--border)] pt-2">
              {extraVariants.map((v, i) => (
                <div key={i}>
                  {v.title && <p className="text-[13px] font-medium text-[var(--text)]">{v.title}</p>}
                  {v.description && <p className="text-[11px] font-medium text-[var(--text-muted)]">{v.description}</p>}
                  {v.body && <p className="line-clamp-2 text-[11px] text-[var(--text-faint)]">{v.body}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ad.publisher_platforms.map((p) => (
          <span
            key={p}
            className="rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[10px] text-[var(--text-faint)]"
          >
            {p}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] bg-[var(--panel2)] p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            <ChartBar className="h-3 w-3" />
            Real reach (Meta)
          </p>
          {ad.eu_total_reach ? (
            <>
              <p className="text-lg font-semibold text-[var(--text)]">{formatNumber(ad.eu_total_reach)} people</p>
              {ad.target_locations && ad.target_locations.length > 0 && (
                <p className="mt-1 truncate text-[11px] text-[var(--text-faint)]">
                  Targeting: {ad.target_locations.slice(0, 3).map((l) => l.name).join(", ")}
                  {ad.target_locations.length > 3 ? ` +${ad.target_locations.length - 3} more` : ""}
                </p>
              )}
            </>
          ) : (
            <p className="text-[12px] text-[var(--text-faint)]">Not disclosed (ad doesn't reach an EU country)</p>
          )}
        </div>

        <div className="rounded-[var(--radius-md)] bg-[var(--panel2)] p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              <Sparkle className="h-3 w-3" />
              Estimated performance
            </p>
            <span className="rounded-full px-1.5 py-0 text-[9px] font-medium" style={{ color: confStyle.color, background: `${confStyle.color}22` }}>
              {confStyle.label}
            </span>
          </div>
          {ad.estimate.confidence !== "none" ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              <span className="text-[var(--text-faint)]">Spend</span>
              <span className="text-right font-semibold text-[var(--text)]">{formatCurrency(ad.estimate.estimated_spend)}</span>
              <span className="text-[var(--text-faint)]">Impressions</span>
              <span className="text-right font-semibold text-[var(--text)]">{formatNumber(ad.estimate.estimated_impressions)}</span>
              <span className="text-[var(--text-faint)]">Clicks</span>
              <span className="text-right font-semibold text-[var(--text)]">{formatNumber(ad.estimate.estimated_clicks)}</span>
              <span className="text-[var(--text-faint)]">CPM</span>
              <span className="text-right font-semibold text-[var(--text)]">{formatCurrency(ad.estimate.estimated_cpm, 2)}</span>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--text-faint)]">{ad.estimate.note}</p>
          )}
        </div>
      </div>
    </GlowPanel>
  );
}
