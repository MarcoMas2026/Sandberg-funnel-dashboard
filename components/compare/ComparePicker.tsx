"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

export interface CompareCatalogCampaign {
  campaign_id: string;
  property: string;
  status: string;
}

// Single-select campaign dropdown for the Two Sides comparison page. Unlike
// CampaignSelector (breadcrumb nav — always navigates to /campaign/[id]),
// this just reports the chosen id back to the parent so both sides can stay
// on the same page and render side by side.
export default function ComparePicker({
  campaigns,
  value,
  onChange,
  placeholder = "Select a campaign…",
}: {
  campaigns: CompareCatalogCampaign[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = campaigns.filter((c) => c.status === "ACTIVE");
  const inactive = campaigns.filter((c) => c.status !== "ACTIVE");
  const current = campaigns.find((c) => c.campaign_id === value);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-left text-sm transition-colors hover:border-[var(--border-strong)]"
      >
        <span className={`flex-1 truncate ${current ? "font-medium text-[var(--text)]" : "text-[var(--text-faint)]"}`}>
          {current?.property ?? placeholder}
        </span>
        <CaretDown className={`h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="glass fade-up absolute left-0 top-full z-40 mt-2 max-h-80 w-full overflow-y-auto py-1.5">
          {active.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">Active</div>
              {active.map((c) => (
                <button
                  key={c.campaign_id}
                  onClick={() => pick(c.campaign_id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--panel2)] ${
                    c.campaign_id === value ? "text-[var(--text)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span className="truncate">{c.property}</span>
                </button>
              ))}
            </>
          )}

          {inactive.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">Inactive</div>
              {inactive.map((c) => (
                <button
                  key={c.campaign_id}
                  onClick={() => pick(c.campaign_id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--panel2)] ${
                    c.campaign_id === value ? "text-[var(--text)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-faint)]" />
                  <span className="truncate">{c.property}</span>
                </button>
              ))}
            </>
          )}

          {campaigns.length === 0 && <div className="px-3 py-2 text-sm text-[var(--text-faint)]">No campaigns yet</div>}
        </div>
      )}
    </div>
  );
}
