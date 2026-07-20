"use client";

import { useCallback, useEffect, useState } from "react";
import { useOkr } from "@/lib/okr-context";
import { formatDate, todayISOMadrid } from "@/lib/format";
import { CheckinAnswer, KanbanBoard, KanbanTask, TaskStatus } from "@/lib/types";
import CheckInModal from "@/components/CheckInModal";
import TaskTimeline from "@/components/TaskTimeline";
import { Pill, PRIORITY_COLOR } from "@/components/viz";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "To Do" },
  { status: "in_progress", label: "In Progress" },
  { status: "done", label: "Done" },
];

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo: "in_progress",
  in_progress: "done",
  done: null,
};

export default function TasksPage() {
  const { data, refresh: refreshOkr } = useOkr();
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [view, setView] = useState<"board" | "timeline">("board");

  const loadBoard = useCallback(async () => {
    const res = await fetch("/api/tasks", { cache: "no-store" });
    const json: KanbanBoard = await res.json();
    setBoard(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  async function generate() {
    setGenerating(true);
    try {
      await fetch("/api/tasks/generate", { method: "POST" });
      await loadBoard();
    } finally {
      setGenerating(false);
    }
  }

  async function moveTask(taskId: string, newStatus: TaskStatus) {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, newStatus }),
    });
    await loadBoard();
  }

  async function submitCheckin(answers: CheckinAnswer[], tomorrowSelection: string[]) {
    await fetch("/api/tasks/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: todayISOMadrid(), answers, tomorrowSelection }),
    });
    setCheckinOpen(false);
    await loadBoard();
    await refreshOkr();
  }

  if (loading || !data) {
    return <div className="mt-8 text-sm text-[var(--text-faint)]">Loading task board…</div>;
  }

  const tasksByStatus = (status: TaskStatus) => board?.tasks.filter((t) => t.status === status) ?? [];
  const openTasks = board?.tasks.filter((t) => t.status !== "done") ?? [];

  return (
    <div className="mt-6 fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Task Board</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <Pill label="Board" active={view === "board"} onClick={() => setView("board")} />
            <Pill label="Timeline" active={view === "timeline"} onClick={() => setView("timeline")} />
          </div>
          <button
            onClick={generate}
            disabled={generating}
            title="Auto-fill today from the ranked pool — an override/reset, not the usual flow (tasks are normally chosen the evening before)"
            className="pill pill-off flex items-center gap-2 disabled:opacity-60"
          >
            {generating ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Working…
              </>
            ) : (
              "Auto-fill today"
            )}
          </button>
        </div>
      </div>

      {board?.checkinDue && (
        <div className="panel mt-4 flex items-center justify-between p-4">
          <p className="text-sm text-white">Time for your evening check-in — {openTasks.length} task(s) open.</p>
          <button onClick={() => setCheckinOpen(true)} className="cta-light rounded-full px-4 py-2 text-sm font-semibold">
            Start check-in
          </button>
        </div>
      )}

      {view === "board" ? (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const tasks = tasksByStatus(col.status);
            return (
              <div key={col.status} className="panel p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{col.label}</p>
                  <span className="pill pill-off">{tasks.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} onMove={moveTask} />
                  ))}
                  {tasks.length === 0 && <p className="text-xs text-[var(--text-faint)]">Nothing here.</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <TaskTimeline tasks={board?.tasks ?? []} departments={data.departments} />
      )}

      {checkinOpen && (
        <CheckInModal tasks={openTasks} okr={data} onSubmit={submitCheckin} onClose={() => setCheckinOpen(false)} />
      )}
    </div>
  );
}

function TaskCard({ task, onMove }: { task: KanbanTask; onMove: (id: string, s: TaskStatus) => void }) {
  const nextStatus = NEXT_STATUS[task.status];
  const overdue = task.status !== "done" && task.dueDate < todayISOMadrid();
  return (
    <div className="relative rounded-lg bg-[var(--panel2)] p-3 pl-4">
      <span className="accent-bar" style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />
      <p className="text-sm font-medium text-white">{task.title}</p>
      <p className="mt-1 text-xs text-[var(--text-faint)]">{task.krLabel}</p>
      {task.reasoning && <p className="mt-1 text-xs text-[var(--text-muted)]">{task.reasoning}</p>}
      <p className={`mt-1 text-xs ${overdue ? "font-medium text-red-400" : "text-[var(--text-faint)]"}`}>
        {overdue ? "Overdue — " : "Due "}
        {formatDate(task.dueDate)}
      </p>
      {task.carriedForwardFrom && (
        <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
          Carried over since {task.carriedForwardFrom}
        </p>
      )}
      {nextStatus && (
        <button
          onClick={() => onMove(task.id, nextStatus)}
          className="mt-2 text-xs font-medium text-[#9a7cff] hover:text-white"
        >
          Move to {nextStatus === "in_progress" ? "In Progress" : "Done"} →
        </button>
      )}
    </div>
  );
}
