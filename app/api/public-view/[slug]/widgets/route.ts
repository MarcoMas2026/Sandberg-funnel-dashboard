import { NextRequest, NextResponse } from "next/server";
import { addPublicViewWidget } from "@/lib/kv";
import { WIDGET_DEFS } from "@/lib/public-view-widgets";
import { PublicViewWidgetType } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(WIDGET_DEFS.map((d) => d.type));

// Appends a single widget to a config — the endpoint the global Option+drag
// gesture hits from any dashboard page, since it never has the full config
// loaded locally to PUT back.
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { type, campaignId } = await request.json();
    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ error: `Unknown widget type "${type}"` }, { status: 400 });
    }
    const config = await addPublicViewWidget(
      params.slug,
      type as PublicViewWidgetType,
      typeof campaignId === "string" ? campaignId : undefined
    );
    return NextResponse.json({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to pin widget";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
