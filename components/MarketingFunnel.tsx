import { FunnelCampaign } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { DotsIcon, FunnelIcon } from "./icons";

// The funnel artwork is a fixed 2049 x 1152 image; the SVG overlay uses the same
// coordinate space so every label scales perfectly with the background.
const VB_W = 2049;
const VB_H = 1152;

const C_TEXT = "#d7d7e6"; // descriptive labels
const C_WHITE = "#ffffff";
const C_MUTED = "#9a9ab0";
const C_AMOUNT = "#ffffff";
const C_RATE = "#b7a6ff";

export default function MarketingFunnel({ campaign }: { campaign: FunnelCampaign }) {
  const { meta, typeform } = campaign;

  // Left-rail stages: descriptive name (from the design) + live amount.
  const stages = [
    { name: "AD APPEARS", value: meta.impressions, y: 100 },
    { name: "WATCHES VIDEO AD", value: meta.video_plays, y: 335 },
    { name: "ENTERS LANDING PAGE", value: meta.link_clicks, y: 635 },
    { name: "ENTERS TYPEFORM", value: typeform.starts, y: 860 },
    { name: "FILLS TYPEFORM", value: typeform.completions, y: 1070 },
  ];

  // Conversion rate into each stage (stage[i] / stage[i-1]), drawn on the right rail.
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

      <div className="flex flex-1 items-center justify-center">
        <div className="relative w-full" style={{ maxWidth: 860 }}>
          <img src="/funnel-plain.png" alt="" className="block w-full select-none" draggable={false} />

          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid meet"
            fontFamily="var(--font-inter), sans-serif"
          >
            {/* Top title */}
            <text x={1024} y={78} textAnchor="middle" fontSize={42} letterSpacing={6} fill={C_WHITE}>
              LEAD GEN
            </text>

            {/* Inside the cone — campaign / ad anatomy */}
            <text x={1024} y={205} textAnchor="middle" fontSize={26} letterSpacing={3} fill={C_TEXT}>
              AD HOOK
            </text>
            <text x={660} y={306} textAnchor="middle" fontSize={26} letterSpacing={3} fill={C_TEXT}>
              AD COPY
            </text>
            <text x={1024} y={310} textAnchor="middle" fontSize={48} letterSpacing={2} fill={C_WHITE}>
              SPECIFIC PROPERTY
            </text>
            <text x={1410} y={306} textAnchor="middle" fontSize={26} letterSpacing={3} fill={C_TEXT}>
              SEGMENTATION
            </text>
            <text x={1024} y={420} textAnchor="middle" fontSize={26} letterSpacing={3} fill={C_TEXT}>
              AD BODY
            </text>

            {/* Inside lower stages */}
            <text x={845} y={628} textAnchor="middle" fontSize={24} letterSpacing={3} fill={C_TEXT}>
              NURTURING
            </text>
            <text x={1245} y={622} textAnchor="middle" fontSize={24} letterSpacing={3} fill={C_TEXT}>
              INCENTIVE
            </text>
            <text x={1035} y={818} textAnchor="middle" fontSize={24} letterSpacing={3} fill={C_TEXT}>
              NURTURING
            </text>

            {/* Right rail — channel labels (from the design) */}
            <text x={1660} y={92} textAnchor="start" fontSize={28} letterSpacing={3} fill={C_MUTED}>
              META ADS
            </text>
            <text x={1628} y={626} textAnchor="start" fontSize={28} letterSpacing={3} fill={C_MUTED}>
              LANDING PAGE
            </text>
            <text x={1660} y={1058} textAnchor="start" fontSize={28} letterSpacing={3} fill={C_MUTED}>
              TYPEFORM
            </text>

            {/* Left rail — stage name + live amount */}
            {stages.map((s) => (
              <g key={s.name}>
                <text x={150} y={s.y} textAnchor="start" fontSize={27} letterSpacing={2} fill={C_TEXT}>
                  {s.name}
                </text>
                <text x={150} y={s.y + 42} textAnchor="start" fontSize={34} fontWeight={600} fill={C_AMOUNT}>
                  {formatNumber(s.value)}
                </text>
              </g>
            ))}

            {/* Right rail — live conversion rate into each stage */}
            {stages.map((s, i) =>
              rates[i] === null ? null : (
                <text
                  key={`rate-${s.name}`}
                  x={2010}
                  y={s.y + 12}
                  textAnchor="end"
                  fontSize={32}
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
