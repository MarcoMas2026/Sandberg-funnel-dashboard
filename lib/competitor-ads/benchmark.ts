import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Estimates a competitor ad's likely spend/impressions/clicks/leads by
// interpolating against OUR OWN campaigns' real reach-to-metric ratios at a
// similar daily reach. This is a benchmark/proxy, never Meta's real data —
// every value this module returns must be labeled "Estimated" wherever shown
// and never rendered with the same visual weight as real numbers (e.g.
// eu_total_reach from lib/competitor-ads/db.ts). See the 2026-09-08
// conversation in CONTEXT.md for the full methodology discussion.
//
// Reuses the funnel pipeline's Supabase project/table (funnel_daily_history,
// db/migrations/009_funnel_daily_reach.sql) but through its own client, same
// decoupling pattern as lib/competitor-ads/db.ts — this module never touches
// lib/kv.ts or lib/history/db.ts directly.
let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    client = null;
    return client;
  }
  client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}

interface BenchmarkDay {
  reach: number;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}

export type EstimateConfidence = "high" | "medium" | "low" | "none";

export interface AdMetricEstimate {
  confidence: EstimateConfidence;
  daily_reach: number;
  days_running: number;
  sample_size: number;
  estimated_spend: number | null;
  estimated_impressions: number | null;
  estimated_clicks: number | null;
  estimated_leads: number | null;
  estimated_cpm: number | null;
  note: string;
}

const NEUTRAL_ESTIMATE = (dailyReach: number, daysRunning: number, note: string): AdMetricEstimate => ({
  confidence: "none",
  daily_reach: dailyReach,
  days_running: daysRunning,
  sample_size: 0,
  estimated_spend: null,
  estimated_impressions: null,
  estimated_clicks: null,
  estimated_leads: null,
  estimated_cpm: null,
  note,
});

// Cached per server invocation (this data changes at most a few times a day
// via the funnel sync) — avoids re-fetching all history for every ad on a
// competitor detail page with hundreds of ads.
let benchmarkCache: { days: BenchmarkDay[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadBenchmarkDays(): Promise<BenchmarkDay[]> {
  if (benchmarkCache && Date.now() - benchmarkCache.fetchedAt < CACHE_TTL_MS) return benchmarkCache.days;
  const supabase = getClient();
  if (!supabase) return [];

  const days: BenchmarkDay[] = [];
  let from = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("funnel_daily_history")
      .select("reach, spend, impressions, clicks, leads")
      .gt("reach", 0)
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    for (const r of data) {
      days.push({
        reach: Number(r.reach ?? 0),
        spend: Number(r.spend ?? 0),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        leads: Number(r.leads ?? 0),
      });
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  benchmarkCache = { days, fetchedAt: Date.now() };
  return days;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Widens the reach tolerance band until it finds at least MIN_SAMPLE
// comparable days, capped at MAX_TOLERANCE so a wildly out-of-range reach
// (e.g. a competitor's daily reach 50x anything we've ever run) doesn't get a
// low-quality estimate stretched to fit — it gets "none" instead.
const MIN_SAMPLE = 3;
const TOLERANCE_STEPS = [0.15, 0.3, 0.5, 0.75, 1.0];

function findComparableDays(days: BenchmarkDay[], targetReach: number): { sample: BenchmarkDay[]; tolerance: number } {
  for (const tolerance of TOLERANCE_STEPS) {
    const sample = days.filter((d) => Math.abs(d.reach - targetReach) / targetReach <= tolerance);
    if (sample.length >= MIN_SAMPLE) return { sample, tolerance };
  }
  return { sample: [], tolerance: TOLERANCE_STEPS[TOLERANCE_STEPS.length - 1] };
}

function confidenceFor(tolerance: number, sampleSize: number): EstimateConfidence {
  if (sampleSize < MIN_SAMPLE) return "none";
  if (tolerance <= 0.15 && sampleSize >= 5) return "high";
  if (tolerance <= 0.3) return "medium";
  return "low";
}

// Cumulative reach does NOT grow linearly with days running — after the first
// few days a campaign mostly re-shows the same audience (frequency), so
// "total reach ÷ days" badly understates the campaign's actual daily reach
// the longer it runs. Fitted 2026-09-08 via log-log regression on 46 of our
// own campaigns (effective_days = lifetime reach ÷ real average daily reach,
// vs. days_running): effective_days ≈ 1.0967 · N^0.7901, R²=0.90. Dividing by
// this instead of N directly is what "daily reach" means below.
//
// Validated blind against 2 held-out Sandberg Estates ads (excluded from the
// fit) matched to our own real campaign data: naive division was 16-18%
// accurate on spend/impressions/clicks; this curve alone improved that to
// 26-47%.
const SATURATION_A = 1.0967;
const SATURATION_B = 0.7901;
function effectiveReachDays(daysRunning: number): number {
  return SATURATION_A * Math.pow(daysRunning, SATURATION_B);
}

// eu_total_reach (Meta's DSA disclosure) undercounts vs. our own campaigns'
// true total reach, because it excludes non-EU countries our targeting also
// reaches — and the gap WIDENS with days_running (EU's smaller population
// saturates faster relative to our wider targeted geography). Fitted
// 2026-09-08 via log-log regression on 3 campaigns matched to real Ads
// Library ads BY EXACT DATE-WINDOW (days_running matched to the day),
// deliberately excluding the 2 held-out validation ads to avoid calibrating
// on the same cases being tested: ratio(N) = internal_reach / eu_total_reach
// at N=9 → 1.90x, N=20 → 2.84x, N=22 → 3.15x. Only 3 points — wide
// uncertainty, revisit as more matched pairs accumulate.
//
// Applying this on top of the saturation curve above, re-validated blind on
// the same 2 held-out ads: accuracy rose from 26-47% to 66.6-90.0% (Sa Vinya)
// and 28-36% to 85.0-114.4% (Olinto) on spend/impressions/clicks. Still not
// exact — 3-point calibration, EU-scale ratio is inherently noisy — but a
// large, real improvement over leaving the gap uncorrected.
const EU_SCALE_P = 0.5768;
const EU_SCALE_Q = 0.5413;
function euReachScaleFactor(daysRunning: number): number {
  return EU_SCALE_P * Math.pow(daysRunning, EU_SCALE_Q);
}

// `euTotalReach` is the ad's real cumulative reach (Meta's own number,
// EU-transparency only); `daysRunning` normalizes it to a daily figure before
// interpolating, since our own benchmark days are daily too, via the
// saturation curve above (not naive division). Total estimates are then
// scaled back up by daysRunning. Returns confidence "none" (no numbers
// shown) when the reach falls outside anything we've actually run, rather
// than extrapolating past what our own data supports.
export async function estimateAdMetrics(euTotalReach: number | null, daysRunning: number): Promise<AdMetricEstimate> {
  if (!euTotalReach || euTotalReach <= 0) {
    return NEUTRAL_ESTIMATE(0, daysRunning, "No real reach figure available for this ad (likely doesn't reach an EU country) — nothing to benchmark against.");
  }
  const effectiveDays = Math.max(1, daysRunning);
  const correctedReach = euTotalReach * euReachScaleFactor(effectiveDays);
  const dailyReach = correctedReach / effectiveReachDays(effectiveDays);

  const days = await loadBenchmarkDays();
  if (days.length < MIN_SAMPLE) {
    return NEUTRAL_ESTIMATE(dailyReach, daysRunning, "Not enough of your own campaign history with reach data yet to benchmark against.");
  }

  const { sample, tolerance } = findComparableDays(days, dailyReach);
  if (sample.length < MIN_SAMPLE) {
    return NEUTRAL_ESTIMATE(
      dailyReach,
      daysRunning,
      `This ad's daily reach (${Math.round(dailyReach).toLocaleString()}) is outside the range your own campaigns have run at — no reliable benchmark.`
    );
  }

  const costPerReach = median(sample.map((d) => d.spend / d.reach));
  const impressionsPerReach = median(sample.map((d) => d.impressions / d.reach));
  const clicksPerReach = median(sample.map((d) => d.clicks / d.reach));
  const leadsPerReach = median(sample.filter((d) => d.leads > 0).map((d) => d.leads / d.reach));

  const dailySpend = costPerReach * dailyReach;
  const dailyImpressions = impressionsPerReach * dailyReach;
  const dailyClicks = clicksPerReach * dailyReach;
  const dailyLeads = Number.isFinite(leadsPerReach) ? leadsPerReach * dailyReach : 0;

  const totalSpend = dailySpend * effectiveDays;
  const totalImpressions = dailyImpressions * effectiveDays;
  const totalClicks = dailyClicks * effectiveDays;
  const totalLeads = dailyLeads * effectiveDays;

  const confidence = confidenceFor(tolerance, sample.length);

  return {
    confidence,
    daily_reach: dailyReach,
    days_running: daysRunning,
    sample_size: sample.length,
    estimated_spend: totalSpend,
    estimated_impressions: Math.round(totalImpressions),
    estimated_clicks: Math.round(totalClicks),
    estimated_leads: Number.isFinite(totalLeads) ? Math.round(totalLeads) : null,
    estimated_cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
    note: `Benchmarked against ${sample.length} of your own campaign-days within ${Math.round(
      tolerance * 100
    )}% of this ad's daily reach, after correcting for reach saturation and the EU-vs-total reach gap. Validated to 67-114% accuracy on held-out tests — still an approximation, not exact.`,
  };
}
