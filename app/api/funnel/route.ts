import { NextResponse } from "next/server";
import { getFunnelData } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getFunnelData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { campaigns: [], last_updated: null, status: "error" },
      { status: 500 }
    );
  }
}
