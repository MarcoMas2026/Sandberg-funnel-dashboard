import { CampaignType, HistoricalCampaign } from "./types";

// A past campaign only counts as a fair comparison if it spent enough for its
// conversion numbers to be meaningful — a campaign that spent €30 and got 1
// lucky lead isn't a "top performer," it just didn't run long enough to say
// anything. €250 was picked as roughly the lower-middle of real campaign spend.
export const MIN_HISTORICAL_SPEND = 250;

export interface RankedCampaign extends HistoricalCampaign {
  score: number; // 0..1, composite of lead volume + cost efficiency
}

// Ranks past campaigns of the same type as `excludeCampaignId` (never compare
// a campaign against itself) that meet the spend floor, by a 50/50 blend of:
//   - lead volume (more leads is better)
//   - cost per lead (lower is better)
// normalized within the eligible pool, so a campaign that spent almost nothing
// and got one cheap lead can't outrank one that generated real volume
// efficiently. Returns the top `limit`, best first.
export function rankHistoricalCampaigns(
  pool: HistoricalCampaign[],
  campaignType: CampaignType,
  excludeCampaignId: string,
  limit = 3
): RankedCampaign[] {
  const eligible = pool.filter(
    (c) =>
      c.campaign_type === campaignType &&
      c.campaign_id !== excludeCampaignId &&
      c.spend >= MIN_HISTORICAL_SPEND
  );

  if (eligible.length === 0) return [];

  const leadsValues = eligible.map((c) => c.leads);
  const cplValues = eligible.map((c) => c.cpl);
  const leadsMin = Math.min(...leadsValues);
  const leadsMax = Math.max(...leadsValues);
  const cplMin = Math.min(...cplValues);
  const cplMax = Math.max(...cplValues);

  const norm = (v: number, min: number, max: number) => (max > min ? (v - min) / (max - min) : 1);

  const scored: RankedCampaign[] = eligible.map((c) => {
    const leadsScore = norm(c.leads, leadsMin, leadsMax);
    const cplScore = 1 - norm(c.cpl, cplMin, cplMax); // lower cpl is better
    return { ...c, score: 0.5 * leadsScore + 0.5 * cplScore };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
