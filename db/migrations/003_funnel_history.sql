-- Funnel daily history snapshots — enables month-over-month comparisons on
-- Mission Control's KPI cards (Total Spend / Leads / Avg Cost per Lead by
-- calendar month). Separate concern from the Instagram module's tables
-- (001/002) but shares the same Supabase project. Nothing in lib/kv.ts reads
-- or writes this table and nothing here touches Upstash KV — the funnel
-- pipeline (KV) stays the source of truth for *current* state; this table
-- just retains a point-in-time copy of each day's numbers going forward, so
-- month comparisons stay possible after Meta's own daily lookback window (and
-- after a campaign is edited out of lib/config.ts) would otherwise erase them.
-- See CLAUDE.md / CONTEXT.md §11 (Phase 1 - daily history snapshots).
--
-- Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists funnel_daily_history (
  campaign_id    text not null,
  date           date not null,
  campaign_name  text,
  property       text,
  ref            text,
  campaign_type  text,                 -- 'property' | 'community'
  status         text,                 -- ACTIVE | PAUSED | ARCHIVED, as of this snapshot
  spend          numeric not null default 0,
  leads          integer not null default 0,   -- Typeform submissions, same source as meta.daily[].leads
  cpl            numeric,
  impressions    integer default 0,
  clicks         integer default 0,
  link_clicks    integer default 0,
  ctr            numeric,
  synced_at      timestamptz default now(),
  primary key (campaign_id, date)
);

create index if not exists funnel_daily_history_date_idx on funnel_daily_history (date);
