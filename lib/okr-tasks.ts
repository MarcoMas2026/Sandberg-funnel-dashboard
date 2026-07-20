import { todayISOMadrid } from "./format";
import { clearPendingSelection, getKanbanBoard, getPendingSelection, setKanbanBoard } from "./kv";
import {
  buildCandidatePool,
  candidateToKanbanTask,
  computeExpectedPace,
  DAILY_CAPACITY,
  priorityForGap,
  scoreGap,
  TaskCandidate,
} from "./okr-pace";
import { getOkrData } from "./sheets";
import { CheckinSubmission, KanbanBoard, KanbanTask, KeyResult, KrTask, OkrData } from "./types";

export { buildCandidatePool, computeExpectedPace, scoreGap, priorityForGap };

export function findKr(okr: OkrData, krId: string): KeyResult | null {
  for (const dept of okr.departments) {
    for (const objective of dept.objectives) {
      for (const kr of objective.keyResults) {
        if (kr.id === krId) return kr;
      }
    }
  }
  return null;
}

// Builds today's board from a confirmed evening selection (see
// PendingSelection), or falls back to auto-selecting the top DAILY_CAPACITY
// from the ranked candidate pool if there's no valid pending selection for
// today (day one, a skipped evening step, first deploy) — a board is never
// silently empty. Shared by the morning cron and the manual "Generate
// today's tasks" button.
export async function activateNextBoard(): Promise<{ activated: boolean; error?: string; board?: KanbanBoard }> {
  const okr = await getOkrData();
  if (!okr.connected) {
    return { activated: false, error: okr.error ?? "Google Sheets is not connected" };
  }

  const today = todayISOMadrid();
  const pool = buildCandidatePool(okr);
  const poolByTaskId = new Map(pool.map((c) => [c.task.id, c]));

  const pending = await getPendingSelection();
  let selected: TaskCandidate[] = [];

  if (pending && pending.date === today) {
    // Validate against the FRESHLY-parsed pool, not just that the krId still
    // exists — closes the monthly-reset gap: a same-shaped sheet rewrite
    // (same rows, new month's content) reuses the same krIds, but a stale
    // task id from last month simply won't be found here once its KR's
    // Aligned Tasks cell has been retyped for the new cycle.
    selected = pending.taskIds.map((id) => poolByTaskId.get(id)).filter((c): c is TaskCandidate => Boolean(c));
  }

  if (selected.length === 0) {
    selected = pool.slice(0, DAILY_CAPACITY);
  }

  const previous = await getKanbanBoard();
  const previousById = new Map(previous.tasks.map((t) => [t.id, t]));

  const tasks = selected.map((c) => {
    const prior = previousById.get(c.task.id);
    const kanban = candidateToKanbanTask(c, today);
    if (!prior) return kanban;
    return { ...kanban, createdAt: prior.createdAt, carriedForwardFrom: prior.carriedForwardFrom ?? prior.createdAt };
  });

  const board: KanbanBoard = {
    date: today,
    tasks,
    checkinDue: false,
    lastGeneratedAt: new Date().toISOString(),
    lastCheckinAt: previous.lastCheckinAt,
  };

  await setKanbanBoard(board);
  await clearPendingSelection();
  return { activated: true, board };
}

// Manual "Generate today's tasks" override/reset — an explicit re-run of the
// same fallback logic activateNextBoard uses when there's no confirmed
// evening selection, callable any time (not the primary daily flow anymore).
export async function runGeneration() {
  const result = await activateNextBoard();
  if (!result.activated) {
    return { generated: false as const, error: result.error };
  }
  return { generated: true as const, board: result.board! };
}

// Afternoon check-in: step 1's outcomes flip underlying KrTask.done flags
// (grouped per-KR so each affected KR gets exactly one batched sheet write,
// not one per task); step 2's tomorrowSelection is handled by the API route
// (written as a PendingSelection) since it doesn't mutate any KR data here.
export function applyCheckin(
  board: KanbanBoard,
  submission: CheckinSubmission,
  freshOkr: OkrData
): { board: KanbanBoard; sheetWrites: { kr: KeyResult; tasks: KrTask[] }[] } {
  const answerByTaskId = new Map(submission.answers.map((a) => [a.taskId, a]));
  const sheetWrites: { kr: KeyResult; tasks: KrTask[] }[] = [];

  for (const dept of freshOkr.departments) {
    for (const objective of dept.objectives) {
      for (const kr of objective.keyResults) {
        let changed = false;
        const nextTasks = kr.tasks.map((t) => {
          const answer = answerByTaskId.get(t.id);
          if (answer?.outcome === "done" && !t.done) {
            changed = true;
            return { ...t, done: true };
          }
          return t;
        });
        if (changed) sheetWrites.push({ kr, tasks: nextTasks });
      }
    }
  }

  const tasks = board.tasks.map((task) => {
    const answer = answerByTaskId.get(task.id);
    if (!answer) return task;
    const nextStatus: KanbanTask["status"] =
      answer.outcome === "done" ? "done" : answer.outcome === "blocked" ? "todo" : "in_progress";
    return { ...task, status: nextStatus, lastCheckin: { date: submission.date, outcome: answer.outcome } };
  });

  return {
    board: { ...board, tasks, checkinDue: false, lastCheckinAt: new Date().toISOString() },
    sheetWrites,
  };
}
