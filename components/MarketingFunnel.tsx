import { FunnelCampaign } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { DotsIcon, FunnelIcon } from "./icons";

// The funnel artwork is a fixed 1366 x 1100 image; the SVG overlay shares the same
// coordinate space so every label scales perfectly with the background.
const VB_W = 1366;
const VB_H = 1100;

const C_TEXT = "#d7d7e6";
const C_WHITE = "#ffffff";
const C_MUTED = "#9a9ab0";
const C_RATE = "#b7a6ff";

export default function MarketingFunnel({ campaign }: { campaign: FunnelCampaign }) {
  const { meta, typeform } = campaign;

  // Left rail: stage name (from the design) + live amount. y = baseline of the name.
  const stages = [
    { name: "AD APPEARS", value: meta.impressions, y: 205 },
    { name: "WATCHES VIDEO AD", value: meta.video_plays, y: 445 },
    { name: "ENTERS LANDING PAGE", value: meta.link_clicks, y: 625 },
    { name: "ENTERS TYPEFORM", value: typeform.starts, y: 795 },
    { name: "FILLS TYPEFORM", value: typeform.completions, y: 955 },
  ];

  const rates = stages.map((s, i) =>
    i === 0 || stages[i - 1].value === 0 ? null : s.value / stages[i - 1].value
  );

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

      <div className="flex flex-1 items-start justify-center">
        <div className="relative w-full" style={{ maxWidth: 760 }}>
          <img src="/funnel-empty.png" alt="" className="block w-full select-none" draggable={false} />

          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid meet"
            fontFamily="var(--font-inter), sans-serif"
          >
            {/* Top title */}
            <text x={683} y={96} textAnchor="middle" fontSize={32} letterSpacing={5} fill={C_WHITE}>
              LEAD GEN
            </text>

            {/* Inside the cone — campaign / ad anatomy */}
            <text x={683} y={218} textAnchor="middle" fontSize={22} letterSpacing={3} fill={C_TEXT}>
              AD HOOK
            </text>
            <text x={315} y={300} textAnchor="middle" fontSize={22} letterSpacing={2} fill={C_TEXT}>
              AD COPY
            </text>
            <text x={683} y={303} textAnchor="middle" fontSize={38} letterSpacing={1} fill={C_WHITE}>
              SPECIFIC PROPERTY
            </text>
            <text x={1055} y={300} textAnchor="middle" fontSize={22} letterSpacing={2} fill={C_TEXT}>
              SEGMENTATION
            </text>
            <text x={683} y={382} textAnchor="middle" fontSize={22} letterSpacing={3} fill={C_TEXT}>
              AD BODY
            </text>

            {/* Inside lower stages */}
            <text x={510} y={562} textAnchor="middle" fontSize={20} letterSpacing={2} fill={C_TEXT}>
              NURTURING
            </text>
            <text x={808} y={556} textAnchor="middle" fontSize={20} letterSpacing={2} fill={C_TEXT}>
              INCENTIVE
            </text>
            <text x={683} y={702} textAnchor="middle" fontSize={20} letterSpacing={2} fill={C_TEXT}>
              NURTURING
            </text>

            {/* Right rail — channel labels (tucked between the conversion rows) */}
            <text x={1320} y={165} textAnchor="end" fontSize={19} letterSpacing={2} fill={C_MUTED}>
              META ADS
            </text>
            <text x={1320} y={545} textAnchor="end" fontSize={19} letterSpacing={2} fill={C_MUTED}>
              LANDING PAGE
            </text>
            <text x={1320} y={885} textAnchor="end" fontSize={19} letterSpacing={2} fill={C_MUTED}>
              TYPEFORM
            </text>

            {/* Left rail — stage name + live amount */}
            {stages.map((s) => (
              <g key={s.name}>
                <text x={36} y={s.y} textAnchor="start" fontSize={24} letterSpacing={1.5} fill={C_TEXT}>
                  {s.name}
                </text>
                <text x={36} y={s.y + 40} textAnchor="start" fontSize={32} fontWeight={600} fill={C_WHITE}>
                  {formatNumber(s.value)}
                </text>
              </g>
            ))}

            {/* Right rail — live conversion rate into each stage */}
            {stages.map((s, i) =>
              rates[i] === null ? null : (
                <text
                  key={`rate-${s.name}`}
                  x={1320}
                  y={s.y + 10}
                  textAnchor="end"
                  fontSize={30}
                  fontWeight={600}
                  fill={C_RATE}
                >
                  {formatPercent(rates[i]!)}
                </text>
              )
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
