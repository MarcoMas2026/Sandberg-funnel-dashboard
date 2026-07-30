"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";

export default function CampaignSelector({
  currentCampaignId,
  variant = "breadcrumb",
}: {
  currentCampaignId: string | null;
  variant?: "breadcrumb" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data } = useDashboard();

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

  const campaigns = data?.campaigns ?? [];
  const active = campaigns.filter((c) => c.status === "ACTIVE");
  const other = campaigns.filter((c) => c.status !== "ACTIVE");
  const current = campaigns.find((c) => c.campaign_id === currentCampaignId);
  const currentLabel = current?.property ?? "Overview";

  const go = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {variant === "icon" ? (
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Switch campaign"
          title={currentLabel}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--panel2)] text-[var(--accent)] transition-colors hover:brightness-95"
        >
          <CampaignGlyph />
        </button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-[var(--text-faint)] transition-colors hover:bg-[var(--panel2)] hover:text-[var(--text-muted)]"
        >
          <CampaignGlyph />
          <span>{currentLabel}</span>
          <ChevronGlyph open={open} />
        </button>
      )}

      {open && (
        <div className="glass fade-up absolute left-0 top-full z-40 mt-2 w-72 overflow-hidden py-1.5">
          <button
            onClick={() => go("/")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text-muted)] hover:bg-[var(--panel2)]"
          >
            <CampaignGlyph />
            <span>Overview</span>
            <span className="ml-auto text-[11px] text-[var(--text-faint)]">Mission Control</span>
          </button>

          {active.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
                Active
              </div>
              {active.map((c) => (
                <button
                  key={c.campaign_id}
                  onClick={() => go(`/campaign/${c.campaign_id}`)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--panel2)] ${
                    c.campaign_id === currentCampaignId ? "text-[var(--text)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span className="truncate">{c.property}</span>
                </button>
              ))}
            </>
          )}

          {other.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
                Other
              </div>
              {other.map((c) => (
                <button
                  key={c.campaign_id}
                  onClick={() => go(`/campaign/${c.campaign_id}`)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--panel2)] ${
                    c.campaign_id === currentCampaignId ? "text-[var(--text)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-faint)]" />
                  <span className="truncate">{c.property}</span>
                </button>
              ))}
            </>
          )}

          {campaigns.length === 0 && (
            <div className="px-3 py-2 text-sm text-[var(--text-faint)]">No campaigns yet</div>
          )}
        </div>
      )}
    </div>
  );
}

function CampaignGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11l8-7 8 7M6 10v9h12v-9" />
    </svg>
  );
}

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
