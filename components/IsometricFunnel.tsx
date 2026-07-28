"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FunnelCampaign } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { DotsIcon, FunnelIcon } from "./icons";
import { GlowPanel } from "@/components/ui/glow-panel";

// ───────────────────────── static layers: exact reference replication ─────────────────────────
// layer1.png / layer2.png / layer34.png are the actual "Funnel Design/Layers"
// artwork (cropped to their own content bbox, nothing redrawn), stacked at
// the same spacing as "Full funnel layers.png" itself. Layers 5 & 6 use the
// same grid.png plane but with real, count-driven cubes placed on top (see
// below) instead of static artwork.
//
// Spacing: earlier passes measured the gap as a fraction of a plane's height
// taken from the WRONG reference — the standalone "Layers/*.png" exports
// turned out to be rendered at a different internal scale than how those
// same planes actually appear inside "Full funnel layers.png". Redone by
// measuring the true composite directly: plane 1's own silhouette widens at
// slope 2 (confirming the grid is still 14×14 cells) up to a peak half-width
// of ~862px at y≈517, i.e. plane height ≈863px there — not 2135px.
// Re-deriving the gap as a fraction of THAT true plane height
// (apex1→apex2 = 654px / 863px ≈0.758) and cross-checking against
// layer34.png's own baked-in plane3→plane4 offset (1602px / 2136px ≈0.7495,
// the one gap that can't be moved since it's inside a single flattened
// image) agree on the same ratio: ~0.75 — an overlap of 14×(1−0.75)=3.5
// cells where two planes cross, the "overlay of 4×4 squares" seen by eye.
const GAP_RATIO = 0.75;
// Cells per edge. Earlier measured as 14 off a differently-scaled reference
// crop — re-verified directly against the actual grid.png/layer1.png pixels
// by flood-filling the background between grid lines and counting the
// enclosed cells: 256 distinct cells = 16×16, not 14×14. That mismatch (our
// cube math assumed 14 cells against an actual 16-cell image) is exactly
// why cubes weren't landing on true cell centers.
const GRID_SIZE = 16;

const RAW = {
  canvasW: 4269,
  planeH: 2136, // layer1 / layer2 / grid.png content height
  layer34H: 3737, // layer34.png content height (plane3 + frustum + plane4)
};

const DISPLAY_W = 400; // target plane width in SVG units
const RAW_SCALE = DISPLAY_W / RAW.canvasW;

const PLANE_H = RAW.planeH * RAW_SCALE;
const LAYER34_H = RAW.layer34H * RAW_SCALE;
const GAP = PLANE_H * GAP_RATIO; // uniform apex-to-apex gap between every consecutive plane

const Y1 = 0;
const Y2 = Y1 + GAP;
const Y3 = Y2 + GAP; // top of layer34.png (plane3's apex)
const Y4_APEX = Y3 + LAYER34_H - PLANE_H; // plane4's apex, baked inside layer34.png (also = GAP, confirming the ratio)
const Y5 = Y4_APEX + GAP; // top of the layer 5 grid
const Y6 = Y5 + GAP; // top of the layer 6 grid

const TOTAL_H = Y6 + PLANE_H;

const ASSET = {
  layer1: "/funnel/layer1.png",
  layer2: "/funnel/layer2.png",
  layer34: "/funnel/layer34.png",
  grid: "/funnel/grid.png",
  cubeStandard: "/funnel/cube-standard.png",
  cubeRed: "/funnel/cube-red.png",
  cubeYellow: "/funnel/cube-yellow.png",
  cubeBlue: "/funnel/cube-blue.png",
};

// ───────────────────────── dynamic cubes: one real cube sprite per lead ─────────────────────────
// Grid cell -> screen position, matching grid.png's own 14×14 lattice
// (same TILE_W:TILE_H = 2:1 dimetric projection the whole reference uses).
const TILE_W = DISPLAY_W / GRID_SIZE;
const TILE_H = PLANE_H / GRID_SIZE;

function isoPoint(gx: number, gy: number): [number, number] {
  return [DISPLAY_W / 2 + (gx - gy) * (TILE_W / 2), PLANE_H / 2 + (gx + gy) * (TILE_H / 2)];
}

// Deterministic scatter that keeps cubes from ever touching: cells are
// ranked by a GLSL-style position hash (stable across re-renders), then
// picked greedily in three passes at decreasing minimum Chebyshev distance
// (3, then 2, then 1 cells apart). Low/typical lead counts only ever draw
// from the widely-spaced first pass; the closer passes are pure overflow
// for counts large enough to need them, so cubes never land in the same or
// an adjacent cell unless the grid is nearly full.
function spacedOrder(gridSize: number): [number, number][] {
  const all: [number, number][] = [];
  for (let i = 0; i < gridSize; i++) for (let j = 0; j < gridSize; j++) all.push([i, j]);
  const key = ([i, j]: [number, number]) => {
    const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453123;
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
const CELL_ORDER = spacedOrder(GRID_SIZE);

// cube sprite proportions measured directly off the qualified-lead layer in
// "Full funnel layers.png": an isolated cube there is 129×154px against a
// 123.3×61.6px cell (i.e. plane height ≈863px / 14) — roughly one cell wide,
// 2.5 cells tall including its own drop shadow. Sized down slightly (0.85 of
// a cell instead of a full cell) so even the tightest overflow spacing above
// never has two cubes visually touching.
const CUBE_W = TILE_W * 0.85;
const CUBE_H = CUBE_W * (260 / 226); // preserve the sprite's own native aspect (226×260 crop)
const CUBE_ANCHOR = 0.67; // fraction down the sprite where it "grounds" on the plane

type BucketColor = "standard" | "red" | "orange" | "blue";
const CUBE_ASSET: Record<BucketColor, string> = {
  standard: ASSET.cubeStandard,
  red: ASSET.cubeRed,
  orange: ASSET.cubeYellow,
  blue: ASSET.cubeBlue,
};

function CubeField({ buckets }: { buckets: { color: BucketColor; count: number }[] }) {
  let cellIdx = 0;
  const cubes: JSX.Element[] = [];
  for (const b of buckets) {
    for (let n = 0; n < b.count; n++) {
      const [i, j] = CELL_ORDER[cellIdx % CELL_ORDER.length];
      cellIdx++;
      const [x, y] = isoPoint(i - GRID_SIZE / 2 + 0.5, j - GRID_SIZE / 2 + 0.5);
      cubes.push(
        <image
          key={`${b.color}-${n}`}
          href={CUBE_ASSET[b.color]}
          x={x - CUBE_W / 2}
          y={y - CUBE_H * CUBE_ANCHOR}
          width={CUBE_W}
          height={CUBE_H}
        />
      );
    }
  }
  return <>{cubes}</>;
}

interface TagCounts {
  red: number;
  orange: number;
  blue: number;
}

export default function IsometricFunnel({ campaign, tagCounts }: { campaign: FunnelCampaign; tagCounts?: TagCounts }) {
  const { meta, typeform } = campaign;
  const router = useRouter();
  const [hoverLayer, setHoverLayer] = useState<number | null>(null);

  const tags = tagCounts ?? { red: 0, orange: 0, blue: 0 };
  const submissions = typeform.completions;

  const topPad = 30;
  const leftPad = 210; // room for the left label rail
  const rightPad = 140; // room for the right conversion rail
  const vbW = leftPad + DISPLAY_W + rightPad;
  const vbH = topPad + TOTAL_H + 30;

  // Each stage's raw y-offset (pre topPad/PLANE_H-centering) — shared by the
  // label rail below and the click-through hit zones that open that layer's
  // 2D drill-down at /campaign/[id]/layer/[n].
  const LAYER_Y = [Y1, Y2, Y3, Y4_APEX, Y5, Y6];

  const labels = [
    { y: topPad + Y1 + PLANE_H / 2, name: "Ad Appears", value: meta.impressions, sub: "impressions" },
    // post_engagement — same field for every campaign type (property or
    // community), so this stage is a true apples-to-apples number instead of
    // swapping in video_plays for video-format campaigns.
    { y: topPad + Y2 + PLANE_H / 2, name: "Engagement", value: meta.engagement, sub: "post engagements" },
    { y: topPad + Y3 + PLANE_H / 2, name: "Enters Landing Page", value: meta.link_clicks, sub: "link clicks" },
    { y: topPad + Y4_APEX + PLANE_H / 2, name: "Enters Typeform", value: typeform.starts, sub: "form starts" },
    { y: topPad + Y5 + PLANE_H / 2, name: "Fills Typeform", value: submissions, sub: "submissions" },
    { y: topPad + Y6 + PLANE_H / 2, name: "Qualified Lead", value: tags.red, sub: "qualified leads (high)" },
  ];

  // Conversion into each stage from the one immediately above it — same
  // "rate into this stage" math as the retired cone view's right rail, so
  // the one live visualization still carries that number.
  const rate = (i: number) =>
    i === 0 || labels[i - 1].value === 0 ? null : labels[i].value / labels[i - 1].value;

  return (
    <GlowPanel wrapperClassName="h-full" className="panel flex h-full flex-col p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent)]">
            <FunnelIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-[var(--text)]">Isometric Funnel</h2>
        </div>
        <button className="icon-btn" aria-label="Options" disabled>
          <DotsIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1">
        <svg viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" fontFamily="var(--font-inter), sans-serif">
          {/* SVG paints later elements on top, so draw back-to-front: the
              last/lowest layer (6) goes down first, then each earlier layer
              on top of it, ending with layer 1 painted last — frontmost,
              exactly like the reference where each earlier plane sits in
              front of the one below it. Each layer's own cubes are drawn
              immediately after its grid so they stay grouped with their
              plane in the stacking order. */}
          <g transform={`translate(${leftPad}, ${topPad})`}>
            <image href={ASSET.grid} x={0} y={Y6} width={DISPLAY_W} height={PLANE_H} />
            <g transform={`translate(0, ${Y6})`}>
              <CubeField buckets={[{ color: "red", count: tags.red }, { color: "orange", count: tags.orange }, { color: "blue", count: tags.blue }]} />
            </g>

            <image href={ASSET.grid} x={0} y={Y5} width={DISPLAY_W} height={PLANE_H} />
            <g transform={`translate(0, ${Y5})`}>
              <CubeField buckets={[{ color: "standard", count: submissions }]} />
            </g>

            <image href={ASSET.layer34} x={0} y={Y3} width={DISPLAY_W} height={LAYER34_H} />
            <image href={ASSET.layer2} x={0} y={Y2} width={DISPLAY_W} height={PLANE_H} />
            <image href={ASSET.layer1} x={0} y={Y1} width={DISPLAY_W} height={PLANE_H} />
          </g>

          {labels.map((l) => (
            <g key={l.name} transform={`translate(${leftPad - 16}, ${l.y})`}>
              <text x={0} y={-11} textAnchor="end" fontSize={11.5} fontWeight={600} fill="var(--text)">
                {l.name}
              </text>
              <text x={0} y={5} textAnchor="end" fontSize={15} fontWeight={700} fill="var(--text)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatNumber(l.value)}
              </text>
              <text x={0} y={17} textAnchor="end" fontSize={8.5} letterSpacing={0.6} fill="var(--text-faint)">
                {l.sub.toUpperCase()}
              </text>
            </g>
          ))}

          {labels.map((l, i) => {
            const r = rate(i);
            if (r === null) return null;
            return (
              <g key={`r-${l.name}`} transform={`translate(${leftPad + DISPLAY_W + 16}, ${l.y})`}>
                <text x={0} y={-2} fontSize={17} fontWeight={700} fill="var(--text)">
                  {formatPercent(r)}
                </text>
                <text x={0} y={12} fontSize={8.5} letterSpacing={1} fill="var(--text-faint)">
                  CONVERT
                </text>
              </g>
            );
          })}

          {/* click-through zones: each stage opens its own 2D drill-down page */}
          {LAYER_Y.map((y0, i) => (
            <rect
              key={`hit-${i}`}
              x={leftPad}
              y={topPad + y0}
              width={DISPLAY_W}
              height={PLANE_H}
              fill={hoverLayer === i ? "rgba(0,0,0,0.04)" : "transparent"}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoverLayer(i)}
              onMouseLeave={() => setHoverLayer(null)}
              onClick={() => router.push(`/campaign/${campaign.campaign_id}/layer/${i + 1}`)}
            />
          ))}
        </svg>
      </div>
    </GlowPanel>
  );
}
