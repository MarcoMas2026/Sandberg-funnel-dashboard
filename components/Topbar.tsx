"use client";

import { usePathname } from "next/navigation";
import CampaignSelector from "./CampaignSelector";

const LABELS: Record<string, string> = {
  "": "Mission Control",
  campaign: "Campaign",
  insights: "Insights",
  compare: "Compare",
  okrs: "OKRs",
  demand: "Demand Map",
  patterns: "Patterns",
};

export default function Topbar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const section = segments[0] ?? "";
  const label = LABELS[section] ?? "Mission Control";
  const currentCampaignId = section === "campaign" ? segments[1] ?? null : null;

  return (
    <div className="mb-6 hidden items-center justify-between gap-4 md:flex">
      <div className="flex items-center gap-2 text-sm text-[var(--text-faint)]">
        <CampaignSelector currentCampaignId={currentCampaignId} />
        <span className="text-[var(--text-faint)]">/</span>
        <span className="font-medium text-[var(--text)]">{label}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="flex w-56 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel2)] px-4 py-2 text-left text-xs text-[var(--text-faint)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-muted)]"
        >
          <SearchGlyph />
          <span className="flex-1">Search…</span>
          <kbd className="rounded border border-[var(--border-strong)] px-1.5 py-0.5 text-[10px] text-[var(--text-faint)]">⌘K</kbd>
        </button>
      </div>
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={11} cy={11} r={7} />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
