import { NextRequest, NextResponse } from "next/server";
import { resolvePublicView } from "@/lib/kv";

export const dynamic = "force-dynamic";

// Public, unauthenticated — used by external tools or as a fallback for
// /view/[slug]; the page itself calls resolvePublicView() directly server-side.
export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const resolved = await resolvePublicView(params.slug);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(resolved);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load Public View data" }, { status: 500 });
  }
}
