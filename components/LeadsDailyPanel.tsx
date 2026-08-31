import { LeadRecord } from "@/lib/types";
import { GlowPanel } from "@/components/ui/glow-panel";
import { DotsThree } from "@phosphor-icons/react";
import { Sparkline } from "@/components/viz";
import { formatNumber, shortDay } from "@/lib/format";

// Real daily submissions, bucketed client-side from each lead's own submitted_at
// timestamp (no pipeline change needed — leads:all already carries this per record).
function dailySubmissions(leads: LeadRecord[]): { date: string; count: number }[] {
  const byDay = new Map<string, number>();
  for (const l of leads) {
    if (!l.submitted_at) continue;
    const day = l.submitted_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
}

export default function LeadsDailyPanel({ leads }: { leads: LeadRecord[] }) {
  const days = dailySubmissions(leads);
  const total = days.reduce((s, d) => s + d.count, 0);

  return (
    <GlowPanel className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Daily activity</h2>
        <button className="icon-btn" aria-label="Options" disabled>
          <DotsThree className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">Submissions</span>
            <span className="font-semibold text-[var(--text)]">{formatNumber(total)}</span>
          </div>
          {days.length >= 2 ? (
            <Sparkline data={days.map((d) => d.count)} width={280} height={56} markers />
          ) : (
            <p className="text-xs text-[var(--text-faint)]">Not enough days of data yet.</p>
          )}
          {days.length > 0 && (
            <div className="mt-1 flex justify-between text-[10px] text-[var(--text-faint)]">
              <span>{shortDay(days[0].date)}</span>
              <span>{shortDay(days[days.length - 1].date)}</span>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] pt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">Views</span>
            <span className="font-semibold text-[var(--text)]">—</span>
          </div>
          <p className="text-[11px] text-[var(--text-faint)]">
            Typeform doesn&apos;t expose a daily views time series via this pipeline, only the
            aggregate total is available.
          </p>
        </div>

        <div className="border-t border-[var(--border)] pt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">Time to complete</span>
            <span className="font-semibold text-[var(--text)]">—</span>
          </div>
          <p className="text-[11px] text-[var(--text-faint)]">
            No per-response duration field is captured today.
          </p>
        </div>
      </div>
    </GlowPanel>
  );
}
