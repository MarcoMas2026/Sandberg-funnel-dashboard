import { GlowPanel } from "@/components/ui/glow-panel";
import { DotsThree } from "@phosphor-icons/react";
import { formatNumber } from "@/lib/format";

// Views -> Starts -> Completions is the real drop-off funnel we can build today.
// True per-question abandonment (which question loses the most starters) needs the
// Typeform Sync workflow to call /forms/{id}/insights/fields — not populated in KV yet,
// even though the TypeformField type already models it (see lib/types.ts).
export default function TypeformDropoffPanel({
  views,
  starts,
  completions,
}: {
  views: number;
  starts: number;
  completions: number;
}) {
  const stages = [
    { label: "Views", value: views },
    { label: "Starts", value: starts },
    { label: "Completions", value: completions },
  ];
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <GlowPanel className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Form drop-off</h2>
        <button className="icon-btn" aria-label="Options" disabled>
          <DotsThree className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {stages.map((s) => (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>{s.label}</span>
              <span className="font-semibold text-[var(--text)]">{formatNumber(s.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--panel2)]">
              <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${(s.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--text-faint)]">
        Per-question drop-off needs a Typeform Sync workflow change to fetch{" "}
        <code>/forms/{"{id}"}/insights/fields</code>, not populated today.
      </p>
    </GlowPanel>
  );
}
