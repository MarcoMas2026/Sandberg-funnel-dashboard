import { NextResponse } from "next/server";
import { getCompetitorsData } from "@/lib/social/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCompetitorsData();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ connected: false, error: message, competitors: [] }, { status: 500 });
  }
}
