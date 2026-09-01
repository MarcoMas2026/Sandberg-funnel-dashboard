import { NextRequest, NextResponse } from "next/server";
import {
  isHistoryConfigured,
  getPlatformDeviceSnapshot,
  getTypeformFieldSnapshot,
  getLeadResponsesForCampaign,
  getLandingEngagementSnapshot,
} from "@/lib/history/db";
import { getLeadTags } from "@/lib/kv";

export const dynamic = "force-dynamic";

// GET /api/history/campaign-detail-snapshot?campaignId=...&year=YYYY&month=M
// Full campaign detail (platform/device split, Typeform field drop-off,
// individual lead answers, landing engagement) sourced uniformly from the
// Supabase snapshot tables (db/migrations/007) — works identically for a
// currently-live campaign (populated by app/api/history/sync's forward
// capture) and a campaign long since dropped from lib/config.ts (populated
// by the one-off recovery, see CONTEXT.md). No more live/archived branching
// for this data. Manual lead-quality tags are joined in from KV leads:tags
// (never scoped to the active roster, so they already survive archival on
// their own — see lib/kv.ts).
// `year`/`month` are optional (1-indexed month, matching the report page's
// convention) — when given, platform/device, Typeform fields and landing
// engagement are read for that specific month instead of the campaign's
// latest known row, so a closed past month can show its own real detail
// rather than a later month's numbers. Lead responses are unaffected (always
// the full raw set — the caller filters by submitted_at itself).
export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ connected: false, error: "Missing campaignId" }, { status: 400 });
  }
  if (!isHistoryConfigured()) {
    return NextResponse.json({ connected: false });
  }
  const yearParam = req.nextUrl.searchParams.get("year");
  const monthParam = req.nextUrl.searchParams.get("month");
  const ym = yearParam && monthParam ? { year: Number(yearParam), month: Number(monthParam) } : undefined;
  try {
    const [platformDevice, typeformFields, leadResponses, landingEngagement, tags] = await Promise.all([
      getPlatformDeviceSnapshot(campaignId, ym),
      getTypeformFieldSnapshot(campaignId, ym),
      getLeadResponsesForCampaign(campaignId),
      getLandingEngagementSnapshot(campaignId, ym),
      getLeadTags(),
    ]);
    const leads = leadResponses.map((l) => ({ ...l, tag: tags[l.response_id] ?? null }));
    return NextResponse.json({ connected: true, platformDevice, typeformFields, leads, landingEngagement });
  } catch (error) {
    return NextResponse.json({ connected: false, error: "Failed to read campaign detail" }, { status: 500 });
  }
}
