"use client";

import { useState } from "react";
import { MOCK_DNA, DEMAND_AREAS, DEMAND_BANDS, MOCK_DEMAND } from "@/lib/mock";
import { formatCurrency } from "@/lib/format";
import { GlowPanel } from "@/components/ui/glow-panel";

const GROUPS = ["Format", "Hook", "Language"] as const;

export default function PatternsPage() {
  const [hover, setHover] = useState<{ area: string; band: string } | null>(null);
  const max = Math.max(...MOCK_DEMAND.map((d) => d.count));
  const getDemand = (area: string, band: string) => MOCK_DEMAND.find((d) => d.area === area && d.band === band)?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-faint)]">Creative Intelligence</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Creative DNA</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            In the Andromeda era, creative is the targeting. These are the patterns that win across your campaigns
          </p>
        </div>
        <span className="rounded-full bg-[var(--panel2)] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
          Preview: tagging engine ships in Phase 7
        </span>
      </div>

      <GlowPanel wrapperClassName="fade-up" className="panel p-5">
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
                    const v = getDemand(area, band);
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

      {GROUPS.map((group, gi) => {
        const tags = MOCK_DNA.filter((d) => d.group === group).sort((a, b) => b.qlsX - a.qlsX);
        const best = tags[0]?.qlsX ?? 1;
        return (
          <section key={group} className="fade-up" style={{ animationDelay: `${0.05 + gi * 0.08}s` }}>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">{group}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tags.map((t) => {
                const winner = t.qlsX === best && t.qlsX > 1;
                return (
                  <GlowPanel key={t.tag} className="panel p-5">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--text)]">{t.tag}</p>
                      {winner && (
                        <span className="shrink-0 rounded-full bg-[#1b2540]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1b2540]">
                          Top pattern
                        </span>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className={`text-3xl font-bold ${t.qlsX >= 1 ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
                          {t.qlsX.toFixed(1)}×
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">quality-lead multiplier</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[var(--text)]">{formatCurrency(t.cpl, 2)}</p>
                        <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">avg CPL</p>
                        <p className="mt-1 text-[10px] text-[var(--text-faint)]">{t.sample} ads sampled</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--panel2)]">
                      <div
                        className={`h-full rounded-full ${t.qlsX >= 1 ? "accent-gradient" : "bg-[#3b3b46]"}`}
                        style={{ width: `${Math.min(100, (t.qlsX / 2.2) * 100)}%` }}
                      />
                    </div>
                  </GlowPanel>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
