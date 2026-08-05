-- Accurate per-campaign, per-calendar-month totals — backing the one-off June/July
-- backfill (and any future backfills) for Mission Control's month picker.
--
-- Unlike funnel_daily_history (003), rows here come from Meta's own monthly
-- aggregate (insights.time_range(...).time_increment('monthly')), NOT summed
-- from daily rows — matching CLAUDE.md's rule that Meta totals must come from
-- an aggregate call, never a sum of daily rows (~5% under-report). leads is
-- Typeform-attributed (same hidden-field rule as the live Typeform Sync
-- workflow), not Meta's lead pixel. leads_source records whether that
-- attribution was possible: 'typeform_verified' (a known, resolved form) or
-- 'unavailable' (spend existed but no verified form mapping — never guessed).
--
-- /api/history/monthly reads this table first for a given month; falls back
-- to summing funnel_daily_history only when no row exists here yet.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists funnel_monthly_totals (
  campaign_id    text not null,
  year           integer not null,
  month          integer not null,          -- 1-12
  campaign_name  text,
  property       text,
  ref            text,
  campaign_type  text,                       -- 'property' | 'community'
  status         text,                       -- Meta status as of the backfill/sync run
  spend          numeric not null default 0, -- Meta monthly aggregate, not daily-summed
  leads          integer,                    -- null when leads_source = 'unavailable'
  leads_source   text not null default 'unavailable',  -- 'typeform_verified' | 'unavailable'
  cpl            numeric,
  impressions    integer default 0,
  clicks         integer default 0,
  link_clicks    integer default 0,
  ctr            numeric,
  synced_at      timestamptz default now(),
  primary key (campaign_id, year, month)
);

create index if not exists funnel_monthly_totals_ym_idx on funnel_monthly_totals (year, month);
