import { NextRequest, NextResponse } from "next/server";
import { setLeadTag } from "@/lib/kv";
import { LeadTag } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_TAGS: LeadTag[] = ["red", "orange", "blue", null];

export async function POST(request: NextRequest) {
  try {
    const { response_id, tag } = await request.json();

    if (typeof response_id !== "string" || !response_id) {
      return NextResponse.json({ error: "response_id is required" }, { status: 400 });
    }
    if (!VALID_TAGS.includes(tag)) {
      return NextResponse.json({ error: "tag must be red, orange, blue, or null" }, { status: 400 });
    }

    const tags = await setLeadTag(response_id, tag);
    return NextResponse.json({ tags });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 });
  }
}
