"use client";

import { useState } from "react";
import { LeadRecord, LeadTag } from "@/lib/types";
import { formatNumber } from "@/lib/format";

// Flat 15×15 lattice, matching the vertical-layer reference art's own grid
// (measured directly off Empty Grid.png: 16 gridlines each direction = 15
// cells, ~227px/cell on the 3418×3415 cropped canvas).
const GRID_SIZE = 15;
const CELL = 100 / GRID_SIZE; // percent, for CSS positioning

function cellPos(i: number) {
  const row = Math.floor(i / GRID_SIZE);
  const col = i % GRID_SIZE;
  return { left: `${(col + 0.5) * CELL}%`, top: `${(row + 0.5) * CELL}%` };
}

// Layers 1, 3 and 4 always render the same reference artwork — no per-data
// placement, just the fixed illustration in the center box.
export function StaticLayerGrid({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-contain" />
    </div>
  );
}

// Same deterministic "no two units touch" scatter as the isometric funnel's
// CubeField (spacedOrder), reimplemented for this flat 15×15 lattice — cells
// ranked by a stable position hash, picked greedily at decreasing minimum
// spacing so low/typical counts stay widely spread.
function spacedOrder2D(gridSize: number): [number, number][] {
  const all: [number, number][] = [];
  for (let i = 0; i < gridSize; i++) for (let j = 0; j < gridSize; j++) all.push([i, j]);
  const key = ([i, j]: [number, number]) => {
    const v = Math.sin(i * 91.3 + j * 173.7) * 24634.1234;
    return v - Math.floor(v);
  };
  const sorted = [...all].sort((a, b) => key(a) - key(b));
  const chosen: [number, number][] = [];
  const taken = new Set<string>();
  const pick = (minDist: number) => {
    for (const c of sorted) {
      const id = `${c[0]},${c[1]}`;
      if (taken.has(id)) continue;
      const ok = chosen.every((p) => Math.max(Math.abs(p[0] - c[0]), Math.abs(p[1] - c[1])) >= minDist);
      if (ok) {
        chosen.push(c);
        taken.add(id);
      }
    }
  };
  for (const d of [3, 2, 1]) pick(d);
  return chosen;
}
const SCATTER_ORDER = spacedOrder2D(GRID_SIZE);

// One dot per bucket of real engagement (100/200/500/... — whichever keeps
// the dot count legible), scattered randomly across the grid exactly like
// the isometric funnel's cube field, instead of one shape per literal unit
// (engagement volumes are too high for that) or one per calendar day.
const ENGAGEMENT_BUCKETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
function pickBucket(total: number, maxDots = 130): number {
  for (const b of ENGAGEMENT_BUCKETS) {
    if (total / b <= maxDots) return b;
  }
  return ENGAGEMENT_BUCKETS[ENGAGEMENT_BUCKETS.length - 1];
}

export function EngagementDotsGrid({ total }: { total: number }) {
  const bucket = pickBucket(total);
  const count = Math.min(SCATTER_ORDER.length, Math.max(0, Math.round(total / bucket)));
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/funnel/vertical/empty-grid.png" alt="" className="absolute inset-0 h-full w-full object-contain" />
      {Array.from({ length: count }, (_, i) => {
        const { left, top } = cellPos(SCATTER_ORDER[i][0] * GRID_SIZE + SCATTER_ORDER[i][1]);
        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left, top, width: `${CELL * 0.78}%`, height: `${CELL * 0.78}%` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/funnel/vertical/circle-engagement.png" alt="" className="h-full w-full object-contain" />
          </div>
        );
      })}
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#1b2540] px-3 py-1 text-[11px] text-white">
        1 dot ≈ {bucket.toLocaleString("en-GB")} engagements ({formatNumber(count)} of {formatNumber(total)} shown)
      </div>
    </div>
  );
}

const TAG_ASSET: Record<"red" | "orange" | "blue", string> = {
  red: "/funnel/vertical/square-red.png",
  orange: "/funnel/vertical/square-orange.png",
  blue: "/funnel/vertical/square-blue.png",
};
const STANDARD_ASSET = "/funnel/vertical/square-standard.png";
const TAG_CYCLE: LeadTag[] = ["red", "orange", "blue", null];

// Layers 5 & 6 share this: one square per real lead record. Layer 5 renders
// every square as the neutral "standard" unit (no color — nothing to encode
// yet); layer 6 colors by the real tag and, when onTagChange is passed, lets
// you click a square to cycle its qualification tag using the same
// /api/leads/tag endpoint the /leads page uses.
export function LeadsLayerGrid({
  leads,
  colorByTag,
  onTagChange,
}: {
  leads: LeadRecord[];
  colorByTag: boolean;
  onTagChange?: (responseId: string, tag: LeadTag) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/funnel/vertical/empty-grid.png" alt="" className="absolute inset-0 h-full w-full object-contain" />
      {leads.slice(0, GRID_SIZE * GRID_SIZE).map((lead, i) => {
        const { left, top } = cellPos(i);
        const asset = colorByTag && lead.tag ? TAG_ASSET[lead.tag] : STANDARD_ASSET;
        const Tag = onTagChange ? "button" : "div";
        return (
          <Tag
            key={lead.response_id}
            type={onTagChange ? "button" : undefined}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left, top, width: `${CELL * 0.74}%`, height: `${CELL * 0.74}%` }}
            onMouseEnter={() => setHover(lead.response_id)}
            onMouseLeave={() => setHover(null)}
            onClick={
              onTagChange
                ? () => {
                    const next = TAG_CYCLE[(TAG_CYCLE.indexOf(lead.tag) + 1) % TAG_CYCLE.length];
                    onTagChange(lead.response_id, next);
                  }
                : undefined
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset} alt="" className="h-full w-full object-contain" />
            {hover === lead.response_id && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1b2540] px-2 py-1.5 text-left text-[11px] text-white">
                <div className="font-semibold">{lead.first_name || "Lead"}</div>
                <div className="text-white/80">
                  {lead.language || "—"} · {lead.budget || "—"}
                </div>
                <div className="text-white/80">{lead.stage || "—"}</div>
                {onTagChange && <div className="mt-1 text-white/60">Click to change tag</div>}
              </div>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
