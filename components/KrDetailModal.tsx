"use client";

import { createPortal } from "react-dom";
import { KeyResult, KrTask, OkrDepartment } from "@/lib/types";

// Portalled straight to <body> — same containing-block fix as
// CommandPalette.tsx (a page-level `.fade-up` entrance animation makes its
// element a new containing block for `position: fixed` descendants).
//
// Read-only: this dashboard only visualizes OKR progress, it never writes
// back to the sheet. Task state here always mirrors whatever's in the sheet.
export default function KrDetailModal({
  keyResult,
  department,
  onClose,
}: {
  keyResult: KeyResult;
  department: OkrDepartment;
  onClose: () => void;
}) {
  const done = keyResult.tasks.filter((t) => t.done).length;
  const total = keyResult.tasks.length;
  const pct = total ? (done / total) * 100 : 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass w-full max-w-lg overflow-hidden fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[var(--border)] px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">{department.tab}</p>
          <p className="mt-1 text-sm font-medium text-[var(--text)]">{keyResult.name || "Untitled Key Result"}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {done} / {total} done · {pct.toFixed(1)}%
          </p>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto p-5">
          {keyResult.tasks.length === 0 && <p className="text-xs text-[var(--text-faint)]">No tasks logged for this Key Result yet.</p>}
          {keyResult.tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>

        <div className="flex justify-end border-t border-[var(--border)] px-5 py-3">
          <button onClick={onClose} className="text-sm text-[var(--text-faint)] hover:text-[var(--text)]">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TaskRow({ task }: { task: KrTask }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[var(--panel2)] px-3 py-2">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
          task.done ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-strong)]"
        }`}
      >
        {task.done && (
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${task.done ? "text-[var(--text-faint)] line-through" : "text-[var(--text)]"}`}>{task.name}</p>
        <p className="text-[10px] text-[var(--text-faint)]">Due {task.dueDate}</p>
      </div>
    </div>
  );
}
