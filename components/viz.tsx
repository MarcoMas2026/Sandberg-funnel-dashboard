"use client";

import { useEffect, useState } from "react";

// Animated numeric ticker (rAF-driven, respects the value's formatter).
export function CountUp({
  value,
  format,
  durationMs = 900,
}: {
  value: number;
  format: (v: number) => string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{format(shown)}</span>;
}

// SVG sparkline. `peakLabel`/`markers` reproduce the reference decks' pattern:
// a dotted circle at the local peak/trough with a floating value chip above it.
export function Sparkline({
  data,
  width = 120,
  height = 34,
  stroke = "#4a5786",
  fill = true,
  markers = false,
  peakLabel,
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: boolean;
  markers?: boolean;
  peakLabel?: (v: number) => string;
}) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 4;
  const topPad = peakLabel ? 14 : pad;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = topPad + (height - topPad - pad) * (1 - (v - min) / span);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const gid = `sp-${stroke.replace("#", "")}`;
  const peakIdx = data.indexOf(max);

  return (
    <svg width={width} height={height} className="block overflow-visible">
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gid})`} />
        </>
      )}
      <polyline points={line} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      {markers &&
        pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === pts.length - 1 || i === peakIdx ? 2.6 : 1.6} fill={i === peakIdx ? "var(--panel)" : stroke} stroke={i === peakIdx ? stroke : "none"} strokeWidth={1.5} />
        ))}
      {!markers && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.4} fill={stroke} />}
      {peakLabel && (
        <g transform={`translate(${pts[peakIdx][0]}, ${pts[peakIdx][1] - 8})`}>
          <rect x={-20} y={-13} width={40} height={15} rx={7} fill="#1b2540" />
          <text x={0} y={-2} textAnchor="middle" fontSize={9} fontWeight={700} fill="#ffffff">
            {peakLabel(max)}
          </text>
        </g>
      )}
    </svg>
  );
}

// Small ▲/▼ delta chip; `goodWhenUp` controls the color semantics.
export function DeltaChip({ pct, goodWhenUp = true }: { pct: number; goodWhenUp?: boolean }) {
  const up = pct >= 0;
  const good = goodWhenUp ? up : !up;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        good ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

// Circular gauge, 0–100.
export function RingGauge({ value, size = 84 }: { value: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped >= 70 ? "#34d399" : clamped >= 45 ? "#fbbf24" : "#f87171";
  return (
    <svg width={size} height={size} className="block">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={7} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 1s cubic-bezier(0.2,0.7,0.3,1)" }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.24} fontWeight={700} fill="var(--text)">
        {Math.round(clamped)}
      </text>
    </svg>
  );
}

// Donut with an empty nucleus, ring thickness matching the bar charts'
// maxBarSize proportions. Segment order is fixed red → orange → blue
// (high → mid → low) so campaigns are visually comparable at a glance.
export function LeadQualityDonut({
  red,
  orange,
  blue,
  size = 52,
  thickness = 9,
}: {
  red: number;
  orange: number;
  blue: number;
  size?: number;
  thickness?: number;
}) {
  const total = red + orange + blue;
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  const segments =
    total > 0
      ? [
          { value: red, color: "#ef4444" },
          { value: orange, color: "#f59e0b" },
          { value: blue, color: "#3b82f6" },
        ]
      : [{ value: 1, color: "var(--panel2)" }];
  const gap = total > 0 ? 3 : 0;

  let offset = 0;
  return (
    <svg width={size} height={size} className="block shrink-0">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((s, i) => {
          const frac = s.value / total || 1;
          const len = Math.max(0, frac * c - gap);
          const dashoffset = -offset;
          offset += frac * c;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={dashoffset}
              strokeLinecap={total > 0 ? "round" : "butt"}
            />
          );
        })}
      </g>
    </svg>
  );
}

// Reusable pill filter / segmented-control chip.
export function Pill({
  label,
  active,
  onClick,
  dot,
}: {
  label: string;
  active: boolean;
  onClick?: () => void;
  dot?: string;
}) {
  return (
    <button onClick={onClick} className={`pill ${active ? "pill-on accent-gradient" : "pill-off"}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {label}
    </button>
  );
}
