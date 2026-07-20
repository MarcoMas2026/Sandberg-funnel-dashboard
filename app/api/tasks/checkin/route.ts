import { NextResponse } from "next/server";
import { getKanbanBoard, setKanbanBoard, setPendingSelection } from "@/lib/kv";
import { addDays } from "@/lib/okr-pace";
import { applyCheckin } from "@/lib/okr-tasks";
import { getOkrData, writeKeyResultTasks } from "@/lib/sheets";
import { CheckinSubmission } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const submission = (await request.json()) as CheckinSubmission;
    const okr = await getOkrData();
    if (!okr.connected) {
      return NextResponse.json({ applied: false, error: okr.error ?? "Google Sheets is not connected" }, { status: 200 });
    }

    const board = await getKanbanBoard();
    const { board: updatedBoard, sheetWrites } = applyCheckin(board, submission, okr);

    const partialFailures: string[] = [];
    for (const write of sheetWrites) {
      try {
        await writeKeyResultTasks(write.kr, write.tasks);
      } catch (err) {
        partialFailures.push(write.kr.id);
      }
    }

    await setKanbanBoard(updatedBoard);
    // Tomorrow's confirmed selection, consumed once by the morning cron —
    // `date` is the day the selection is FOR (tomorrow), not the check-in day.
    await setPendingSelection({ date: addDays(submission.date, 1), taskIds: submission.tomorrowSelection });

    return NextResponse.json({ applied: true, board: updatedBoard, partialFailures });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ applied: false, error: message }, { status: 500 });
  }
}
