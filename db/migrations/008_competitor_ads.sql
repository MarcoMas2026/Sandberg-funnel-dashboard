-- Competitor Ad Intelligence module — Meta Ads Library API snapshots.
-- Fully decoupled from the funnel pipeline (Upstash KV) and from the CRM/
-- Instagram Supabase tables: nothing here is read/written by lib/kv.ts,
-- lib/crm/db.ts, or lib/social/db.ts.
--
-- Pulled daily (not the 30-min funnel cadence — ad libraries change slowly)
-- by the "Funnel Dashboard - Ads Library Sync" n8n workflow
-- (n8n/competitor-ads-sync.md), which writes directly here via the Supabase
-- REST API (same pattern as the CRM pull and Instagram social workflows) —
-- no app API route in the write path.
--
-- One row per (ad, day observed) rather than a mutable "current state" row —
-- same convention as competitor_snapshots(username, date) in
-- 001_social_init.sql. This makes "new ad today", "ad dropped since
-- yesterday", and "running N days" trivial min/max/anti-join queries instead
-- of needing an update-trigger to preserve a first-seen date across upserts.
--
-- IMPORTANT: the Ads Library API only discloses spend/impression ranges for
-- political/social-issue ads. Real-estate ads aren't in that category, so
-- this table intentionally has no spend/impressions/reach columns — this is
-- creative + cadence + platform/language intel, not a spend benchmark.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists competitor_ad_snapshots (
  ad_archive_id          text not null,
  snapshot_date          date not null,
  competitor_key         text not null,   -- matches lib/config.ts's COMPETITOR_MAP[].key
  competitor_label       text not null,
  match_type             text not null,   -- 'page' | 'keyword'
  tier                   text not null,   -- 'local' | 'global'
  page_id                text,
  page_name              text,
  ad_creative_body       text,
  ad_creative_link_title text,
  ad_snapshot_url        text,
  publisher_platforms    text[],
  languages              text[],
  ad_delivery_start_time date,
  ad_delivery_stop_time  date,
  created_at             timestamptz default now(),
  primary key (ad_archive_id, snapshot_date)
);

create index if not exists idx_competitor_ad_snapshots_key_date
  on competitor_ad_snapshots (competitor_key, snapshot_date);

alter table competitor_ad_snapshots enable row level security;

-- Single row, id fixed to 'competitor_ads'. Every pull attempt (whole-run,
-- not per-competitor) writes here, success or failure, so a failed daily
-- pull is visibly a failure rather than silently read back as "no new ads".
create table if not exists competitor_ads_sync_state (
  id               text primary key default 'competitor_ads',
  last_success_at  timestamptz,
  last_attempt_at  timestamptz,
  last_status      text,   -- 'ok' | 'failed' | 'never_run'
  last_error       text,
  rows_last_pull   integer
);

insert into competitor_ads_sync_state (id, last_status) values ('competitor_ads', 'never_run')
on conflict (id) do nothing;

alter table competitor_ads_sync_state enable row level security;
