import { NextResponse } from "next/server";
import { getKanbanBoard, setKanbanBoard } from "@/lib/kv";
import { TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const board = await getKanbanBoard();
    return NextResponse.json(board);
  } catch (error) {
    return NextResponse.json(
      { date: null, tasks: [], checkinDue: false, lastGeneratedAt: null, lastCheckinAt: null, error: "Failed to load task board" },
      { status: 500 }
    );
  }
}

// Manual "move to →" control. Pure Kanban-state action — never touches the
// sheet. All Actual % writes are funneled through the check-in flow instead,
// so every sheet mutation traces back to an explicit multiple-choice answer.
export async function POST(request: Request) {
  try {
    const { taskId, newStatus } = (await request.json()) as { taskId: string; newStatus: TaskStatus };
    const board = await getKanbanBoard();
    const tasks = board.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
    const updated = { ...board, tasks };
    await setKanbanBoard(updated);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
