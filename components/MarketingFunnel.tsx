import { FunnelCampaign } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { DotsIcon, FunnelIcon } from "./icons";

interface Stage {
  name: string;
  short: string;
  value: number;
  source: string;
}

const VIEW_W = 400;
const LAYER_H = 74;
const MAX_W = 350;
const MIN_W = 34;
const CENTER = VIEW_W / 2;

export default function MarketingFunnel({ campaign }: { campaign: FunnelCampaign }) {
  const { meta, typeform } = campaign;

  const stages: Stage[] = [
    { name: "Ad Appears", short: "AD APPEARS", value: meta.impressions, source: "Impressions" },
    { name: "Watches Video Ad", short: "VIDEO", value: meta.video_plays, source: "3-sec video plays" },
    { name: "Enters Landing Page", short: "LANDING", value: meta.link_clicks, source: "Link clicks" },
    { name: "Enters Typeform", short: "TYPEFORM", value: typeform.starts, source: "Form starts" },
    { name: "Fills Typeform", short: "LEAD", value: typeform.completions, source: "Form submissions" },
  ];

  const top = stages[0].value || 1;

  // Boundary widths: B[i] = width at the top of stage i; B[stages.length] tapers the base.
  // A sqrt scale keeps the deep (low-volume) stages visible while still narrowing the
  // cone — the true values and conversion rates are shown as text, so this is visual only.
  const widthFor = (v: number) =>
    Math.max(MIN_W, Math.min(MAX_W, MAX_W * Math.sqrt(Math.max(v, 0) / top)));
  const B: number[] = [];
  for (let i = 0; i < stages.length; i++) {
    const w = widthFor(stages[i].value);
    B.push(i === 0 ? w : Math.min(B[i - 1], w));
  }
  B.push(B[B.length - 1] * 0.62); // base taper

  const svgH = stages.length * LAYER_H + 24;

  return (
    <div className="panel flex h-full flex-col p-5">
      <div className="mb-2 flex items-center justify-between">
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

      <div
        className="mt-2 grid flex-1 items-stretch gap-x-4"
        style={{ gridTemplateColumns: "minmax(120px,160px) 1fr minmax(72px,96px)" }}
      >
        {/* Left labels — one cell per stage */}
        <div className="grid" style={{ gridTemplateRows: `repeat(${stages.length}, ${LAYER_H}px)` }}>
          {stages.map((s) => (
            <div key={s.name} className="flex flex-col justify-center text-right">
              <span className="text-xs font-medium text-white">{s.name}</span>
              <span className="text-[13px] font-semibold text-[var(--text-muted)]">
                {formatNumber(s.value)}
              </span>
            </div>
          ))}
        </div>

        {/* Funnel SVG */}
        <div className="flex items-start justify-center">
          <svg
            viewBox={`0 0 ${VIEW_W} ${svgH}`}
            width="100%"
            style={{ maxWidth: 460 }}
            preserveAspectRatio="xMidYMin meet"
          >
            <defs>
              <linearGradient id="funnel-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2a2370" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#15123a" stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id="funnel-rim" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6c4bdb" />
                <stop offset="100%" stopColor="#4f7cf7" />
              </linearGradient>
              <filter id="rim-glow" x="-40%" y="-200%" width="180%" height="500%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {stages.map((s, i) => {
              const y = i * LAYER_H;
              const topW = B[i];
              const botW = B[i + 1];
              const tL = CENTER - topW / 2;
              const tR = CENTER + topW / 2;
              const bL = CENTER - botW / 2;
              const bR = CENTER + botW / 2;
              return (
                <g key={s.name}>
                  <path
                    d={`M ${tL} ${y} L ${tR} ${y} L ${bR} ${y + LAYER_H} L ${bL} ${y + LAYER_H} Z`}
                    fill="url(#funnel-fill)"
                  />
                  {/* glowing elliptical rim at the top of each layer */}
                  <ellipse
                    cx={CENTER}
                    cy={y}
                    rx={topW / 2}
                    ry={6}
                    fill="none"
                    stroke="url(#funnel-rim)"
                    strokeWidth={2}
                    filter="url(#rim-glow)"
                    opacity={0.95}
                  />
                  <text
                    x={CENTER}
                    y={y + LAYER_H / 2 + 3}
                    textAnchor="middle"
                    fontSize={11}
                    letterSpacing={2}
                    fill="#cfcfe6"
                  >
                    {s.short}
                  </text>
                </g>
              );
            })}
            {/* base cap ellipse */}
            <ellipse
              cx={CENTER}
              cy={stages.length * LAYER_H}
              rx={B[stages.length] / 2}
              ry={6}
              fill="none"
              stroke="url(#funnel-rim)"
              strokeWidth={2}
              filter="url(#rim-glow)"
              opacity={0.8}
            />
          </svg>
        </div>

        {/* Right conversion badges — aligned to each stage row */}
        <div className="grid" style={{ gridTemplateRows: `repeat(${stages.length}, ${LAYER_H}px)` }}>
          {stages.map((s, i) => {
            const prev = i > 0 ? stages[i - 1].value : 0;
            const rate = i > 0 && prev > 0 ? s.value / prev : null;
            return (
              <div key={s.name} className="flex flex-col items-start justify-center">
                {rate === null ? (
                  <span className="text-xs text-[var(--text-faint)]">—</span>
                ) : (
                  <span className="rounded-md bg-[var(--accent)]/15 px-2 py-1 text-xs font-semibold text-[#b7a6ff]">
                    {formatPercent(rate)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
