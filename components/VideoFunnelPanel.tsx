import { GlowPanel } from "@/components/ui/glow-panel";
import { DotsIcon } from "@/components/icons";
import { formatNumber, formatPercent } from "@/lib/format";

// Impressions -> Video Plays -> Link Clicks -> Leads, each bar width proportional to its
// value (same visual language as the landing-page step funnel). "Video Plays" stands in
// for 3-second views/ThruPlay, since Meta Insights only returns a flat video-plays total
// for this ad account today.
export default function VideoFunnelPanel({
  impressions,
  videoPlays,
  linkClicks,
  leads,
}: {
  impressions: number;
  videoPlays: number;
  linkClicks: number;
  leads: number;
}) {
  const rows = [
    { label: "Impressions", value: impressions },
    { label: "Video Plays", value: videoPlays },
    { label: "Link Clicks", value: linkClicks },
    { label: "Leads", value: leads },
  ];
  const max = Math.max(1, impressions);

  return (
    <GlowPanel className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Video → lead funnel</h2>
        <button className="icon-btn" aria-label="Options" disabled>
          <DotsIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2.5">
        {rows.map((row, i) => {
          const widthPct = Math.max(4, (row.value / max) * 100);
          const prev = i > 0 ? rows[i - 1].value : null;
          return (
            <div key={row.label}>
              <div
                className="h-8 rounded-lg accent-gradient transition-[width] duration-500"
                style={{ width: `${widthPct}%` }}
              />
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="font-medium text-[var(--text)]">{row.label}</span>
                <span className="text-[var(--text-muted)]">{formatNumber(row.value)}</span>
                {prev !== null && prev > 0 && (
                  <span className="text-[var(--text-faint)]">({formatPercent(row.value / prev, 0)})</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-t border-[var(--border)] pt-2 text-[11px] text-[var(--text-faint)]">
        3-second views and ThruPlay aren&apos;t fetched, Video Plays is the closest available proxy
        step.
      </p>
    </GlowPanel>
  );
}
