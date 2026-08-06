"use client";

import { useState } from "react";
import { DEMAND_AREAS, DEMAND_BANDS, MOCK_DEMAND } from "@/lib/mock";
import { GlowPanel } from "@/components/ui/glow-panel";
import { LeadOriginGlobe } from "@/components/ui/lead-origin-globe";

export default function DemandPage() {
  const [hover, setHover] = useState<{ area: string; band: string } | null>(null);
  const max = Math.max(...MOCK_DEMAND.map((d) => d.count));
  const get = (area: string, band: string) => MOCK_DEMAND.find((d) => d.area === area && d.band === band)?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-faint)]">Market Intelligence</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Buyer Demand Map</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            What your paid traffic is telling you buyers want, aggregated from every form submission
          </p>
        </div>
        <span className="rounded-full bg-[var(--panel2)] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
          Preview: real aggregation ships in Phase 5
        </span>
      </div>

      <LeadOriginGlobe />

      <div className="grid grid-cols-1 gap-5">
        {/* heatmap */}
        <GlowPanel wrapperClassName="fade-up" style={{ animationDelay: "0.05s" }} className="panel p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Demand by area × budget band</h2>
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
                              background: `rgba(27,37,64,${0.05 + t * 0.65})`,
                              color: t > 0.4 ? "#ffffff" : "var(--text-muted)",
                              transform: isHover ? "scale(1.06)" : undefined,
                              outline: isHover ? "1px solid rgba(27,37,64,0.5)" : undefined,
                            }}
                          >
                            {v}
                            {isHover && (
                              <span className="absolute -top-7 z-10 whitespace-nowrap rounded-md border border-[var(--border-strong)] bg-[var(--panel2)] px-2 py-1 text-[10px] font-normal text-[var(--text)]">
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
        </GlowPanel>
      </div>
    </div>
  );
}
