"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { buildCandidatePool, DAILY_CAPACITY } from "@/lib/okr-pace";
import { CheckinAnswer, CheckinOutcome, KanbanTask, OkrData } from "@/lib/types";

const OUTCOME_OPTIONS: { value: CheckinOutcome; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
];

export default function CheckInModal({
  tasks,
  okr,
  onSubmit,
  onClose,
}: {
  tasks: KanbanTask[];
  okr: OkrData;
  onSubmit: (answers: CheckinAnswer[], tomorrowSelection: string[]) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0); // 0..tasks.length-1 = per-task outcome, tasks.length = tomorrow's selection
  const [answers, setAnswers] = useState<Record<string, CheckinOutcome>>({});
  // Pre-checked with the top DAILY_CAPACITY as soon as the pool is known —
  // covers both the normal path (seeded again on entering step 2, see next())
  // and the no-active-tasks-today edge case, which skips straight to step 2.
  const [selection, setSelection] = useState<Set<string> | null>(() =>
    tasks.length === 0 ? new Set(buildCandidatePool(okr).slice(0, DAILY_CAPACITY).map((c) => c.task.id)) : null
  );

  const task = step < tasks.length ? tasks[step] : null;
  const current = task ? answers[task.id] : undefined;

  const pool = useMemo(() => {
    const doneTaskIds = new Set(Object.entries(answers).filter(([, o]) => o === "done").map(([id]) => id));
    return buildCandidatePool(okr).filter((c) => !doneTaskIds.has(c.task.id));
  }, [okr, answers]);

  function setOutcome(outcome: CheckinOutcome) {
    if (!task) return;
    setAnswers((prev) => ({ ...prev, [task.id]: outcome }));
  }

  function next() {
    if (step < tasks.length - 1) {
      setStep((s) => s + 1);
    } else if (step === tasks.length - 1) {
      // Entering step 2 — pre-check the top DAILY_CAPACITY of the pool.
      setSelection(new Set(pool.slice(0, DAILY_CAPACITY).map((c) => c.task.id)));
      setStep(tasks.length);
    } else {
      const finalAnswers: CheckinAnswer[] = tasks.map((t) => ({ taskId: t.id, outcome: answers[t.id] ?? "in_progress" }));
      onSubmit(finalAnswers, Array.from(selection ?? []));
    }
  }

  function toggleSelected(taskId: string) {
    setSelection((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  // Portalled straight to <body> — a page-level `.fade-up` entrance animation
  // (even one that settles at an identity transform) makes its element a new
  // containing block for `position: fixed` descendants per the CSS spec,
  // which broke this modal's viewport-fixed positioning when it was rendered
  // inline inside a page component. Rendering outside the React tree's DOM
  // nesting (like components/CommandPalette.tsx, mounted at the layout root)
  // avoids that entirely.
  const onLastStep = step >= tasks.length;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => {
        if (window.confirm("Discard this check-in?")) onClose();
      }}
    >
      <div className="glass w-full max-w-lg overflow-hidden fade-up" onClick={(e) => e.stopPropagation()}>
        {!onLastStep && task ? (
          <>
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">
                Check-in · {step + 1} of {tasks.length}
              </p>
              <p className="mt-1 text-sm font-medium text-white">{task.title}</p>
              <p className="mt-1 text-xs text-[var(--text-faint)]">{task.krLabel}</p>
            </div>

            <div className="p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">How did it go?</p>
              <div className="flex flex-wrap gap-2">
                {OUTCOME_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setOutcome(o.value)}
                    className={`pill ${current === o.value ? "pill-on accent-gradient" : "pill-off"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">Tomorrow's tasks</p>
              <p className="mt-1 text-sm font-medium text-white">
                Pick what you'll work on ({selection?.size ?? 0} selected)
              </p>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto p-5">
              {pool.length === 0 && <p className="text-xs text-[var(--text-faint)]">No open tasks anywhere — nice work.</p>}
              {pool.map((c) => (
                <label key={c.task.id} className="flex items-start gap-3 rounded-lg bg-[var(--panel2)] px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selection?.has(c.task.id) ?? false}
                    onChange={() => toggleSelected(c.task.id)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{c.task.name}</p>
                    <p className="text-[10px] text-[var(--text-faint)]">
                      {c.priority.toUpperCase()} priority · due {c.task.dueDate} · {c.department}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-4">
          <button onClick={onClose} className="text-sm text-[var(--text-faint)] hover:text-white">
            Cancel
          </button>
          <button
            onClick={next}
            disabled={!onLastStep && !current}
            className="cta-light rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {onLastStep ? "Confirm tomorrow" : step < tasks.length - 1 ? "Next" : "Choose tomorrow's tasks →"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
