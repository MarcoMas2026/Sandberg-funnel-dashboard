import { NextResponse } from "next/server";
import { getFunnelData, getLeads } from "@/lib/kv";
import { todayISOMadrid } from "@/lib/format";
import {
  isHistoryConfigured,
  rowsFromCampaigns,
  upsertDailySnapshots,
  monthlyTotalsFromCampaigns,
  upsertMonthlyTotals,
  platformDeviceRowsFromCampaigns,
  upsertPlatformDeviceSnapshots,
  typeformFieldRowsFromCampaigns,
  upsertTypeformFieldSnapshots,
  landingEngagementRowsFromCampaigns,
  upsertLandingEngagementSnapshots,
  leadResponseRowsFromLeads,
  upsertLeadResponses,
} from "@/lib/history/db";

export const dynamic = "force-dynamic";

// Called opportunistically from Mission Control on every load — flattens the
// live funnel data's meta.daily[] rows (all campaigns, any status) into
// funnel_daily_history, AND upserts the current month's funnel_monthly_totals
// row per campaign straight from that same live snapshot. Upsert-only and
// idempotent, so calling it often is harmless; this is what makes "from now
// on" data accumulate without a dedicated cron/n8n workflow.
//
// The monthly-totals half exists so a campaign's row (spend, Typeform starts/
// completions, etc.) is captured continuously WHILE it's still live, instead
// of depending on a manual one-off backfill after the fact once it's dropped
// from lib/config.ts — that manual path is what produced S'OLIVERA's wrong
// "starts" value (see lib/history/db.ts's monthlyTotalsFromCampaigns doc
// comment for the full story).
export async function POST() {
  if (!isHistoryConfigured()) {
    return NextResponse.json({ ok: false, written: 0, error: "Supabase not configured" }, { status: 200 });
  }
  try {
    const data = await getFunnelData();
    const dailyRows = rowsFromCampaigns(data.campaigns);
    const [year, month] = todayISOMadrid().split("-").map(Number);
    const monthlyRows = monthlyTotalsFromCampaigns(data.campaigns, year, month);
    const platformDeviceRows = platformDeviceRowsFromCampaigns(data.campaigns, year, month);
    const typeformFieldRows = typeformFieldRowsFromCampaigns(data.campaigns, year, month);
    const landingRows = landingEngagementRowsFromCampaigns(data.campaigns, year, month);
    const leads = await getLeads();
    const leadRows = leadResponseRowsFromLeads(leads);
    const [dailyResult, monthlyResult, platformDeviceResult, typeformFieldResult, landingResult, leadResult] = await Promise.all([
      upsertDailySnapshots(dailyRows),
      upsertMonthlyTotals(monthlyRows),
      upsertPlatformDeviceSnapshots(platformDeviceRows),
      upsertTypeformFieldSnapshots(typeformFieldRows),
      upsertLandingEngagementSnapshots(landingRows),
      upsertLeadResponses(leadRows),
    ]);
    return NextResponse.json({
      ok: dailyResult.ok && monthlyResult.ok && platformDeviceResult.ok && typeformFieldResult.ok && landingResult.ok && leadResult.ok,
      written: dailyResult.written,
      monthlyWritten: monthlyResult.written,
      error: dailyResult.error ?? monthlyResult.error ?? platformDeviceResult.error ?? typeformFieldResult.error ?? landingResult.error ?? leadResult.error,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, written: 0, error: "Failed to sync history" }, { status: 500 });
  }
}
