import { NextRequest, NextResponse } from "next/server";
import { freezePublicView, unfreezePublicView } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { action } = await request.json();
    if (action !== "freeze" && action !== "unfreeze") {
      return NextResponse.json({ error: 'action must be "freeze" or "unfreeze"' }, { status: 400 });
    }

    const config =
      action === "freeze" ? await freezePublicView(params.slug) : await unfreezePublicView(params.slug);
    return NextResponse.json({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update freeze state";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
