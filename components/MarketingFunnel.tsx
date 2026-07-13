"use client";

import { useEffect, useState } from "react";
import { FunnelCampaign } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { DotsIcon, FunnelIcon } from "./icons";

// ---- geometry (SVG user units; scales to the panel) ----
const VB_W = 760;
const VB_H = 940;
const CX = 372; // cone centre x
const MAX_W = 340; // widest (top) diameter
const PAD_TOP = 74;
const SEG_H = 150; // per-stage height
const N = 5;

// blue → fuchsia progression (top of funnel is cool, the lead glows warm/bright)
const HUES = ["#4f7cf7", "#6366f1", "#8b5cf6", "#a855f7", "#c026d3"];

// boundary widths: clean, always-narrowing silhouette (magnitude lives in the
// numbers + conversion %, so a 0-value stage never breaks the shape).
function boundaryWidth(i: number) {
  return MAX_W * (1 - 0.7 * (i / N)); // i = 0..N
}

// single rAF drives a stagger-able elapsed clock for the count-up + reveal
function useElapsed(runMs = 2000) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const e = now - start;
      setMs(e);
      if (e < runMs) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runMs]);
  return ms;
}

export default function MarketingFunnel({ campaign }: { campaign: FunnelCampaign }) {
  const { meta, typeform } = campaign;
  const [hover, setHover] = useState<number | null>(null);
  const elapsed = useElapsed();

  const stages = [
    { name: "Ad Appears", sub: "impressions", value: meta.impressions },
    { name: "Watches Video", sub: "3-sec plays", value: meta.video_plays },
    { name: "Enters Landing Page", sub: "link clicks", value: meta.link_clicks },
    { name: "Enters Typeform", sub: "form starts", value: typeform.starts },
    { name: "Fills Typeform", sub: "submissions", value: typeform.completions },
  ];

  // per-stage eased progress (staggered) for count-up + reveal
  const prog = stages.map((_, i) => {
    const t = Math.min(1, Math.max(0, (elapsed - i * 130) / 850));
    return 1 - Math.pow(1 - t, 3);
  });

  const rate = (i: number) =>
    i === 0 || stages[i - 1].value === 0 ? null : stages[i].value / stages[i - 1].value;

  return (
    <div className="panel flex h-full flex-col p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent)]">
            <FunnelIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-white">Marketing Funnel</h2>
        </div>
        <button className="icon-btn" aria-label="Options" disabled>
          <DotsIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          fontFamily="var(--font-inter), sans-serif"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            {HUES.map((h, i) => (
              <linearGradient key={i} id={`fnl-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={h} stopOpacity={0.34} />
                <stop offset="100%" stopColor={HUES[Math.min(i + 1, N - 1)]} stopOpacity={0.12} />
              </linearGradient>
            ))}
            <filter id="fnl-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id="fnl-clip">
              <path d={conePath()} />
            </clipPath>
          </defs>

          {/* recessive backdrop grid */}
          {Array.from({ length: 9 }, (_, i) => PAD_TOP + i * ((SEG_H * N) / 8)).map((y, i) => (
            <line key={i} x1={40} x2={VB_W - 40} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}

          {/* flowing "data stream" lines clipped to the cone */}
          <g clipPath="url(#fnl-clip)" opacity={0.9}>
            <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#fnl-fill-2)" opacity={0.25} />
            {[-90, -45, 0, 45, 90].map((dx, i) => (
              <line
                key={i}
                className="funnel-stream"
                x1={CX + dx * 0.4}
                y1={PAD_TOP}
                x2={CX + dx}
                y2={PAD_TOP + SEG_H * N}
                stroke="#a9b6ff"
                strokeWidth={1.4}
                strokeOpacity={0.5}
                strokeDasharray="2 10"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
            {/* soft scanline sweeping down the cone */}
            <rect className="funnel-scan" x={0} y={PAD_TOP} width={VB_W} height={40} fill="url(#fnl-fill-4)" />
          </g>

          {/* segments: fill + glowing top rim */}
          {stages.map((s, i) => {
            const y = PAD_TOP + i * SEG_H;
            const tW = boundaryWidth(i);
            const bW = boundaryWidth(i + 1);
            const active = hover === i;
            const revealed = prog[i] > 0.02;
            return (
              <g key={s.name} opacity={revealed ? 1 : 0} style={{ transition: "opacity .3s" }}>
                <path
                  d={trap(y, tW, bW)}
                  fill={`url(#fnl-fill-${i})`}
                  opacity={active ? 1 : 0.85}
                />
                {/* glowing top rim (ellipse gives the 3-D lip) */}
                <path
                  d={`M ${CX - tW / 2} ${y} A ${tW / 2} 9 0 0 0 ${CX + tW / 2} ${y}`}
                  fill="none"
                  stroke={HUES[i]}
                  strokeWidth={active ? 3 : 2}
                  filter="url(#fnl-glow)"
                  className={i === N - 1 ? "funnel-pulse" : undefined}
                />
                <path
                  d={`M ${CX - tW / 2} ${y} A ${tW / 2} 9 0 0 1 ${CX + tW / 2} ${y}`}
                  fill="none"
                  stroke={HUES[i]}
                  strokeWidth={1}
                  strokeOpacity={0.35}
                />
              </g>
            );
          })}
          {/* base lip */}
          <path
            d={`M ${CX - boundaryWidth(N) / 2} ${PAD_TOP + N * SEG_H} A ${boundaryWidth(N) / 2} 9 0 0 0 ${
              CX + boundaryWidth(N) / 2
            } ${PAD_TOP + N * SEG_H}`}
            fill="none"
            stroke={HUES[N - 1]}
            strokeWidth={2}
            filter="url(#fnl-glow)"
          />

          {/* left rail: stage name + counted-up value */}
          {stages.map((s, i) => {
            const cy = PAD_TOP + i * SEG_H + SEG_H / 2;
            const shown = Math.round(s.value * prog[i]);
            return (
              <g key={`l-${s.name}`}>
                <text x={30} y={cy - 12} fontSize={16} letterSpacing={0.5} fill="#ededf2" fontWeight={500}>
                  {s.name}
                </text>
                <text
                  x={30}
                  y={cy + 22}
                  fontSize={30}
                  fontWeight={700}
                  fill="#ffffff"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatNumber(shown)}
                </text>
                <text x={30} y={cy + 42} fontSize={12} letterSpacing={1} fill="#5c5c66">
                  {s.sub.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* right rail: conversion into each stage */}
          {stages.map((s, i) => {
            const r = rate(i);
            if (r === null) return null;
            const yTop = PAD_TOP + i * SEG_H;
            return (
              <g key={`r-${s.name}`} opacity={prog[i]}>
                <line x1={CX + boundaryWidth(i) / 2 + 6} y1={yTop} x2={690} y2={yTop} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
                <text x={730} y={yTop - 8} textAnchor="end" fontSize={22} fontWeight={700} fill="#b7a6ff">
                  {formatPercent(r)}
                </text>
                <text x={730} y={yTop + 12} textAnchor="end" fontSize={11} letterSpacing={1} fill="#5c5c66">
                  CONVERT
                </text>
              </g>
            );
          })}

          {/* "GOAL" chip on the final stage */}
          <g opacity={prog[N - 1]}>
            <rect x={628} y={PAD_TOP + (N - 1) * SEG_H + SEG_H / 2 - 14} width={104} height={26} rx={13} fill="#c026d3" fillOpacity={0.16} stroke="#c026d3" strokeOpacity={0.5} />
            <text x={680} y={PAD_TOP + (N - 1) * SEG_H + SEG_H / 2 + 4} textAnchor="middle" fontSize={12} letterSpacing={2} fill="#e9a7f5" fontWeight={600}>
              QUALIFIED
            </text>
          </g>

          {/* hover hit-areas + drop-off tooltip */}
          {stages.map((s, i) => {
            const y = PAD_TOP + i * SEG_H;
            const tW = boundaryWidth(i);
            const bW = boundaryWidth(i + 1);
            return (
              <path
                key={`hit-${s.name}`}
                d={trap(y, tW, bW)}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseOver={() => setHover(i)}
              />
            );
          })}
          {hover !== null && <DropoffTip stages={stages} i={hover} />}
        </svg>
      </div>
    </div>
  );
}

// trapezoid path for a stage (top width tW at y, bottom width bW at y+SEG_H)
function trap(y: number, tW: number, bW: number) {
  return `M ${CX - tW / 2} ${y} L ${CX + tW / 2} ${y} L ${CX + bW / 2} ${y + SEG_H} L ${CX - bW / 2} ${y + SEG_H} Z`;
}

// full cone outline (for clipping the animated streams)
function conePath() {
  const top = boundaryWidth(0);
  const bot = boundaryWidth(N);
  const yTop = PAD_TOP;
  const yBot = PAD_TOP + N * SEG_H;
  return `M ${CX - top / 2} ${yTop} L ${CX + top / 2} ${yTop} L ${CX + bot / 2} ${yBot} L ${CX - bot / 2} ${yBot} Z`;
}

function DropoffTip({
  stages,
  i,
}: {
  stages: { name: string; value: number }[];
  i: number;
}) {
  const cy = PAD_TOP + i * SEG_H + SEG_H / 2;
  const last = i === stages.length - 1;
  const dropped = last ? 0 : stages[i].value - stages[i + 1].value;
  const dropRate = !last && stages[i].value > 0 ? dropped / stages[i].value : 0;
  const label = last
    ? "the qualified lead — end of funnel"
    : `${formatNumber(dropped)} drop off before the next step (${formatPercent(dropRate)})`;
  return (
    <g pointerEvents="none">
      <rect x={CX - 168} y={cy - 20} width={336} height={40} rx={9} fill="#1a1a1f" stroke="rgba(255,255,255,0.14)" />
      <text x={CX} y={cy + 5} textAnchor="middle" fontSize={14} fill="#ededf2">
        {label}
      </text>
    </g>
  );
}
