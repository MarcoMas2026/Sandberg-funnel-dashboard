import { NextResponse } from "next/server";
import { getKanbanBoard, setKanbanBoard } from "@/lib/kv";

export const dynamic = "force-dynamic";

// Flags the board as needing a check-in — only if there's actually something
// open, so a day with nothing outstanding doesn't nag. The real check-in
// interaction happens client-side when the user next opens /tasks.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const board = await getKanbanBoard();
    const checkinDue = board.tasks.some((t) => t.status !== "done");
    const updated = { ...board, checkinDue };
    await setKanbanBoard(updated);
    return NextResponse.json({ checkinDue });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
