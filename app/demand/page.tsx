"use client";

import { useState } from "react";
import {
  DEMAND_AREAS,
  DEMAND_BANDS,
  MOCK_DEMAND,
  MOCK_DEMAND_FEATURES,
  MOCK_DEMAND_TIMELINE,
} from "@/lib/mock";

export default function DemandPage() {
  const [hover, setHover] = useState<{ area: string; band: string } | null>(null);
  const max = Math.max(...MOCK_DEMAND.map((d) => d.count));
  const get = (area: string, band: string) => MOCK_DEMAND.find((d) => d.area === area && d.band === band)?.count ?? 0;
  const areaTotals = DEMAND_AREAS.map((a) => ({
    area: a,
    total: MOCK_DEMAND.filter((d) => d.area === a).reduce((s, d) => s + d.count, 0),
  })).sort((x, y) => y.total - x.total);

  return (
    <div className="space-y-6">
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-faint)]">Market Intelligence</p>
          <h1 className="text-2xl font-semibold text-white">Buyer Demand Map</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            What your paid traffic is telling you buyers want — aggregated from every form submission
          </p>
        </div>
        <span className="rounded-full bg-[var(--panel2)] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
          Preview — real aggregation ships in Phase 5
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[62fr_38fr]">
        {/* heatmap */}
        <div className="panel fade-up p-5" style={{ animationDelay: "0.05s" }}>
          <h2 className="mb-4 text-sm font-semibold text-white">Demand by area × budget band</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-separate" style={{ borderSpacing: 4 }}>
              <thead>
                <tr>
                  <th className="pb-1 pr-2 text-left text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
                    Area
                  </th>
                  {DEMAND_BANDS.map((b) => (
                    <th key={b} className="pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEMAND_AREAS.map((area) => (
                  <tr key={area}>
                    <td className="whitespace-nowrap pr-2 text-xs text-[var(--text-muted)]">{area}</td>
                    {DEMAND_BANDS.map((band) => {
                      const v = get(area, band);
                      const t = v / max;
                      const isHover = hover?.area === area && hover?.band === band;
                      return (
                        <td key={band}>
                          <div
                            onMouseEnter={() => setHover({ area, band })}
                            onMouseLeave={() => setHover(null)}
                            className="relative flex h-11 min-w-[76px] cursor-default items-center justify-center rounded-lg text-sm font-semibold transition-transform"
                            style={{
                              background: `rgba(108,75,219,${0.06 + t * 0.55})`,
                              boxShadow: t > 0.7 ? "0 0 14px rgba(154,124,255,0.35)" : undefined,
                              color: t > 0.35 ? "#fff" : "var(--text-muted)",
                              transform: isHover ? "scale(1.06)" : undefined,
                              outline: isHover ? "1px solid rgba(154,124,255,0.6)" : undefined,
                            }}
                          >
                            {v}
                            {isHover && (
                              <span className="absolute -top-7 z-10 whitespace-nowrap rounded-md border border-[var(--border-strong)] bg-[var(--panel2)] px-2 py-1 text-[10px] font-normal text-white">
                                {v} buyers · {area} · {band}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* side rails */}
        <div className="space-y-5">
          <div className="panel fade-up p-5" style={{ animationDelay: "0.1s" }}>
            <h2 className="mb-3 text-sm font-semibold text-white">Hottest areas</h2>
            <ul className="space-y-2">
              {areaTotals.slice(0, 5).map((a, i) => (
                <li key={a.area} className="flex items-center gap-3">
                  <span className="w-4 text-[11px] font-semibold text-[var(--text-faint)]">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white">{a.area}</span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--panel2)]">
                    <div
                      className="accent-gradient h-full rounded-full"
                      style={{ width: `${(a.total / areaTotals[0].total) * 100}%` }}
                    />
                  </div>
                  <span className="w-7 text-right text-xs font-semibold text-[#b7a6ff]">{a.total}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel fade-up p-5" style={{ animationDelay: "0.15s" }}>
            <h2 className="mb-3 text-sm font-semibold text-white">Most requested features</h2>
            <ul className="space-y-2.5">
              {MOCK_DEMAND_FEATURES.map((f) => (
                <li key={f.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">{f.label}</span>
                    <span className="font-semibold text-white">{f.pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--panel2)]">
                    <div className="h-full rounded-full bg-[#4f7cf7]" style={{ width: `${f.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel fade-up p-5" style={{ animationDelay: "0.2s" }}>
            <h2 className="mb-3 text-sm font-semibold text-white">Buying timeline</h2>
            <div className="flex h-3 overflow-hidden rounded-full">
              {MOCK_DEMAND_TIMELINE.map((t, i) => (
                <div
                  key={t.label}
                  style={{
                    width: `${t.pct}%`,
                    background: ["#c026d3", "#8b5cf6", "#4f7cf7", "#3b3b46"][i],
                  }}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {MOCK_DEMAND_TIMELINE.map((t, i) => (
                <div key={t.label} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: ["#c026d3", "#8b5cf6", "#4f7cf7", "#3b3b46"][i] }}
                  />
                  <span className="text-[var(--text-muted)]">{t.label}</span>
                  <span className="ml-auto font-semibold text-white">{t.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
