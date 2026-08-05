import { NextResponse } from "next/server";
import { getFunnelData } from "@/lib/kv";
import { isHistoryConfigured, rowsFromCampaigns, upsertDailySnapshots } from "@/lib/history/db";

export const dynamic = "force-dynamic";

// Called opportunistically from Mission Control on every load — flattens the
// live funnel data's meta.daily[] rows (all campaigns, any status) into
// funnel_daily_history. Upsert-only and idempotent, so calling it often is
// harmless; this is what makes "from now on" data accumulate without a
// dedicated cron/n8n workflow.
export async function POST() {
  if (!isHistoryConfigured()) {
    return NextResponse.json({ ok: false, written: 0, error: "Supabase not configured" }, { status: 200 });
  }
  try {
    const data = await getFunnelData();
    const rows = rowsFromCampaigns(data.campaigns);
    const result = await upsertDailySnapshots(rows);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, written: 0, error: "Failed to sync history" }, { status: 500 });
  }
}
