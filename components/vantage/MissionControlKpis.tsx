"use client";

import Link from "next/link";
import { CountUp } from "@/components/viz";
import { Lightbulb, Folder, TrendUp, TrendDown } from "@phosphor-icons/react";
import { Severity } from "@/lib/insights";

const SEV_COLOR: Record<Severity, string> = {
  critical: "#f87171",
  warning: "#fbbf24",
  opportunity: "#34d399",
  info: "#2d4444",
};

function TrendArrow({ up }: { up: boolean }) {
  const Icon = up ? TrendUp : TrendDown;
  return <Icon className="h-6 w-6" />;
}

function KpiIconBox({ children }: { children: React.ReactNode }) {
  return <span className="vantage-icon-box h-11 w-11">{children}</span>;
}

export function KpiCard({
  label,
  icon,
  value,
  format,
  deltaPct,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  format: (v: number) => string;
  deltaPct?: number | null;
}) {
  const up = (deltaPct ?? 0) >= 0;
  return (
    <div className="vantage-card flex h-full flex-col justify-between p-5">
      <div className="flex items-center gap-2.5">
        <KpiIconBox>{icon}</KpiIconBox>
        <p className="whitespace-nowrap text-sm text-[var(--vantage-text-muted)]">{label}</p>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[var(--vantage-text)]">
        {deltaPct !== null && deltaPct !== undefined && <TrendArrow up={up} />}
        <p className="text-3xl font-bold leading-none">
          <CountUp value={value} format={format} />
        </p>
      </div>
    </div>
  );
}

export function PortfolioHealthCard({ value }: { value: number | null }) {
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value));
  const size = 100;
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <div className="vantage-card flex h-full items-center justify-between p-5">
      <div className="flex items-center gap-2.5">
        <KpiIconBox>
          <Folder className="h-5 w-5" />
        </KpiIconBox>
        <p className="whitespace-nowrap text-sm text-[var(--vantage-text-muted)]">Portfolio Health</p>
      </div>
      <div>
        {value !== null ? (
          <svg width={size} height={size} className="shrink-0">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--vantage-icon-box)" strokeWidth={8} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--vantage-accent)"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${(clamped / 100) * c} ${c}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: "stroke-dasharray 1s cubic-bezier(0.2,0.7,0.3,1)" }}
            />
            <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.24} fontWeight={700} fill="var(--vantage-text)">
              {Math.round(clamped)}
            </text>
          </svg>
        ) : (
          <span className="shrink-0 text-xs text-[var(--vantage-text-muted)]">No data</span>
        )}
      </div>
    </div>
  );
}

export function InsightsTicker({ insights }: { insights: { id: string; severity: Severity; campaign: string; title: string }[] }) {
  return (
    <Link href="/insights" className="vantage-pill block overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--vantage-text)]">
          <Lightbulb className="h-6 w-6" />
          Insights
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          {insights.length > 0 ? (
            <div className="ticker-track flex w-max items-center gap-10">
              {[...insights, ...insights].map((ins, i) => (
                <span key={ins.id + i} className="flex items-center gap-2 whitespace-nowrap text-sm text-[var(--vantage-text-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEV_COLOR[ins.severity] }} />
                  <span className="font-medium text-[var(--vantage-text)]">{ins.campaign}:</span> {ins.title}
                </span>
              ))}
            </div>
          ) : (
            <span className="whitespace-nowrap text-sm text-[var(--vantage-text-muted)]">No findings right now.</span>
          )}
        </div>
        <span className="shrink-0 text-xs text-[var(--vantage-text-muted)]">view all →</span>
      </div>
    </Link>
  );
}
