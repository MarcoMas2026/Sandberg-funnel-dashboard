import { NextResponse } from "next/server";
import { getKanbanBoard, setKanbanBoard } from "@/lib/kv";
import { computeKrActualFromTasks } from "@/lib/okr-pace";
import { findKr } from "@/lib/okr-tasks";
import { getOkrData, writeKeyResultTasks } from "@/lib/sheets";
import { KrTask } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body =
  | { krId: string; action: "add"; name: string; dueDate: string }
  | { krId: string; action: "toggle"; taskId: string }
  | { krId: string; action: "delete"; taskId: string };

function nextTaskId(krId: string, tasks: KrTask[]): string {
  let max = 0;
  for (const t of tasks) {
    const m = t.id.match(/::t(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${krId}::t${max + 1}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const okr = await getOkrData();
    if (!okr.connected) {
      return NextResponse.json({ error: okr.error ?? "Google Sheets is not connected" }, { status: 200 });
    }

    const kr = findKr(okr, body.krId);
    if (!kr) {
      return NextResponse.json({ error: `Key Result ${body.krId} not found` }, { status: 404 });
    }

    let nextTasks: KrTask[];
    if (body.action === "add") {
      const task: KrTask = { id: nextTaskId(kr.id, kr.tasks), name: body.name, done: false, dueDate: body.dueDate };
      nextTasks = [...kr.tasks, task];
    } else if (body.action === "toggle") {
      nextTasks = kr.tasks.map((t) => (t.id === body.taskId ? { ...t, done: !t.done } : t));
    } else {
      nextTasks = kr.tasks.filter((t) => t.id !== body.taskId);
    }

    await writeKeyResultTasks(kr, nextTasks);

    // Keep today's Kanban board in sync with a mutation made from the Key
    // Result detail view rather than the check-in flow.
    const board = await getKanbanBoard();
    let boardChanged = false;
    let boardTasks = board.tasks;
    if (body.action === "toggle") {
      const toggled = nextTasks.find((t) => t.id === body.taskId);
      boardTasks = board.tasks.map((t) => {
        if (t.id !== body.taskId) return t;
        boardChanged = true;
        return { ...t, status: toggled?.done ? "done" : "todo" };
      });
    } else if (body.action === "delete") {
      const before = board.tasks.length;
      boardTasks = board.tasks.filter((t) => t.id !== body.taskId);
      boardChanged = boardTasks.length !== before;
    }
    if (boardChanged) {
      await setKanbanBoard({ ...board, tasks: boardTasks });
    }

    const updatedKr = { ...kr, tasks: nextTasks, actual: computeKrActualFromTasks(nextTasks) };
    return NextResponse.json({ keyResult: updatedKr, board: boardChanged ? { ...board, tasks: boardTasks } : board });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
