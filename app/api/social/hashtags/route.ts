import { NextRequest, NextResponse } from "next/server";
import { getHashtagsData, parseRange } from "@/lib/social/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const data = await getHashtagsData(parseRange(req.nextUrl.searchParams));
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ connected: false, error: message, hashtags: [] }, { status: 500 });
  }
}
