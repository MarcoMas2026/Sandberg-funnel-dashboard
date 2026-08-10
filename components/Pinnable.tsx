"use client";

import { usePublicView } from "@/lib/public-view-context";
import { PublicViewWidgetType } from "@/lib/types";

// Wraps ANY box, anywhere in the app — a builder source-panel tile, or a real
// stat box on Mission Control / a campaign page. Draggable only while
// Option/Alt is held (pinModeActive) — dragging it drops a JSON payload that
// either the builder's canvas or the global left-edge dock reads to pin a
// new widget into the currently active Public View. Outside pin mode this is
// a completely inert wrapper, so it never interferes with normal
// clicks/scrolling/navigation on the box underneath (e.g. a Link to the
// campaign detail page).
export function Pinnable({
  type,
  campaignId,
  children,
}: {
  type: PublicViewWidgetType;
  campaignId?: string;
  children: React.ReactNode;
}) {
  const { pinModeActive } = usePublicView();

  return (
    <div
      draggable={pinModeActive}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/x-public-view-widget",
          JSON.stringify({ type, campaignId })
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
      className={pinModeActive ? "pinnable pinnable--armed" : "pinnable"}
    >
      {children}
    </div>
  );
}
