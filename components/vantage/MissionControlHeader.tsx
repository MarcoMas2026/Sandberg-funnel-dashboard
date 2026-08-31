"use client";

import { useMemo } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { formatDate } from "@/lib/format";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export interface MonthOption {
  year: number;
  month: number; // 0-indexed, matches JS Date
  label: string;
}

// Last 3 calendar months up to now (inclusive), oldest first — matches the
// reference's June/July/August tab row. Falls back to fewer months near
// HISTORY_START (June 2026) rather than showing months with no data.
export function useMonthTabs(): MonthOption[] {
  return useMemo(() => {
    const now = new Date();
    const floor = new Date(2026, 5, 1); // HISTORY_START — lib/history/db.ts
    const opts: MonthOption[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      if (d < floor) continue;
      opts.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("en-US", { month: "long" }) });
    }
    return opts;
  }, []);
}

export function MissionControlHeader({
  lastUpdated,
  activeCount,
  months,
  selMonth,
  onSelectMonth,
  onSearch,
}: {
  lastUpdated: string | null;
  activeCount: number;
  months: MonthOption[];
  selMonth: { year: number; month: number };
  onSelectMonth: (year: number, month: number) => void;
  onSearch: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
      <div>
        <p className="mb-1 flex items-center gap-2 text-xs text-[var(--vantage-text-muted)]">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {lastUpdated ? `Last update ${formatDate(lastUpdated)}` : "No sync yet"}
        </p>
        <h1 className="whitespace-nowrap text-[1.75rem] font-bold tracking-tight text-[var(--vantage-text)] sm:text-4xl">
          {greeting()}, team <span className="align-middle">👋</span>
        </h1>
        <p className="mt-1 text-sm text-[var(--vantage-text-muted)]">
          {activeCount} campaign{activeCount === 1 ? "" : "s"} live right now across your portfolio
        </p>
      </div>

      <div className="flex justify-self-center">
        <div className="vantage-pill flex items-center gap-1 p-1.5">
          {months.map((m) => {
            const active = m.year === selMonth.year && m.month === selMonth.month;
            return (
              <button
                key={`${m.year}-${m.month}`}
                type="button"
                onClick={() => onSelectMonth(m.year, m.month)}
                className={`rounded-full px-5 py-2 text-base transition-colors ${
                  active ? "bg-[var(--vantage-accent)] text-[#f0f0f0]" : "text-[var(--vantage-text-muted)]"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onSearch}
        className="vantage-pill flex w-64 items-center gap-2 justify-self-end px-5 py-3 text-left text-base text-[var(--vantage-text-muted)]"
      >
        <MagnifyingGlass className="h-5 w-5" />
        <span className="flex-1">Search…</span>
        <kbd className="rounded bg-[var(--vantage-icon-box)] px-1.5 py-0.5 text-xs">⌘K</kbd>
      </button>
    </div>
  );
}
