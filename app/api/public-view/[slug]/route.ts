import { NextRequest, NextResponse } from "next/server";
import { deletePublicView, getPublicViewConfig, savePublicViewConfig } from "@/lib/kv";
import { PublicViewTheme, PublicViewWidget } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const config = await getPublicViewConfig(params.slug);
    if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load Public View" }, { status: 500 });
  }
}

// Builder-only edits: widgets, theme, published, propertyLabel. Freeze/unfreeze
// (which also touches `snapshot`) is handled by the dedicated freeze route so
// this one never has to reason about resolving live FunnelData.
export async function PUT(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const config = await getPublicViewConfig(params.slug);
    if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const next = { ...config };

    if (body.widgets !== undefined) {
      if (!Array.isArray(body.widgets)) {
        return NextResponse.json({ error: "widgets must be an array" }, { status: 400 });
      }
      next.widgets = body.widgets as PublicViewWidget[];
    }
    if (body.theme !== undefined) {
      if (!["light", "dark", "estate"].includes(body.theme)) {
        return NextResponse.json({ error: "theme must be light, dark, or estate" }, { status: 400 });
      }
      next.theme = body.theme as PublicViewTheme;
    }
    if (body.published !== undefined) {
      next.published = Boolean(body.published);
    }
    if (body.propertyLabel !== undefined) {
      if (typeof body.propertyLabel !== "string" || !body.propertyLabel.trim()) {
        return NextResponse.json({ error: "propertyLabel cannot be empty" }, { status: 400 });
      }
      next.propertyLabel = body.propertyLabel.trim();
    }

    next.updatedAt = new Date().toISOString();
    await savePublicViewConfig(next);
    return NextResponse.json({ config: next });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update Public View" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    await deletePublicView(params.slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete Public View" }, { status: 500 });
  }
}
