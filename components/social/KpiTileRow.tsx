"use client";

// Categorical accent palette for the colorful KPI tiles (distinct from the
// neutral monochrome look elsewhere in the dashboard) — matches the visual
// density asked for on /social specifically: blue / green / pink / purple / orange,
// cycled in order across however many tiles a panel has.
const PALETTE = [
  { bg: "#e4e6fb", text: "#3730a3" },
  { bg: "#dcf5e6", text: "#15803d" },
  { bg: "#fbe4f2", text: "#a3216b" },
  { bg: "#f0e4fb", text: "#6d28d9" },
  { bg: "#fdecc8", text: "#b45309" },
];

export interface KpiTile {
  label: string;
  value: string;
  trend?: "up" | "down" | null;
}

export function KpiTileRow({ tiles }: { tiles: KpiTile[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {tiles.map((tile, i) => {
        const color = PALETTE[i % PALETTE.length];
        return (
          <div
            key={tile.label}
            className="min-w-[120px] flex-1 rounded-xl px-4 py-3"
            style={{ backgroundColor: color.bg }}
          >
            <p className="text-xl font-semibold" style={{ color: color.text }}>
              {tile.value}
              {tile.trend && <span className="ml-1 text-sm">{tile.trend === "up" ? "↑" : "↓"}</span>}
            </p>
            <p className="mt-0.5 text-xs font-medium opacity-80" style={{ color: color.text }}>
              {tile.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
