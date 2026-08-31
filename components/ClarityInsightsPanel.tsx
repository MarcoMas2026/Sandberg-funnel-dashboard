import { ClarityMetrics } from "@/lib/types";
import { GlowPanel } from "@/components/ui/glow-panel";
import { DotsThree } from "@phosphor-icons/react";

// Clarity's four built-in friction signals (Rage/Dead clicks, Excessive scrolling,
// Quickbacks), each with % of sessions and a derived session count. Always renders —
// zeros when clarity has no sessions yet, matching the rest of this layer's panels.
export default function ClarityInsightsPanel({ clarity }: { clarity: ClarityMetrics }) {
  const insights = [
    { label: "Rage clicks", pct: clarity.rage_click_pct },
    { label: "Dead clicks", pct: clarity.dead_click_pct },
    { label: "Excessive scrolling", pct: clarity.excessive_scroll_pct },
    { label: "Quick backs", pct: clarity.quickback_pct },
  ];

  return (
    <GlowPanel className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Insights</h2>
        <button className="icon-btn" aria-label="Options" disabled>
          <DotsThree className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {insights.map((i) => {
          const count = Math.round((i.pct / 100) * clarity.sessions);
          return (
            <div key={i.label} className="rounded-xl bg-[var(--panel2)] p-3">
              <p className="text-lg font-semibold text-[var(--text)]">{i.pct.toFixed(0)}%</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{i.label}</p>
              <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                {count} session{count === 1 ? "" : "s"}
              </p>
            </div>
          );
        })}
      </div>
    </GlowPanel>
  );
}
