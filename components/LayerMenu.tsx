"use client";

import Link from "next/link";

const LAYERS: { id: number; name: string }[] = [
  { id: 1, name: "Ad Appears" },
  { id: 2, name: "Engagement" },
  { id: 3, name: "Enters Landing Page" },
  { id: 4, name: "Enters Typeform" },
  { id: 5, name: "Fills Typeform" },
  { id: 6, name: "Qualified Lead" },
];

// Pill-tab strip for jumping directly between the 6 funnel layers without going
// back to the campaign overview — same rounded-pill segmented-control language
// as the app's existing Pill component (viz.tsx), just link-driven instead of
// local-state-driven since each tab is a real route, not a same-page panel.
export default function LayerMenu({ campaignId, activeLayer }: { campaignId: string; activeLayer: number }) {
  return (
    <nav className="flex w-full items-center gap-1 overflow-x-auto rounded-2xl bg-[var(--panel2)] p-1.5">
      {LAYERS.map((layer) => {
        const active = layer.id === activeLayer;
        return (
          <Link
            key={layer.id}
            href={`/campaign/${campaignId}/layer/${layer.id}`}
            className={`flex-1 whitespace-nowrap rounded-xl px-3.5 py-2 text-center text-xs font-medium transition-all ${
              active
                ? "bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-card)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {layer.name}
          </Link>
        );
      })}
    </nav>
  );
}
