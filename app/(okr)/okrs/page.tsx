"use client";

import { useState } from "react";
import { useOkr } from "@/lib/okr-context";
import { formatDate, formatPercent } from "@/lib/format";
import { computeExpectedPace } from "@/lib/okr-pace";
import { Pill, RingGauge } from "@/components/viz";
import { ProgressBar } from "@/components/ProgressBar";
import KrDetailModal from "@/components/KrDetailModal";
import { KeyResult, OkrDepartment } from "@/lib/types";
import { GlowPanel } from "@/components/ui/glow-panel";

export default function OkrsPage() {
  const { data, loading, error, refresh } = useOkr();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [openKr, setOpenKr] = useState<{ kr: KeyResult; dept: OkrDepartment } | null>(null);

  if (loading) {
    return <div className="mt-8 text-sm text-[var(--text-faint)]">Loading OKRs…</div>;
  }

  if (!data || !data.connected) {
    return (
      <div className="mt-8">
        <h1 className="text-2xl font-semibold text-[var(--text)]">OKRs</h1>
        <GlowPanel wrapperClassName="mt-5" className="panel p-6">
          <p className="text-sm font-medium text-[var(--text)]">Google Sheets isn&apos;t connected yet</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {data?.error ?? error ?? "Missing service-account credentials or spreadsheet ID."}
          </p>
          <p className="mt-4 text-xs text-[var(--text-faint)]">
            Set <code>GOOGLE_SHEETS_CLIENT_EMAIL</code>, <code>GOOGLE_SHEETS_PRIVATE_KEY</code>, and{" "}
            <code>GOOGLE_SHEETS_SPREADSHEET_ID</code> in <code>.env.local</code> (and in Vercel for
            production), then share the sheet with the service account&apos;s email as Editor.
          </p>
          <button onClick={() => void refresh()} className="cta-light mt-4 rounded-full px-4 py-2 text-sm font-semibold">
            Retry
          </button>
        </GlowPanel>
      </div>
    );
  }

  const tab = activeTab ?? data.departments[0]?.tab;
  const dept = data.departments.find((d) => d.tab === tab) ?? data.departments[0];

  return (
    <div className="mt-6 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--text)]">OKRs</h1>
        <div className="flex gap-2">
          <button onClick={() => void refresh()} className="pill pill-off">
            Sync now
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {data.departments.map((d) => (
          <Pill key={d.tab} label={d.tab} active={d.tab === dept?.tab} onClick={() => setActiveTab(d.tab)} />
        ))}
      </div>

      {dept && (
        <>
          <GlowPanel wrapperClassName="mt-5" className="panel flex flex-wrap items-center gap-8 p-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">Cycle</p>
              <p className="mt-1 text-lg font-semibold text-[var(--text)]">{dept.cycleLabel || "—"}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {formatDate(dept.startDate)} – {formatDate(dept.endDate)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">Days Left</p>
              <p className="mt-1 text-lg font-semibold text-[var(--text)]">{dept.daysLeft || "—"}</p>
            </div>
            <div className="flex items-center gap-3">
              <RingGauge value={dept.timeProgress * 100} size={64} />
              <p className="text-xs text-[var(--text-muted)]">Time Progress</p>
            </div>
            <div className="flex items-center gap-3">
              <RingGauge value={dept.overallProgress * 100} size={64} />
              <p className="text-xs text-[var(--text-muted)]">Overall Progress</p>
            </div>
          </GlowPanel>

          <div className="mt-5 flex flex-col gap-4">
            {dept.objectives.length === 0 && (
              <p className="text-sm text-[var(--text-faint)]">No objectives found on this tab yet.</p>
            )}
            {dept.objectives.map((objective) => (
              <GlowPanel key={objective.id} className="panel p-6">
                <h2 className="text-base font-semibold text-[var(--text)]">
                  {objective.title || `Objective ${objective.index} (not filled in yet)`}
                </h2>
                <div className="mt-4 flex flex-col gap-4">
                  {objective.keyResults.map((kr) => {
                    const expected = computeExpectedPace(kr, dept.timeProgress);
                    const done = kr.tasks.filter((t) => t.done).length;
                    return (
                      <button
                        key={kr.id}
                        onClick={() => setOpenKr({ kr, dept })}
                        className="block w-full rounded-lg text-left transition-colors hover:bg-[var(--panel2)]/60"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--text)]">{kr.name || "Untitled Key Result"}</span>
                          <span className="font-medium text-[var(--text)]">{formatPercent(kr.actual)}</span>
                        </div>
                        <div className="mt-2">
                          <ProgressBar value={kr.actual} expected={expected} target={kr.target} />
                        </div>
                        <p className="mt-1.5 text-xs text-[var(--text-faint)]">
                          {kr.tasks.length ? `${done} / ${kr.tasks.length} tasks done` : "No tasks logged yet"}
                        </p>
                      </button>
                    );
                  })}
                  {objective.keyResults.length === 0 && (
                    <p className="text-xs text-[var(--text-faint)]">No key results found.</p>
                  )}
                </div>
              </GlowPanel>
            ))}
          </div>
        </>
      )}

      {openKr && (
        <KrDetailModal keyResult={openKr.kr} department={openKr.dept} onClose={() => setOpenKr(null)} />
      )}
    </div>
  );
}
