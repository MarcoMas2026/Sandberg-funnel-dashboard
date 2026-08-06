"use client";

import { useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { GlowPanel } from "@/components/ui/glow-panel";
import { Globe } from "@/components/ui/cobe-globe";

// Sandberg Estates' active listings (Mallorca) as the destination marker,
// and the countries recent qualified leads have come from as origin markers,
// linked by arcs. Preview data — wire to real lead-country + listing-location
// KV/Supabase reads when that phase ships.
const MALLORCA: [number, number] = [39.6953, 3.0176];

const LEAD_ORIGINS: { id: string; location: [number, number]; label: string }[] = [
  { id: "uk", location: [51.5074, -0.1278], label: "United Kingdom" },
  { id: "de", location: [52.52, 13.405], label: "Germany" },
  { id: "se", location: [59.3293, 18.0686], label: "Sweden" },
  { id: "nl", location: [52.3676, 4.9041], label: "Netherlands" },
  { id: "ch", location: [46.948, 7.4474], label: "Switzerland" },
  { id: "fr", location: [48.8566, 2.3522], label: "France" },
];

const MARKERS = [
  { id: "mallorca", location: MALLORCA, label: "Mallorca — active listings" },
  ...LEAD_ORIGINS,
];

const ARCS = LEAD_ORIGINS.map((o) => ({
  id: `arc-${o.id}`,
  from: o.location,
  to: MALLORCA,
}));

export function LeadOriginGlobe() {
  const [expanded, setExpanded] = useState(false);

  return (
    <GlowPanel wrapperClassName="fade-up" style={{ animationDelay: "0.02s" }} className="panel overflow-hidden p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Lead origins · Europe</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Where buyer interest is coming from, linked to the Mallorca portfolio
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--panel2)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      <div
        className="relative mx-auto transition-[width] duration-500 ease-out"
        style={{ width: expanded ? 560 : 300, maxWidth: "100%" }}
      >
        <Globe
          key={expanded ? "expanded" : "compact"}
          className="w-full"
          markers={MARKERS}
          arcs={ARCS}
          markerColor={[0.11, 0.15, 0.25]}
          baseColor={[0.94, 0.94, 0.93]}
          arcColor={[0.11, 0.15, 0.25]}
          glowColor={[0.85, 0.85, 0.82]}
          dark={0}
          mapBrightness={6}
          markerSize={0.045}
          markerElevation={0.06}
          arcWidth={1.4}
          arcHeight={0.32}
          theta={0.55}
          speed={0.0022}
          initialPhi={(-98 * Math.PI) / 180}
        />
      </div>

      <p className="mt-3 text-center text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">
        Drag to rotate
      </p>
    </GlowPanel>
  );
}
