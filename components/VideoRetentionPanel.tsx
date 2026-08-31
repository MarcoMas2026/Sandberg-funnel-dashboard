import { GlowPanel } from "@/components/ui/glow-panel";
import { DotsThree } from "@phosphor-icons/react";

// Retention/drop-off curve per video — the shape (not just the average) is the real
// diagnostic (early drop = hook problem, mid bleed = pacing, late cliff = CTA/length).
// Meta Insights never returns video_p25/p50/p75/p100_watched_actions for this ad
// account today (only a flat "video plays" total exists), so this renders a muted,
// clearly-non-data baseline instead of a fabricated curve.
export default function VideoRetentionPanel() {
  return (
    <GlowPanel className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Video retention</h2>
        <button className="icon-btn" aria-label="Options" disabled>
          <DotsThree className="h-4 w-4" />
        </button>
      </div>

      <svg viewBox="0 0 280 90" width="100%" height="90" className="block">
        <line x1="4" y1="82" x2="276" y2="82" stroke="var(--border)" strokeWidth={1} />
        <line x1="4" y1="82" x2="4" y2="8" stroke="var(--border)" strokeWidth={1} />
        <line
          x1="4"
          y1="20"
          x2="276"
          y2="20"
          stroke="var(--text-faint)"
          strokeWidth={1.5}
          strokeDasharray="3 5"
          opacity={0.5}
        />
        {["25%", "50%", "75%", "100%"].map((label, i) => (
          <text key={label} x={4 + (i + 1) * 68} y={90} fontSize={9} textAnchor="middle" fill="var(--text-faint)">
            {label}
          </text>
        ))}
      </svg>

      <p className="border-t border-[var(--border)] pt-2 text-[11px] text-[var(--text-faint)]">
        Needs <code>video_p25/p50/p75/p100_watched_actions</code> from Meta Insights, not fetched
        today, so no curve is drawn (only a flat total &quot;video plays&quot; count exists).
      </p>
    </GlowPanel>
  );
}
