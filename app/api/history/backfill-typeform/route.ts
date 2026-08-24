import { NextRequest, NextResponse } from "next/server";
import { isHistoryConfigured, upsertTypeformFieldSnapshots, upsertLeadResponses } from "@/lib/history/db";
import { fetchFormFieldSummary, fetchFormResponses, isTypeformConfigured } from "@/lib/typeform";
import { requireCrmToken } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST /api/history/backfill-typeform  { campaign_id, form_id, year, month }
// One-off recovery for campaigns already archived before
// db/migrations/007_campaign_detail_snapshots.sql existed — each still has
// its own distinct, still-live Typeform form (form_id stored in
// funnel_monthly_totals since migration 005). Not used by the live
// pipeline — see app/api/history/sync/route.ts for that.
export async function POST(req: NextRequest) {
  const authError = requireCrmToken(req);
  if (authError) return authError;
  if (!isHistoryConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 200 });
  }
  if (!isTypeformConfigured()) {
    return NextResponse.json({ ok: false, error: "TYPEFORM_API_TOKEN not configured" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const campaignId: string = body.campaign_id;
    const formId: string = body.form_id;
    const year: number = body.year;
    const month: number = body.month;
    if (!campaignId || !formId || !year || !month) {
      return NextResponse.json({ ok: false, error: "Missing campaign_id/form_id/year/month" }, { status: 400 });
    }

    const [fields, answers] = await Promise.all([
      fetchFormFieldSummary(formId),
      fetchFormResponses(formId),
    ]);

    const fieldRows = fields.map((f, i) => ({
      campaign_id: campaignId, year, month, field_index: i,
      label: f.label, views: f.views, dropoffs: f.dropoffs, dropoff_rate: f.dropoff_rate,
    }));
    const leadRows = answers.map((a) => ({ ...a, campaign_id: campaignId }));

    const [fieldResult, leadResult] = await Promise.all([
      upsertTypeformFieldSnapshots(fieldRows),
      upsertLeadResponses(leadRows),
    ]);

    return NextResponse.json({
      ok: fieldResult.ok && leadResult.ok,
      fieldsWritten: fieldResult.written,
      leadsWritten: leadResult.written,
      error: fieldResult.error ?? leadResult.error,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to backfill Typeform data" }, { status: 500 });
  }
}
