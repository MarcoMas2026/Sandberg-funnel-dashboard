"use client";

import { useState } from "react";
import { MOCK_INSIGHTS, Severity } from "@/lib/mock";
import { Sparkline } from "@/components/viz";
import { InsightIcon } from "@/components/icons";
import { GlowPanel } from "@/components/ui/glow-panel";

const SEV: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  warning: { label: "Warning", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  opportunity: { label: "Opportunity", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  info: { label: "Info", color: "#7a9bff", bg: "rgba(122,155,255,0.1)" },
};
const ORDER: Severity[] = ["critical", "warning", "opportunity", "info"];

export default function InsightsPage() {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const insights = MOCK_INSIGHTS.filter((i) => filter === "all" || i.severity === filter).sort(
    (a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity)
  );

  return (
    <div className="space-y-6">
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-faint)]">AI Analyst</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Insights</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Findings computed nightly from your own data — anomalies, fatigue, pacing and opportunities
          </p>
        </div>
        <span className="rounded-full bg-[var(--panel2)] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
          Preview — engine ships in Phase 3
        </span>
      </div>

      {/* filters */}
      <div className="fade-up flex flex-wrap gap-2" style={{ animationDelay: "0.05s" }}>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`All (${MOCK_INSIGHTS.length})`} />
        {ORDER.map((s) => (
          <FilterChip
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={`${SEV[s].label} (${MOCK_INSIGHTS.filter((i) => i.severity === s).length})`}
            dot={SEV[s].color}
          />
        ))}
      </div>

      {/* feed */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {insights.map((ins, i) => {
          const sev = SEV[ins.severity];
          return (
            <GlowPanel
              key={ins.id}
              as="article"
              wrapperClassName="fade-up"
              style={{ animationDelay: `${0.08 + i * 0.05}s` }}
              className="panel relative overflow-hidden p-5"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: sev.color, background: sev.bg }}
                  >
                    {sev.label}
                  </span>
                  <span className="text-[11px] text-[var(--text-faint)]">
                    {ins.type} · {ins.campaign}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-faint)]">
                  {new Date(ins.detected_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </div>

              <h3 className="text-base font-semibold text-[var(--text)]">{ins.title}</h3>

              <div className="mt-3 flex items-start gap-4">
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--text-muted)]">{ins.evidence}</p>
                <div className="shrink-0 pt-1">
                  <Sparkline data={ins.trend} stroke={sev.color} width={110} height={38} />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--panel2)] px-4 py-3">
                <span className="text-[#9a7cff]">
                  <InsightIcon className="h-4 w-4" />
                </span>
                <p className="text-sm text-[var(--text)]">{ins.recommendation}</p>
              </div>
            </GlowPanel>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  dot,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active ? "accent-gradient text-white" : "bg-[var(--panel2)] text-[var(--text-muted)] hover:text-[var(--text)]"
      }`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {label}
    </button>
  );
}
