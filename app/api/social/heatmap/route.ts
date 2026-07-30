import { NextResponse } from "next/server";
import { getHeatmapData } from "@/lib/social/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getHeatmapData();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ connected: false, error: message, cells: [] }, { status: 500 });
  }
}
