import { NextRequest, NextResponse } from "next/server";
import { getPostsData, getReelsData, getStoriesData, parseRange } from "@/lib/social/db";

export const dynamic = "force-dynamic";

// ?type=posts|reels|stories
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "posts";
  const range = parseRange(req.nextUrl.searchParams);

  try {
    if (type === "reels") return NextResponse.json(await getReelsData(range));
    if (type === "stories") return NextResponse.json(await getStoriesData(range));
    return NextResponse.json(await getPostsData(range));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ connected: false, error: message, items: [] }, { status: 500 });
  }
}
