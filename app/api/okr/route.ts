import { NextResponse } from "next/server";
import { getOkrData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getOkrData();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { departments: [], fetchedAt: new Date().toISOString(), connected: false, error: message },
      { status: 500 }
    );
  }
}
