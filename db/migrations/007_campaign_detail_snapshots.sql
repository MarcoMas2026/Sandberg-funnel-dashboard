-- Durable snapshots of the campaign detail that used to only ever exist in the
-- live KV funnel:merged blob (platform/device split, Typeform field drop-off,
-- individual lead answers, landing-page engagement) — none of it survived a
-- campaign rotating out of lib/config.ts, since KV is a cache overwritten on
-- every sync and funnel_monthly_totals (004/005) only ever captured the
-- numeric aggregate. Written continuously by /api/history/sync while a
-- campaign is live (see that route), same "upsert on every load" pattern as
-- funnel_daily_history/funnel_monthly_totals, so the NEXT campaign to rotate
-- out already has this preserved — no recovery step needed going forward.
--
-- The five campaigns already archived before this migration existed were
-- backfilled once, out-of-band: Typeform data via lib/typeform.ts (the forms
-- still exist, still queryable), Meta platform/device via a one-off n8n
-- workflow (this app has no ads_read credential), landing engagement via a
-- direct read of the landing:funnel KV key (which is keyed by property ref,
-- not by the active roster, so old entries were still sitting in it). See
-- CLAUDE.md/CONTEXT.md for the full story, including the one campaign
-- (ref 32444, archived "Apartment Bahía") whose landing engagement could NOT
-- be recovered — it shares a KV slug with the live "Apartment Bahía (V)"
-- relaunch with no way to split the two after the fact.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists funnel_platform_device_snapshots (
  campaign_id  text not null,
  year         integer not null,
  month        integer not null,          -- 1-12, month this snapshot was captured in
  dimension    text not null,             -- 'platform' | 'device'
  key          text not null,             -- e.g. 'instagram' | 'mobile_app'
  spend        numeric not null default 0,
  impressions  integer default 0,
  clicks       integer default 0,
  link_clicks  integer default 0,
  ctr          numeric,
  outbound_ctr numeric,
  synced_at    timestamptz default now(),
  primary key (campaign_id, year, month, dimension, key)
);

create table if not exists funnel_typeform_field_snapshots (
  campaign_id   text not null,
  year          integer not null,
  month         integer not null,
  field_index   integer not null,          -- position in the form, 0-based
  label         text not null,
  views         integer not null default 0,
  dropoffs      integer not null default 0,
  dropoff_rate  numeric,
  synced_at     timestamptz default now(),
  primary key (campaign_id, year, month, field_index)
);

-- Individual Typeform responses — durable regardless of campaign status.
-- Deliberately has no `tag` column: manual lead-quality tags already live in
-- KV leads:tags, keyed globally by response_id (never scoped to the active
-- roster per lib/kv.ts), so they already survive archival on their own and
-- get joined in at read time instead of being duplicated here.
create table if not exists funnel_lead_responses (
  response_id     text primary key,
  campaign_id     text not null,
  submitted_at    timestamptz,
  first_name      text,
  last_name       text,
  language        text,
  budget          text,
  stage           text,
  buying_timeline text,
  synced_at       timestamptz default now()
);

create index if not exists funnel_lead_responses_campaign_idx on funnel_lead_responses (campaign_id);

create table if not exists funnel_landing_engagement_snapshots (
  campaign_id     text not null,
  year            integer not null,
  month           integer not null,
  page_views      integer not null default 0,
  cta_clicks      integer not null default 0,
  cta_click_rate  numeric,
  steps           jsonb,                   -- LandingEngagement['steps']
  events          jsonb,                   -- LandingEngagement['events']
  synced_at       timestamptz default now(),
  primary key (campaign_id, year, month)
);
