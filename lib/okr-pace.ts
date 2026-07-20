// Pure pacing math, split out from lib/okr-tasks.ts so client components
// (e.g. app/(okr)/okrs/page.tsx) can use it without pulling in that file's
// server-only imports (lib/kv.ts, lib/sheets.ts -> googleapis, which needs
// Node core modules unavailable in the browser bundle).
import { formatPercent } from "./format";
import { KanbanTask, KeyResult, KrTask, OkrData, TaskPriority } from "./types";

// A Key Result's progress is always the fraction of its own tasks that are
// done — 0 if it has no tasks yet defined. This is the sole source for
// kr.actual/.progress; the sheet's Actual Percentage cell is write-only.
export function computeKrActualFromTasks(tasks: KrTask[]): number {
  return tasks.length ? tasks.filter((t) => t.done).length / tasks.length : 0;
}

// Linear pacing model: where a Key Result's actual % "should" be today, given
// how much of its cycle's time has elapsed.
export function computeExpectedPace(kr: KeyResult, timeProgress: number): number {
  return kr.initial + (kr.target - kr.initial) * timeProgress;
}

// Positive = behind pace, zero/negative = on or ahead of pace.
export function scoreGap(kr: KeyResult, timeProgress: number): number {
  return computeExpectedPace(kr, timeProgress) - kr.actual;
}

export function priorityForGap(gap: number): TaskPriority {
  if (gap >= 0.15) return "high";
  if (gap >= 0.05) return "medium";
  return "low";
}

// ── Due dates & daily pacing ─────────────────────────────────────────────────

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
}

const DUE_OFFSET_DAYS: Record<TaskPriority, number> = { high: 2, medium: 5, low: 10 };

// A SUGGESTION only — used to prefill the due-date field when adding a task
// in the Key Result detail view. Due dates are always user-supplied and
// editable at creation; this is no longer authoritative the way it was
// before tasks became explicitly named/dated (kept as a sane default so the
// add-task form isn't blank). deptEndDate is nullable (sheet parse) — the
// suggestion never exceeds the department's own cycle end.
export function computeDueDate(priority: TaskPriority, today: string, deptEndDate: string | null): string {
  const raw = addDays(today, DUE_OFFSET_DAYS[priority]);
  return deptEndDate && deptEndDate < raw ? deptEndDate : raw;
}

// Placeholder daily throughput — how many tasks can be "todo" (actionable) at
// once. Expected to evolve once real per-KR task volume is better known.
export const DAILY_CAPACITY = 10;

// ── Candidate pool (client-safe: pure over already-fetched OkrData, used by
// both the server's activateNextBoard and the check-in modal's client-side
// "choose tomorrow" step) ────────────────────────────────────────────────────

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export interface TaskCandidate {
  task: KrTask;
  kr: KeyResult;
  department: string;
  priority: TaskPriority;
  reasoning: string;
}

// Every not-done KrTask across every KR (skipping objectives the sheet
// hasn't been filled in for yet — an untouched template row isn't real
// work). Priority is recomputed fresh from the parent KR's current pace gap
// every time this runs, never frozen at task-creation time.
export function buildCandidatePool(okr: OkrData): TaskCandidate[] {
  const pool: TaskCandidate[] = [];
  for (const dept of okr.departments) {
    for (const objective of dept.objectives) {
      if (!objective.title.trim()) continue;
      for (const kr of objective.keyResults) {
        const gap = scoreGap(kr, dept.timeProgress);
        const priority = priorityForGap(gap);
        const expected = computeExpectedPace(kr, dept.timeProgress);
        const reasoning = `${formatPercent(gap)} behind expected pace (${formatPercent(kr.actual)} actual vs ${formatPercent(expected)} expected)`;
        for (const task of kr.tasks) {
          if (task.done) continue;
          pool.push({ task, kr, department: dept.tab, priority, reasoning });
        }
      }
    }
  }
  return pool.sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.task.dueDate.localeCompare(b.task.dueDate)
  );
}

export function candidateToKanbanTask(c: TaskCandidate, today: string): KanbanTask {
  return {
    id: c.task.id,
    title: c.task.name,
    krId: c.kr.id,
    krLabel: `${c.department} · ${c.kr.name}`,
    department: c.department,
    priority: c.priority,
    reasoning: c.reasoning,
    status: "todo",
    dueDate: c.task.dueDate,
    createdAt: today,
  };
}
