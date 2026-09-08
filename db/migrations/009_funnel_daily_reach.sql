-- Adds `reach` to funnel_daily_history — needed for the Competitor Ads
-- benchmark model (lib/competitor-ads/benchmark.ts), which estimates a
-- competitor ad's likely spend/impressions/leads by interpolating against
-- our own campaigns' reach-to-metric ratios at a similar daily reach.
-- meta.daily[].reach (Meta Sync workflow, updated 2026-09-08) is the source;
-- historical rows are backfilled separately via the Marketing API's 90-day
-- lookback, same as any other daily metric.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

alter table funnel_daily_history add column if not exists reach integer default 0;
