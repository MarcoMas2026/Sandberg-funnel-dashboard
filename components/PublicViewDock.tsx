"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePublicView } from "@/lib/public-view-context";
import { Link2 } from "lucide-react";
import { PublicViewWidgetType } from "@/lib/types";

// Mounted once, app-wide, in AppChrome (every page except /view/[slug]).
// Two pieces:
//  1. A left-edge strip that only appears while Option/Alt is held — the
//     "push a box left" drop target for the global pin gesture.
//  2. A small persistent pill showing which Public View is currently
//     "active" (where those pins land) with a dropdown to switch it.
export default function PublicViewDock() {
  const { pinModeActive, views, activeViewSlug, setActiveViewSlug, pinWidget, error } = usePublicView();
  const [dragOver, setDragOver] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const raw = e.dataTransfer.getData("application/x-public-view-widget");
      if (!raw) return;
      const { type, campaignId } = JSON.parse(raw) as { type: PublicViewWidgetType; campaignId?: string };
      pinWidget(type, campaignId);
    },
    [pinWidget]
  );

  const activeLabel = views.find((v) => v.slug === activeViewSlug)?.propertyLabel;

  return (
    <>
      {/* left-edge drop target, only interactive/visible during pin mode */}
      <div
        onDragOver={(e) => {
          if (!pinModeActive) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={pinModeActive ? handleDrop : undefined}
        className={`fixed left-0 top-0 z-[60] flex h-screen w-24 flex-col items-center justify-center gap-2 border-r-2 transition-all duration-150 ${
          pinModeActive
            ? dragOver
              ? "pointer-events-auto border-[#b08d3f] bg-[#b08d3f]/10 backdrop-blur-sm"
              : "pointer-events-auto border-dashed border-[#b08d3f]/60 bg-[#b08d3f]/5 backdrop-blur-sm"
            : "pointer-events-none border-transparent opacity-0"
        }`}
      >
        <Link2 className="h-5 w-5 text-[#b08d3f]" />
        <p className="px-2 text-center text-[10px] font-medium uppercase leading-tight tracking-wide text-[#b08d3f]">
          Drop to add to
          <br />
          Public View
        </p>
        {activeLabel && (
          <p className="max-w-[80px] truncate px-1 text-center text-[10px] text-[#b08d3f]/80">{activeLabel}</p>
        )}
      </div>

      {/* active-view switcher, always available */}
      {views.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          {switcherOpen && (
            <div className="mb-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1.5 shadow-lg">
              {views.map((v) => (
                <button
                  key={v.slug}
                  onClick={() => {
                    setActiveViewSlug(v.slug);
                    setSwitcherOpen(false);
                  }}
                  className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs ${
                    v.slug === activeViewSlug
                      ? "bg-[var(--panel2)] font-semibold text-[var(--text)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--panel2)]"
                  }`}
                >
                  {v.propertyLabel}
                  {v.published && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                </button>
              ))}
              <Link
                href="/public-view"
                className="mt-1 block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-[var(--accent)] hover:bg-[var(--panel2)]"
              >
                Open Public View builder →
              </Link>
            </div>
          )}
          <button
            onClick={() => setSwitcherOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--text-muted)] shadow-lg hover:text-[var(--text)]"
          >
            <Link2 className="h-3.5 w-3.5" />
            {activeLabel ? (
              <span>
                Active: <span className="font-medium text-[var(--text)]">{activeLabel}</span>
              </span>
            ) : (
              <span>Pick active Public View</span>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="fixed bottom-20 right-4 z-50 max-w-xs rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400 shadow-lg">
          {error}
        </div>
      )}
    </>
  );
}
