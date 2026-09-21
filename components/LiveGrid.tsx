"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowSquareOut, Browser, Play, X } from "@phosphor-icons/react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { agentSlug, type LiveAgent, type LiveLane, type LiveMonthSummary, type LiveProperty } from "@/lib/live-grid";

const MIN_K = 0.1;
const MAX_K = 3;
const DOT = 24;
const MOBILE_W = 640;

type View = { x: number; y: number; k: number };

// Fixed node geometry so connector anchors can be computed without measuring.
const LANE_W = 200;
const LANE_GAP = 24;
const BLOCK_GAP = 72;
const HERO_MIN_W = 240;
const HERO_H = 170;
const VIDEO_H = 320;
const LANDING_H = 96;
const FORM_H = 80;
const LEADS_H = 84;
const V_GAP = 44;
const PAD = 60;
const TOP_SPACE = 44; // room above each hero for the agent avatar

type NodeKind = "hero" | "video" | "landing" | "form" | "leads";
interface NodeDef {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  property: LiveProperty;
  lane?: LiveLane;
}
interface EdgeDef {
  from: string;
  to: string;
  rate: number | null;
}

function buildLayout(properties: LiveProperty[]) {
  const nodes: NodeDef[] = [];
  const edges: EdgeDef[] = [];
  let x = PAD;
  let bottom = 0;
  for (const p of properties) {
    const n = Math.max(1, p.lanes.length);
    const lanesW = n * LANE_W + (n - 1) * LANE_GAP;
    const blockW = Math.max(lanesW, HERO_MIN_W);
    const laneX0 = x + (blockW - lanesW) / 2;
    const heroId = `${p.id}:hero`;
    let y = PAD + TOP_SPACE;
    nodes.push({ id: heroId, kind: "hero", x, y, w: blockW, h: HERO_H, property: p });
    y += HERO_H + V_GAP;
    p.lanes.forEach((lane, i) => {
      const lx = laneX0 + i * (LANE_W + LANE_GAP);
      let ly = y;
      const add = (kind: NodeKind, h: number, rate: number | null, prev: string) => {
        const id = `${p.id}:${i}:${kind}`;
        nodes.push({ id, kind, x: lx, y: ly, w: LANE_W, h, property: p, lane });
        edges.push({ from: prev, to: id, rate });
        ly += h + V_GAP;
        return id;
      };
      const v = add("video", VIDEO_H, null, heroId);
      const l = add("landing", LANDING_H, lane.impressions > 0 ? lane.linkClicks / lane.impressions : null, v);
      const f = add("form", FORM_H, lane.linkClicks > 0 ? lane.typeformStarts / lane.linkClicks : null, l);
      add("leads", LEADS_H, lane.typeformStarts > 0 ? lane.leads / lane.typeformStarts : null, f);
      bottom = Math.max(bottom, ly - V_GAP);
    });
    x += blockW + BLOCK_GAP;
  }
  return { nodes, edges, width: x - BLOCK_GAP + PAD, height: bottom + PAD };
}

export default function LiveGrid({
  properties: allProperties,
  agents: roster,
  summary,
  liveAds,
  fullPage = false,
}: {
  properties: LiveProperty[];
  agents: LiveAgent[];
  summary: LiveMonthSummary | null;
  liveAds: number | null; // ads currently spending
  fullPage?: boolean;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of allProperties) if (p.agent) m.set(agentSlug(p.agent), (m.get(agentSlug(p.agent)) ?? 0) + 1);
    return m;
  }, [allProperties]);
  const properties = useMemo(
    () => (selectedAgent ? allProperties.filter((p) => p.agent && agentSlug(p.agent) === selectedAgent) : allProperties),
    [allProperties, selectedAgent]
  );
  const layout = buildLayout(properties);
  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
  const [playing, setPlaying] = useState<{ src: string; title: string } | null>(null);
  const pos = (id: string) => nodeById.get(id)!;

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const fit = useCallback(() => {
    const board = boardRef.current;
    const content = contentRef.current;
    if (!board || !content) return;
    const bw = board.clientWidth;
    const bh = board.clientHeight;
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    if (!cw || !ch) return;
    const k = Math.min(1, Math.max(MIN_K, Math.min(bw / cw, bh / ch)));
    setView({ k, x: (bw - cw * k) / 2, y: Math.max(0, (bh - ch * k) / 2) });
  }, []);

  // Phones: fitting every property into ~375px makes everything unreadably small, so open on the
  // first property at a readable size (top-left, below the summary bar and agent avatar) and let the user pan.
  const startView = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const first = layoutRef.current.nodes[0];
    const k = Math.min(1, Math.max(0.6, (board.clientWidth - 24) / (first?.w ?? HERO_MIN_W)));
    setView({ k, x: 12 - PAD * k, y: 128 - (PAD + TOP_SPACE) * k });
  }, []);

  useLayoutEffect(() => {
    if ((boardRef.current?.clientWidth ?? 1024) < MOBILE_W) startView();
    else fit();
  }, [fit, startView, properties]);

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const f = k / v.k;
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
    });
  }, []);

  // Non-passive wheel listener so ctrl/cmd+wheel can preventDefault the
  // browser's own page zoom.
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = board.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    board.addEventListener("wheel", onWheel, { passive: false });
    return () => board.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlaying(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    const rest = [...pointers.current.values()];
    // one finger left after a pinch: carry on panning with it
    drag.current = rest.length === 1 ? rest[0] : null;
    if (rest.length === 0) setDragging(false);
  };

  const zoomCenter = (factor: number) => {
    const b = boardRef.current;
    if (b) zoomAt(b.clientWidth / 2, b.clientHeight / 2, factor);
  };

  // Dots keep a constant size; when zoomed out the grid step doubles (in
  // world units) until on-screen spacing stays >= 20px, so it never clogs up.
  let step = DOT;
  while (step * view.k < 20) step *= 2;
  const dotPx = step * view.k;

  return (
    <div
      ref={boardRef}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest("[data-nodrag]")) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        e.currentTarget.setPointerCapture(e.pointerId);
        if (pointers.current.size === 2) {
          // second finger: switch from panning to pinch-zooming
          drag.current = null;
          const [p1, p2] = [...pointers.current.values()];
          pinch.current = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2 };
        } else {
          drag.current = { x: e.clientX, y: e.clientY };
          setDragging(true);
        }
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const pz = pinch.current;
        if (pz && pointers.current.size === 2) {
          const [p1, p2] = [...pointers.current.values()];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          const cx = (p1.x + p2.x) / 2;
          const cy = (p1.y + p2.y) / 2;
          const r = e.currentTarget.getBoundingClientRect();
          if (pz.dist > 0 && dist > 0) zoomAt(cx - r.left, cy - r.top, dist / pz.dist);
          const dx = cx - pz.cx;
          const dy = cy - pz.cy;
          setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
          pinch.current = { dist, cx, cy };
          return;
        }
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        drag.current = { x: e.clientX, y: e.clientY };
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      }}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      className={`relative w-full touch-none select-none overflow-hidden ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      } ${fullPage ? "h-[100dvh]" : "h-[calc(100dvh-8.5rem)] rounded-2xl border border-[rgba(0,0,0,0.14)] md:h-[calc(100dvh-1.5rem)]"}`}
      style={{
        backgroundColor: "#f0f0f0",
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.13) 1px, transparent 1.5px)",
        backgroundSize: `${dotPx}px ${dotPx}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div
        ref={contentRef}
        className="absolute left-0 top-0"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          transformOrigin: "0 0",
        }}
      >
        {properties.length === 0 && <p className="p-10 text-sm text-neutral-500">No live properties right now.</p>}
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
          {layout.edges.map((e) => {
            const a = pos(e.from);
            const b = pos(e.to);
            const ax = a.x + a.w / 2;
            const ay = a.y + a.h;
            const bx = b.x + b.w / 2;
            const by = b.y;
            const dy = Math.max(24, Math.abs(by - ay) / 2);
            const mx = (ax + bx) / 2;
            const my = (ay + by) / 2;
            return (
              <g key={`${e.from}>${e.to}`}>
                <path
                  d={`M ${ax} ${ay} C ${ax} ${ay + dy}, ${bx} ${by - dy}, ${bx} ${by - 6}`}
                  fill="none"
                  stroke="#a3a3a3"
                  strokeWidth={1.25}
                />
                <path d={`M ${bx - 4} ${by - 7} L ${bx} ${by - 1} L ${bx + 4} ${by - 7} Z`} fill="#a3a3a3" />
                {e.rate !== null && (
                  <text x={mx + 8} y={my + 3} fontSize={10} fill="#737373" className="tabular-nums">
                    {formatPercent(e.rate)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {layout.nodes.map((n) => (
          <div key={n.id} className="absolute" style={{ left: n.x, top: n.y, width: n.w, height: n.h }}>
            <NodeBody node={n} onPlay={setPlaying} />
          </div>
        ))}
      </div>

      {playing && (
        <div
          data-nodrag
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPlaying(null)}
        >
          <div className="relative h-full max-h-[90vh] max-w-full" style={{ aspectRatio: "9 / 16" }} onClick={(e) => e.stopPropagation()}>
            <video src={playing.src} controls autoPlay playsInline className="h-full w-full rounded-xl bg-black object-contain" />
            <button
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-neutral-800 shadow"
              onClick={() => setPlaying(null)}
              aria-label="Close video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 right-2 flex max-w-[calc(100%-1rem)] flex-col items-end gap-2 sm:bottom-4 sm:right-4 sm:flex-row sm:items-center" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex max-w-full touch-pan-x items-center gap-1.5 overflow-x-auto rounded-lg border border-neutral-300 bg-white p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {roster.map((a) => {
            const count = counts.get(a.slug) ?? 0;
            const active = selectedAgent === a.slug;
            return (
              <button
                key={a.slug}
                disabled={count === 0}
                onClick={() => setSelectedAgent(active ? null : a.slug)}
                title={`${a.name} · ${count === 0 ? "no live campaigns" : `${count} ${count === 1 ? "campaign" : "campaigns"}`}`}
                aria-pressed={active}
                className={`h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 transition ${
                  active ? "border-neutral-900 ring-2 ring-neutral-900/25" : "border-white"
                } ${count === 0 ? "cursor-default opacity-40 grayscale" : selectedAgent && !active ? "opacity-40 hover:opacity-100" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.photo} alt={a.name} className="h-full w-full object-cover" draggable={false} />
              </button>
            );
          })}
        </div>
      <div className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-white p-1 text-xs text-neutral-700 shadow-sm">
        <button className="h-7 w-7 rounded hover:bg-neutral-100" onClick={() => zoomCenter(1 / 1.25)} aria-label="Zoom out">
          −
        </button>
        <span className="w-10 text-center tabular-nums">{Math.round(view.k * 100)}%</span>
        <button className="h-7 w-7 rounded hover:bg-neutral-100" onClick={() => zoomCenter(1.25)} aria-label="Zoom in">
          +
        </button>
        <button className="ml-1 rounded px-2 py-1 hover:bg-neutral-100" onClick={fit}>
          Fit
        </button>
      </div>
      </div>
      {summary && (
        <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex justify-center sm:top-4">
        <div
          className="pointer-events-auto flex max-w-full items-stretch divide-x divide-neutral-200 rounded-lg border border-neutral-300 bg-white shadow-sm"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <SummaryCell label={<><span className="sm:hidden">{summary.monthLabel.slice(0, 3)}</span><span className="hidden sm:inline">{summary.monthLabel}</span> · Leads</>} value={formatNumber(summary.leads)} delta={summary.deltas.leadsPct} goodWhen="up" />
          <SummaryCell label="Spend" value={formatCurrency(summary.spend)} delta={summary.deltas.spendPct} goodWhen="neutral" />
          <SummaryCell label="CPL" value={summary.cpl !== null ? formatCurrency(summary.cpl, 2) : "—"} delta={summary.deltas.cplPct} goodWhen="down" />
          <SummaryCell label="Live campaigns" value={String(allProperties.length)} delta={null} goodWhen="neutral" hideOnMobile />
          {liveAds !== null && <SummaryCell label="Live ads" value={String(liveAds)} delta={null} goodWhen="neutral" hideOnMobile />}
        </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 hidden text-[11px] sm:block text-neutral-500">
        ⌘/Ctrl + scroll to zoom · drag or scroll to pan
      </div>
    </div>
  );
}

const CARD = "h-full w-full rounded-xl border border-neutral-300 bg-white shadow-sm";

function NodeBody({ node, onPlay }: { node: NodeDef; onPlay: (v: { src: string; title: string }) => void }) {
  const { property: p, lane } = node;
  switch (node.kind) {
    case "hero":
      return (
        <div className="relative h-full w-full">
          <div
            className="relative h-full w-full overflow-hidden rounded-xl border border-neutral-900 bg-neutral-800 text-white shadow-sm"
            style={p.hero ? { backgroundImage: `url(${p.hero})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
            {p.daysLive !== null && (
              <div className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                <span className="tabular-nums font-semibold">{p.daysLive}</span> {p.daysLive === 1 ? "day" : "days"} live
              </div>
            )}
            <div className="relative flex h-full flex-col justify-end p-4">
              <div className="text-[10px] uppercase tracking-wider text-neutral-300">Ref {p.ref}</div>
              <div className="line-clamp-2 text-xl font-semibold leading-tight">{p.property}</div>
              <div className="mt-2 flex gap-5 text-xs text-neutral-200">
                <span>
                  {formatCurrency(p.spend)} <span className="text-neutral-400">spend</span>
                </span>
                <span>
                  {p.cpl > 0 ? formatCurrency(p.cpl, 2) : "—"} <span className="text-neutral-400">CPL</span>
                </span>
              </div>
            </div>
          </div>
          {p.agent && (
            <div className="absolute -top-7 left-4 flex items-start gap-2">
              {p.agentPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.agentPhoto} alt={p.agent} className="h-14 w-14 rounded-full border-2 border-white object-cover shadow" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-neutral-300 text-sm font-semibold text-neutral-700 shadow">
                  {p.agent.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
              )}
              <div className="mt-1 text-[11px] font-medium text-neutral-700">{p.agent}</div>
            </div>
          )}
        </div>
      );
    case "video":
      return (
        <div className={`${CARD} relative flex flex-col overflow-hidden`}>
          {lane!.label && (
            <span className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-neutral-900 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-white">
              {lane!.label}
            </span>
          )}
          {lane!.video ? (
            <button
              data-nodrag
              className="group relative min-h-0 flex-1 cursor-pointer overflow-hidden bg-black"
              style={{ backgroundImage: `url(${lane!.video.poster})`, backgroundSize: "cover", backgroundPosition: "center" }}
              onClick={() => onPlay({ src: lane!.video!.src, title: p.property })}
              aria-label={`Play ${p.property} ${lane!.label ?? ""} video`}
            >
              <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition group-hover:bg-black/30">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow">
                  <Play weight="fill" className="h-5 w-5 text-neutral-900" />
                </span>
              </span>
            </button>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center bg-neutral-100 px-4 text-center text-[11px] text-neutral-400">
              No {lane!.label ?? ""} video file yet
            </div>
          )}
          <div className="flex shrink-0 items-center justify-around border-t border-neutral-200 px-2 py-2">
            <Stat label="Impressions" value={formatNumber(lane!.impressions)} />
            <div className="h-6 w-px bg-neutral-200" />
            <Stat label="CTR" value={formatPercent(lane!.ctr, 2)} />
          </div>
        </div>
      );
    case "landing":
      return (
        <div className={`${CARD} flex items-center gap-3 p-4`}>
          {lane!.landingUrl ? (
            <a
              data-nodrag
              href={lane!.landingUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={lane!.landingUrl}
              className="group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white hover:bg-neutral-700"
            >
              <Browser className="h-6 w-6" />
              <ArrowSquareOut className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white p-0.5 text-neutral-700 shadow" />
            </a>
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-500">
              <Browser className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">Landing page</div>
            <div className="text-2xl font-semibold tabular-nums text-neutral-900">{formatNumber(lane!.linkClicks)}</div>
            <div className="text-[11px] text-neutral-500">link clicks</div>
          </div>
        </div>
      );
    case "form":
      return (
        <div className={`${CARD} flex flex-col justify-center p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">Enters Typeform</div>
          <div
            className="text-2xl font-semibold tabular-nums text-neutral-900"
            title={lane!.estimatedStarts ? "Estimated: this ad set shares its form with another, and abandoned form starts can't be traced to an ad set" : undefined}
          >
            {lane!.estimatedStarts ? "~" : ""}
            {formatNumber(lane!.typeformStarts)}
          </div>
        </div>
      );
    case "leads":
      return (
        <div className="flex h-full w-full flex-col justify-center rounded-xl border border-neutral-900 bg-neutral-900 p-4 text-white shadow-sm">
          <div className="text-[10px] uppercase tracking-wider text-neutral-400">Leads</div>
          <div className="text-3xl font-semibold tabular-nums">{formatNumber(lane!.leads)}</div>
        </div>
      );
  }
}

function SummaryCell({
  label,
  value,
  delta,
  goodWhen,
  hideOnMobile,
}: {
  label: React.ReactNode;
  value: string;
  delta: number | null;
  goodWhen: "up" | "down" | "neutral";
  hideOnMobile?: boolean;
}) {
  const up = delta !== null && delta > 0;
  const good = goodWhen === "neutral" ? null : goodWhen === "up" ? up : !up;
  const color = delta === null || delta === 0 || good === null ? "text-neutral-500" : good ? "text-emerald-600" : "text-rose-600";
  return (
    <div className={`min-w-0 px-2.5 py-2 text-center sm:min-w-[110px] sm:px-4 ${hideOnMobile ? "hidden sm:block" : ""}`}>
      <div className="whitespace-nowrap text-[9px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-base font-semibold leading-tight tabular-nums text-neutral-900 sm:text-lg">{value}</div>
      <div className={`h-3.5 text-[10px] tabular-nums ${color}`}>
        {delta !== null && delta !== 0 ? (
          <>
            {up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%<span className="hidden sm:inline"> vs last month</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-neutral-900">{value}</div>
    </div>
  );
}
