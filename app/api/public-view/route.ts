import { NextRequest, NextResponse } from "next/server";
import { createPublicView, listPublicViews } from "@/lib/kv";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9-]{3,60}$/;

export async function GET() {
  try {
    const views = await listPublicViews();
    return NextResponse.json({ views });
  } catch (error) {
    return NextResponse.json({ views: [], error: "Failed to load Public Views" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { slug, propertyLabel } = await request.json();

    if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
      return NextResponse.json(
        { error: "slug must be 3-60 lowercase letters, numbers, or hyphens" },
        { status: 400 }
      );
    }
    if (typeof propertyLabel !== "string" || !propertyLabel.trim()) {
      return NextResponse.json({ error: "propertyLabel is required" }, { status: 400 });
    }

    const config = await createPublicView(slug, propertyLabel.trim());
    return NextResponse.json({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create Public View";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
