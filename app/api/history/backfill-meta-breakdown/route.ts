import { NextRequest, NextResponse } from "next/server";
import { isHistoryConfigured, platformDeviceRowsFromBreakdown, upsertPlatformDeviceSnapshots } from "@/lib/history/db";
import { MetaBreakdownRow } from "@/lib/types";
import { requireCrmToken } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST /api/history/backfill-meta-breakdown
// One-off recovery endpoint for campaigns already archived before
// db/migrations/007_campaign_detail_snapshots.sql existed. This app has no
// ads_read credential, so the actual Meta Graph API call happens in a
// temporary n8n workflow (reusing the "Facebook Graph account 2" credential
// already wired into the live Meta Sync workflow) which POSTs its result
// here to land in Supabase. Not used by the live pipeline — see
// app/api/history/sync/route.ts for that.
export async function POST(req: NextRequest) {
  const authError = requireCrmToken(req);
  if (authError) return authError;
  if (!isHistoryConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 200 });
  }
  try {
    const body = await req.json();
    const campaignId: string = body.campaign_id;
    const year: number = body.year;
    const month: number = body.month;
    const byPlatform: MetaBreakdownRow[] = body.by_platform ?? [];
    const byDevice: MetaBreakdownRow[] = body.by_device ?? [];
    if (!campaignId || !year || !month) {
      return NextResponse.json({ ok: false, error: "Missing campaign_id/year/month" }, { status: 400 });
    }
    const rows = platformDeviceRowsFromBreakdown(campaignId, year, month, byPlatform, byDevice);
    const result = await upsertPlatformDeviceSnapshots(rows);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to backfill meta breakdown" }, { status: 500 });
  }
}
