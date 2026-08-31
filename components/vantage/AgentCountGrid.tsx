"use client";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AgentCountGrid({ rows }: { rows: { agent: string; count: number }[] }) {
  if (rows.length === 0) return null;
  const max = rows[0].count || 1;

  return (
    <div className="vantage-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--vantage-text)]">Agent Count</h2>
        <span className="vantage-icon-box px-3 py-1 text-xs font-medium">Active campaigns</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {rows.map((row, i) => (
          <div key={row.agent} className="rounded-xl bg-[var(--vantage-canvas)] p-4">
            <div className="flex items-center gap-3">
              <span className="vantage-icon-box h-10 w-10 shrink-0 text-xs font-semibold">{initials(row.agent)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--vantage-text)]">{row.agent}</p>
                <p className="text-xs text-[var(--vantage-text-muted)]">Rank #{i + 1}</p>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <p className="text-3xl font-bold leading-none text-[var(--vantage-text)]">{row.count}</p>
              <p className="text-xs uppercase tracking-wide text-[var(--vantage-text-muted)]">campaigns</p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--vantage-icon-box)]">
              <div
                className="h-full rounded-full bg-[var(--vantage-accent)] transition-[width] duration-700"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
