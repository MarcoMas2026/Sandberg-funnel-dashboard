"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { todayISOMadrid } from "@/lib/format";
import { computeDueDate, priorityForGap, scoreGap } from "@/lib/okr-pace";
import { KeyResult, KrTask, OkrDepartment } from "@/lib/types";

// Portalled straight to <body> — same containing-block fix as
// CheckInModal.tsx (a page-level `.fade-up` entrance animation makes its
// element a new containing block for `position: fixed` descendants).
export default function KrDetailModal({
  keyResult,
  department,
  onClose,
  onChange,
}: {
  keyResult: KeyResult;
  department: OkrDepartment;
  onClose: () => void;
  onChange: () => void;
}) {
  const [kr, setKr] = useState(keyResult);
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const priority = priorityForGap(scoreGap(kr, department.timeProgress));
    return computeDueDate(priority, todayISOMadrid(), department.endDate);
  });
  const [busy, setBusy] = useState(false);

  const done = kr.tasks.filter((t) => t.done).length;
  const total = kr.tasks.length;
  const pct = total ? (done / total) * 100 : 0;

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/okr/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ krId: kr.id, ...body }),
      });
      const json = await res.json();
      if (json.keyResult) setKr(json.keyResult);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function addTask() {
    if (!name.trim()) return;
    await call({ action: "add", name: name.trim(), dueDate });
    setName("");
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass w-full max-w-lg overflow-hidden fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[var(--border)] px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">{department.tab}</p>
          <p className="mt-1 text-sm font-medium text-white">{kr.name || "Untitled Key Result"}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {done} / {total} done · {pct.toFixed(1)}%
          </p>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto p-5">
          {kr.tasks.length === 0 && <p className="text-xs text-[var(--text-faint)]">No tasks yet — add one below.</p>}
          {kr.tasks.map((t) => (
            <TaskRow key={t.id} task={t} busy={busy} onToggle={() => call({ action: "toggle", taskId: t.id })} onDelete={() => call({ action: "delete", taskId: t.id })} />
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--border)] p-5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="New task name…"
            className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-[var(--text-faint)]"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-white outline-none"
          />
          <button
            onClick={addTask}
            disabled={busy || !name.trim()}
            className="cta-light rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Add
          </button>
        </div>

        <div className="flex justify-end border-t border-[var(--border)] px-5 py-3">
          <button onClick={onClose} className="text-sm text-[var(--text-faint)] hover:text-white">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TaskRow({
  task,
  busy,
  onToggle,
  onDelete,
}: {
  task: KrTask;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[var(--panel2)] px-3 py-2">
      <input type="checkbox" checked={task.done} onChange={onToggle} disabled={busy} className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${task.done ? "text-[var(--text-faint)] line-through" : "text-white"}`}>{task.name}</p>
        <p className="text-[10px] text-[var(--text-faint)]">Due {task.dueDate}</p>
      </div>
      <button onClick={onDelete} disabled={busy} className="shrink-0 text-[var(--text-faint)] hover:text-red-400">
        ×
      </button>
    </div>
  );
}
