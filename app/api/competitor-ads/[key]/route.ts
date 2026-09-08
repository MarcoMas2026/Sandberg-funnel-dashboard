import { NextRequest, NextResponse } from "next/server";
import { getCompetitorAdDetail } from "@/lib/competitor-ads/db";
import { estimateAdMetrics, AdMetricEstimate } from "@/lib/competitor-ads/benchmark";
import type { CompetitorAdDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export interface CompetitorAdWithEstimate extends CompetitorAdDetail {
  estimate: AdMetricEstimate;
}

// Every currently-active ad for one competitor (lib/competitor-ads/db.ts),
// each paired with an estimated-performance benchmark (lib/competitor-ads/
// benchmark.ts) computed from our own campaigns' reach-to-metric ratios.
// The estimate is always a separate `estimate` object — never merged into
// the ad's real fields — so the page can never accidentally render it with
// the same weight as Meta's real eu_total_reach.
export async function GET(request: NextRequest, { params }: { params: { key: string } }) {
  try {
    const detail = await getCompetitorAdDetail(params.key);
    if (!detail.connected) {
      return NextResponse.json({ connected: false, competitor_label: null, ads: [], error: detail.error }, { status: 200 });
    }
    const ads: CompetitorAdWithEstimate[] = await Promise.all(
      detail.ads.map(async (ad) => ({
        ...ad,
        estimate: await estimateAdMetrics(ad.eu_total_reach, ad.days_running),
      }))
    );
    return NextResponse.json({ connected: true, competitor_label: detail.competitor_label, ads, error: detail.error });
  } catch (error) {
    return NextResponse.json(
      { connected: false, competitor_label: null, ads: [], error: "Failed to load competitor ad detail" },
      { status: 500 }
    );
  }
}
