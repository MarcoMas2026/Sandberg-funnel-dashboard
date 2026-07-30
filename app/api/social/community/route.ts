import { NextRequest, NextResponse } from "next/server";
import { getCommunityData, parseRange } from "@/lib/social/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const data = await getCommunityData(parseRange(req.nextUrl.searchParams));
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ connected: false, error: message, growth: [], balance: [], tiles: null }, { status: 500 });
  }
}
