import { NextResponse } from "next/server";
import { activateNextBoard } from "@/lib/okr-tasks";

export const dynamic = "force-dynamic";

// Vercel Cron auto-attaches `Authorization: Bearer $CRON_SECRET` once the
// CRON_SECRET env var is set on the project — this checks that same value.
// Activates whatever was confirmed in last night's check-in, or falls back
// to auto-selecting the top-ranked candidates if there's no valid pending
// selection for today (see activateNextBoard in lib/okr-tasks.ts).
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await activateNextBoard();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ activated: false, error: message }, { status: 500 });
  }
}
