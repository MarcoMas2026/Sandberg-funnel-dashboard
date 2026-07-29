import { ClarityMetrics } from "@/lib/types";
import { formatDuration, formatNumber } from "@/lib/format";
import { GlowPanel } from "@/components/ui/glow-panel";

// Top KPI strip mirroring Clarity's own dashboard header (Sessions / Pages per session /
// Scroll depth / Active time spent). Always renders with zeros when clarity has no
// sessions yet — never hidden — since a brand-new campaign should still show the full
// page structure.
export default function ClarityKpiRow({ clarity }: { clarity: ClarityMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
      <KpiCard label="Sessions" value={formatNumber(clarity.sessions)} note={`${formatNumber(clarity.bot_sessions)} bot sessions excluded`} />
      <KpiCard label="Pages per session" value={clarity.pages_per_session.toFixed(1)} note="average" />
      <KpiCard label="Scroll depth" value={`${clarity.scroll_depth_avg.toFixed(0)}%`} note="average" />
      <KpiCard
        label="Active time spent"
        value={formatDuration(clarity.active_time_seconds)}
        note={`out of ${formatDuration(clarity.total_time_seconds)} total time`}
      />
    </div>
  );
}

function KpiCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <GlowPanel className="panel p-4">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</p>
      <p className="mt-1 text-[11px] italic text-[var(--text-faint)]">{note}</p>
    </GlowPanel>
  );
}
