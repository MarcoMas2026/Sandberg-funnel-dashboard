import { NextResponse } from "next/server";
import { runGeneration } from "@/lib/okr-tasks";

export const dynamic = "force-dynamic";

// Manual "auto-fill/reset today" override (a button on /tasks) — not the
// primary daily flow anymore, since task selection normally happens the
// evening before. Wraps the same activateNextBoard fallback logic the
// morning cron uses when there's no confirmed evening selection.
export async function POST() {
  try {
    const result = await runGeneration();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ generated: false, error: message }, { status: 500 });
  }
}
