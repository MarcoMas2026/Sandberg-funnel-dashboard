import type { GestureTemplate, GesturePoint } from "./gesture-recognizer";

// One single-stroke shape per top-level section (see lib/nav.ts). Anchors are
// in an arbitrary unit-ish square, in draw order — the recognizer resamples
// along the straight segments between them, so a handful of anchors is
// enough for straight-edged letters. Circular arcs (O, C) are sampled densely
// so the curve itself is captured rather than a polygon approximation.
function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, steps = 24) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    pts.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) });
  }
  return pts;
}

export const GESTURE_TEMPLATES: (GestureTemplate & { href: string; label: string })[] = [
  {
    // caret / roof — "home"
    name: "^",
    href: "/",
    label: "Mission Control",
    points: [
      { x: 0, y: 1 },
      { x: 0.5, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  {
    name: "C",
    href: "/campaign",
    label: "Campaigns",
    // y-down screen coords, angle 0 = right, increasing clockwise: sweep from
    // 45° to 315° (the left three-quarters), leaving the right-side gap open.
    points: arc(0.5, 0.5, 0.5, 45, 315, 32),
  },
  {
    name: "L",
    href: "/leads",
    label: "Leads",
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  },
  {
    // ~ — a wave, echoing the Curve nav icon's rise-fall-rise line
    name: "~",
    href: "/curve",
    label: "Curve",
    points: [
      { x: 0, y: 1 },
      { x: 0.35, y: 0.05 },
      { x: 0.62, y: 0.55 },
      { x: 1, y: 0.05 },
    ],
  },
  {
    name: "I",
    href: "/insights",
    label: "Insights",
    points: [
      { x: 0.5, y: 0 },
      { x: 0.5, y: 1 },
    ],
  },
  {
    name: "M",
    href: "/demand",
    label: "Demand Map",
    points: [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 0.5, y: 0.65 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  {
    name: "P",
    href: "/patterns",
    label: "Patterns",
    points: [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 0.7, y: 0.15 },
      { x: 0.7, y: 0.45 },
      { x: 0, y: 0.45 },
    ],
  },
  {
    name: "O",
    href: "/okrs",
    label: "OKRs",
    // start at top, sweep clockwise all the way around
    points: arc(0.5, 0.5, 0.5, -90, 270, 40),
  },
  {
    // S — top hump bulges right, bottom hump bulges left, meeting in the middle
    name: "S",
    href: "/social",
    label: "Social",
    points: [
      ...arc(0.5, 0.25, 0.25, 270, 450, 16),
      ...arc(0.5, 0.75, 0.25, 270, 90, 16),
    ],
  },
];

// Digit shortcuts for the 6 funnel layers (see components/LayerMenu.tsx).
// These don't have a fixed href — the destination campaign is whichever one
// is currently in view (or the first live campaign, same fallback as "C")
// — so GestureNav resolves the route at recognition time using `layerId`,
// not a stored path. `id` is the localStorage/remap key (lib/gesture-settings.ts),
// separate from `name` since name is what the recognizer matches on.
export const LAYER_GESTURE_TEMPLATES: { name: string; id: string; layerId: number; label: string; points: GesturePoint[] }[] = [
  {
    name: "1",
    id: "layer-1",
    layerId: 1,
    label: "Layer 1 — Ad Appears",
    points: [
      { x: 0.3, y: 0.15 },
      { x: 0.5, y: 0 },
      { x: 0.5, y: 1 },
    ],
  },
  {
    name: "2",
    id: "layer-2",
    layerId: 2,
    label: "Layer 2 — Engagement",
    points: [
      { x: 0.05, y: 0.2 },
      { x: 0.35, y: 0 },
      { x: 0.75, y: 0 },
      { x: 0.95, y: 0.25 },
      { x: 0.9, y: 0.45 },
      { x: 0.05, y: 0.95 },
      { x: 0.95, y: 1 },
    ],
  },
  {
    name: "3",
    id: "layer-3",
    layerId: 3,
    label: "Layer 3 — Enters Landing Page",
    points: [
      { x: 0.05, y: 0.05 },
      { x: 0.6, y: 0 },
      { x: 0.9, y: 0.2 },
      { x: 0.9, y: 0.4 },
      { x: 0.55, y: 0.5 },
      { x: 0.9, y: 0.6 },
      { x: 0.9, y: 0.8 },
      { x: 0.6, y: 1 },
      { x: 0.05, y: 0.95 },
    ],
  },
  {
    name: "4",
    id: "layer-4",
    layerId: 4,
    label: "Layer 4 — Enters Typeform",
    points: [
      { x: 0.7, y: 0 },
      { x: 0.05, y: 0.65 },
      { x: 0.95, y: 0.65 },
      { x: 0.6, y: 0.65 },
      { x: 0.6, y: 1 },
    ],
  },
  {
    name: "5",
    id: "layer-5",
    layerId: 5,
    label: "Layer 5 — Fills Typeform",
    points: [
      { x: 0.8, y: 0 },
      { x: 0.15, y: 0 },
      { x: 0.1, y: 0.45 },
      { x: 0.55, y: 0.4 },
      { x: 0.85, y: 0.6 },
      { x: 0.85, y: 0.85 },
      { x: 0.5, y: 1 },
      { x: 0.1, y: 0.85 },
    ],
  },
  {
    name: "6",
    id: "layer-6",
    layerId: 6,
    label: "Layer 6 — Qualified Lead",
    points: [
      { x: 0.75, y: 0.05 },
      { x: 0.35, y: 0.25 },
      { x: 0.1, y: 0.6 },
      { x: 0.15, y: 0.9 },
      { x: 0.45, y: 1 },
      { x: 0.75, y: 0.85 },
      { x: 0.8, y: 0.6 },
      { x: 0.6, y: 0.45 },
      { x: 0.3, y: 0.5 },
      { x: 0.15, y: 0.65 },
    ],
  },
];
