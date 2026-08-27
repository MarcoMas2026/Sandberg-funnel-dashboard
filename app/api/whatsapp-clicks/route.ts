import { NextResponse } from "next/server";
import { getWhatsAppClickStats } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agents = await getWhatsAppClickStats();
    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json({ agents: [], error: "failed to load" }, { status: 500 });
  }
}
