-- Instagram Analytics module — initial schema (Supabase Postgres).
-- Fully separate from the funnel pipeline (Upstash KV) — nothing here is
-- read/written by lib/kv.ts. See CLAUDE.md and ~/Downloads/ANALYTICS_PLATFORM_ARCHITECTURE.md.
--
-- Run in the Supabase SQL editor (or `supabase db push`) against a fresh project.

create table if not exists ig_accounts (
  id                text primary key,            -- ig-user-id (text: exceeds JS's safe-integer range)
  username          text not null,
  connected_at      timestamptz default now(),
  access_token      text not null,               -- long-lived; refreshed by n8n W5
  token_expires_at  timestamptz
);

-- Daily profile snapshot -> Community section (this IS the followers-history feature;
-- there is no such endpoint on the Graph API, so we build it ourselves one row/day).
create table if not exists daily_account_snapshots (
  account_id    text references ig_accounts(id),
  date          date not null,
  followers     integer,
  following     integer,
  media_count   integer,
  primary key (account_id, date)
);

-- Daily account insights -> Account section. EAV on purpose: Meta renames/deprecates
-- metrics every couple of years (see doc §3.2 deprecation list) and this way a new
-- metric is a new row, not a migration.
create table if not exists daily_account_insights (
  account_id     text references ig_accounts(id),
  date           date not null,
  metric         text not null,                 -- 'reach','views','likes',...
  breakdown_key  text not null default '',       -- e.g. 'media_product_type:reel'
  value          bigint not null,
  primary key (account_id, date, metric, breakdown_key)
);

-- Content catalog: posts, reels, stories all live here (product_type distinguishes them).
create table if not exists media (
  id             text primary key,               -- media-id (or story-id)
  account_id     text references ig_accounts(id),
  product_type   text not null,                  -- FEED | REELS | STORY
  media_type     text,                            -- IMAGE | VIDEO | CAROUSEL_ALBUM
  caption        text,
  hashtags       text[],                          -- parsed from caption at ingest
  permalink      text,
  thumbnail_url  text,
  published_at   timestamptz not null,
  duration_s     numeric                          -- reels only, for retention %
);
create index if not exists media_account_published_idx on media (account_id, published_at desc);
create index if not exists media_product_type_idx on media (product_type);

-- Latest metric values per media item (upserted on every poll).
create table if not exists media_insights (
  media_id    text references media(id) on delete cascade,
  metric      text not null,                     -- 'reach','views','saved','navigation:tap_back',...
  value       bigint not null,
  fetched_at  timestamptz default now(),
  primary key (media_id, metric)
);

-- Weekly demographics snapshot -> Demographics section (+ history the API itself doesn't give you).
create table if not exists demographics_snapshots (
  account_id  text references ig_accounts(id),
  date        date not null,
  audience    text not null,                     -- 'followers' | 'engaged'
  breakdown   text not null,                      -- 'age' | 'gender' | 'country' | 'city'
  key         text not null,                      -- '25-34', 'F', 'ES', 'Madrid'
  value       bigint not null,
  primary key (account_id, date, audience, breakdown, key)
);

-- Daily competitor snapshot (business_discovery — public accounts only).
create table if not exists competitor_snapshots (
  username      text not null,
  date          date not null,
  followers     integer,
  media_count   integer,
  avg_likes     numeric,
  avg_comments  numeric,
  primary key (username, date)
);

-- Row Level Security: locked down by default. This app only ever talks to
-- Supabase with the service_role key from server-side code (API routes / n8n),
-- which bypasses RLS — so RLS here exists purely as a safety net against ever
-- shipping the anon key. No policies are added, i.e. anon/authenticated have
-- zero access to every table above.
alter table ig_accounts enable row level security;
alter table daily_account_snapshots enable row level security;
alter table daily_account_insights enable row level security;
alter table media enable row level security;
alter table media_insights enable row level security;
alter table demographics_snapshots enable row level security;
alter table competitor_snapshots enable row level security;
