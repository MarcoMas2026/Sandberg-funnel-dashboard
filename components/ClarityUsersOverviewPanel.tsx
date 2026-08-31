import { ClarityMetrics } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { GlowPanel } from "@/components/ui/glow-panel";
import { DotsThree } from "@phosphor-icons/react";

// Mirrors Clarity's "Users overview" card. Two of its rows — Live users (real-time) and
// the new-vs-returning session split — aren't exposed by Clarity's Data Export API at all
// (that API only returns rolling 1-3 day aggregates, no live/session-identity data), so
// they're shown as 0 with an explicit note rather than fabricated.
export default function ClarityUsersOverviewPanel({ clarity }: { clarity: ClarityMetrics }) {
  return (
    <GlowPanel className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Users Overview</h2>
        <button className="icon-btn" aria-label="Options" disabled>
          <DotsThree className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[var(--panel2)] p-3">
          <p className="text-lg font-semibold text-[var(--text)]">0</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Live users</p>
        </div>
        <div className="rounded-xl bg-[var(--panel2)] p-3">
          <p className="text-lg font-semibold text-[var(--text)]">{formatNumber(clarity.distinct_users)}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Unique users</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <SessionRow label="Sessions with new users" value={0} dot="#ec4899" />
        <SessionRow label="Sessions with returning users" value={0} dot="#8b5cf6" />
      </div>

      <p className="mt-4 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--text-faint)]">
        Live users and new/returning session splits aren&apos;t exposed by Clarity&apos;s export API, only visible
        directly in Clarity&apos;s own dashboard.
      </p>
    </GlowPanel>
  );
}

function SessionRow({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-2 text-[var(--text-muted)]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
        {label}
      </span>
      <span className="font-semibold text-[var(--text)]">{value}%</span>
    </div>
  );
}
