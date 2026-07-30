import { NextResponse } from "next/server";
import { getDemographicsData } from "@/lib/social/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDemographicsData();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { connected: false, error: message, snapshotDate: null, followers: [], engaged: [], meetsMinimumFollowers: false },
      { status: 500 }
    );
  }
}
