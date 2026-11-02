"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDown, CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
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

// Every calendar month from HISTORY_START (June 2026) up to now, oldest first.
export function useMonthTabs(): MonthOption[] {
  return useMemo(() => {
    const now = new Date();
    const floor = new Date(2026, 5, 1); // HISTORY_START — lib/history/db.ts
    const opts: MonthOption[] = [];
    for (let d = new Date(floor); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      opts.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) });
    }
    return opts;
  }, []);
}

// Prev/next arrows around a month dropdown, so any month back to HISTORY_START
// is reachable (the old 3-tab row only covered the latest three).
function MonthPicker({
  months,
  selMonth,
  onSelectMonth,
}: {
  months: MonthOption[];
  selMonth: { year: number; month: number };
  onSelectMonth: (year: number, month: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const idx = months.findIndex((m) => m.year === selMonth.year && m.month === selMonth.month);
  const current = months[idx];
  const go = (i: number) => {
    const m = months[i];
    if (m) onSelectMonth(m.year, m.month);
  };
  const arrow = "rounded-full p-2 text-[var(--vantage-text)] transition-colors enabled:hover:bg-[var(--vantage-icon-box)] disabled:opacity-30 md:p-2.5";

  return (
    <div ref={ref} className="relative">
      <div className="vantage-pill flex w-fit items-center gap-1 p-1 md:p-1.5">
        <button type="button" aria-label="Previous month" disabled={idx <= 0} onClick={() => go(idx - 1)} className={arrow}>
          <CaretLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-[10rem] items-center justify-center gap-2 rounded-full bg-[var(--vantage-accent)] px-4 py-1.5 text-sm text-[#f0f0f0] md:px-5 md:py-2 md:text-base"
        >
          {current?.label ?? "Select month"}
          <CaretDown className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Next month" disabled={idx < 0 || idx >= months.length - 1} onClick={() => go(idx + 1)} className={arrow}>
          <CaretRight className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="vantage-card absolute left-1/2 top-full z-50 mt-2 max-h-72 w-56 -translate-x-1/2 overflow-y-auto p-1.5 shadow-lg">
          {[...months].reverse().map((m) => {
            const active = m.year === selMonth.year && m.month === selMonth.month;
            return (
              <button
                key={`${m.year}-${m.month}`}
                type="button"
                onClick={() => {
                  onSelectMonth(m.year, m.month);
                  setOpen(false);
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                  active ? "bg-[var(--vantage-accent)] text-[#f0f0f0]" : "text-[var(--vantage-text)] hover:bg-[var(--vantage-icon-box)]"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
  // The portal target only exists in the browser; mount after hydration to avoid a server/client mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[1fr_auto_1fr] md:items-end">
      <div>
        <p className="mb-1 flex items-center gap-2 text-xs text-[var(--vantage-text-muted)]">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {lastUpdated ? `Last update ${formatDate(lastUpdated)}` : "No sync yet"}
        </p>
        <h1 className="text-[1.75rem] sm:whitespace-nowrap font-bold tracking-tight text-[var(--vantage-text)] sm:text-4xl">
          {greeting()}, team <span className="align-middle">👋</span>
        </h1>
        <p className="mt-1 text-sm text-[var(--vantage-text-muted)]">
          {activeCount} campaign{activeCount === 1 ? "" : "s"} live right now across your portfolio
        </p>
      </div>

      <div className="flex md:justify-self-center">
        <MonthPicker months={months} selMonth={selMonth} onSelectMonth={onSelectMonth} />
      </div>

      <button
        type="button"
        onClick={onSearch}
        className="vantage-pill hidden w-full items-center gap-2 px-5 py-3 md:flex md:w-64 md:justify-self-end text-left text-base text-[var(--vantage-text-muted)]"
      >
        <MagnifyingGlass className="h-5 w-5" />
        <span className="flex-1">Search…</span>
        <kbd className="rounded bg-[var(--vantage-icon-box)] px-1.5 py-0.5 text-xs">⌘K</kbd>
      </button>

      {/* Phones: search lives in a small bar fixed to the bottom of the screen, following the scroll.
          Portaled to <body> so no transformed ancestor can break `position: fixed`. */}
      {mounted &&
        createPortal(
          <button
            type="button"
            onClick={onSearch}
            aria-label="Search"
            className="vantage-pill fixed bottom-3 left-1/2 z-40 flex w-[min(15rem,70vw)] -translate-x-1/2 items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--vantage-text-muted)] shadow-lg md:hidden"
          >
            <MagnifyingGlass className="h-4 w-4" />
            <span className="flex-1">Search…</span>
          </button>,
          document.body
        )}
    </div>
  );
}
