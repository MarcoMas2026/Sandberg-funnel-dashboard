"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";

interface Cmd {
  label: string;
  hint: string;
  run: () => void;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { data, triggerUpdate } = useDashboard();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQ("");
        setIdx(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const cmds: Cmd[] = useMemo(() => {
    const base: Cmd[] = [
      { label: "Mission Control", hint: "Go to overview", run: () => router.push("/") },
      { label: "Insights", hint: "AI analyst feed", run: () => router.push("/insights") },
      { label: "Compare", hint: "Benchmark campaigns", run: () => router.push("/compare") },
      { label: "Demand Map", hint: "Buyer demand intelligence", run: () => router.push("/demand") },
      { label: "Patterns", hint: "Creative DNA library", run: () => router.push("/patterns") },
      { label: "Update data", hint: "Trigger n8n sync now", run: () => void triggerUpdate() },
    ];
    const campaigns: Cmd[] = (data?.campaigns ?? []).map((c) => ({
      label: c.property,
      hint: `Open campaign · ${c.status === "ACTIVE" ? "active" : "past"}`,
      run: () => router.push(`/campaign/${c.campaign_id}`),
    }));
    return [...base, ...campaigns];
  }, [data, router, triggerUpdate]);

  const filtered = cmds.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[18vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div className="glass w-full max-w-lg overflow-hidden fade-up" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setIdx((i) => Math.min(i + 1, filtered.length - 1));
            if (e.key === "ArrowUp") setIdx((i) => Math.max(i - 1, 0));
            if (e.key === "Enter" && filtered[idx]) {
              filtered[idx].run();
              setOpen(false);
            }
          }}
          placeholder="Jump to page, campaign, or action…"
          className="w-full border-b border-[var(--border)] bg-transparent px-5 py-4 text-sm text-white outline-none placeholder:text-[var(--text-faint)]"
        />
        <ul className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 && <li className="px-3 py-4 text-sm text-[var(--text-faint)]">No matches</li>}
          {filtered.map((c, i) => (
            <li key={c.label + c.hint}>
              <button
                onMouseEnter={() => setIdx(i)}
                onClick={() => {
                  c.run();
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${
                  i === idx ? "bg-[var(--panel2)] text-white" : "text-[var(--text-muted)]"
                }`}
              >
                <span>{c.label}</span>
                <span className="text-[11px] text-[var(--text-faint)]">{c.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
