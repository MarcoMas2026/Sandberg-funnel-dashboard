-- CRM lead-outcome events — the inbound half of the two-way CRM data exchange
-- (see CONTEXT.md's "two-way data exchange with the CRM" section; outbound
-- half is GET /api/funnel-export). Pulled incrementally by a dedicated n8n
-- workflow (n8n/crm-integration.md) from the CRM's
-- GET /api/intelligence/lead-outcomes?since=<ISO> endpoint and upserted here
-- directly (Postgres/Supabase node, same pattern as the Instagram module's
-- workflows) — no app API route in the write path.
--
-- response_id is the Typeform response token, identical to
-- LeadRecord.response_id in leads:all (Upstash KV) — verified against real
-- data 2026-08-11 (25 sampled responses, 391/391 CRM attribution records).
-- Joining crm_lead_outcomes.response_id to a campaign therefore goes through
-- leads:all / /api/leads, not a column on this table — no campaign_id here.
--
-- NO PERSONAL DATA: only response_id (an opaque token), event name, and a
-- timestamp. Never add a name/email/phone/Salesforce-record-id column.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists crm_lead_outcomes (
  response_id  text not null,
  event        text not null,          -- one of lib/crm/events.ts's CRM_EVENT_NAMES
  occurred_at  timestamptz not null,
  ingested_at  timestamptz default now(),
  primary key (response_id, event)
);

create index if not exists crm_lead_outcomes_event_idx on crm_lead_outcomes (event);
create index if not exists crm_lead_outcomes_occurred_at_idx on crm_lead_outcomes (occurred_at);

-- Tracks incremental-pull cursor state for the n8n workflow, and — separately —
-- which of the 15 event types have ever actually been observed arriving from
-- the CRM. live_as_of is seeded `now()` for the 7 types the CRM confirmed were
-- already emitting on 2026-08-11 (matching lib/crm/events.ts's liveAsOfSeed);
-- the other 8 stay NULL until the workflow's first real sighting of that type
-- stamps it. This is the mechanism behind distinguishing "zero of this event
-- so far" (live_as_of set, zero rows) from "the CRM hasn't wired this one up
-- yet" (live_as_of still null) — see CONTEXT.md's warning against inferring
-- coverage from silence.
create table if not exists crm_event_types (
  event         text primary key,
  track         text not null,          -- 'buyer' | 'seller' | 'property' | 'reserved'
  live_as_of    timestamptz,
  last_seen_at  timestamptz
);

insert into crm_event_types (event, track, live_as_of) values
  ('LeadCreated', 'buyer', now()),
  ('QualifiedBuyerLead', 'buyer', now()),
  ('ViewingBooked', 'buyer', now()),
  ('ViewingCompleted', 'buyer', now()),
  ('OfferStarted', 'buyer', now()),
  ('OfferAccepted', 'buyer', null),
  ('ReservationSigned', 'buyer', null),
  ('DealClosed', 'buyer', null),
  ('QualifiedSellerLead', 'seller', null),
  ('ValuationBooked', 'seller', null),
  ('PriceAgreementReached', 'seller', null),
  ('ListingAgreementSigned', 'seller', null),
  ('ListingActivated', 'property', now()),
  ('ListingSold', 'property', now()),
  ('QualifiedLead', 'reserved', null)
on conflict (event) do nothing;

-- Single row, id fixed to 'lead_outcomes' — last_success_cursor is the `since`
-- value to pass on the NEXT pull (the newest occurred_at/ingested_at observed
-- on the last successful run, not simply "now", so a slow CRM write doesn't
-- get skipped by a cursor that already moved past it).
create table if not exists crm_sync_state (
  id                    text primary key default 'lead_outcomes',
  last_success_at       timestamptz,
  last_success_cursor   timestamptz,
  last_attempt_at       timestamptz,
  last_status           text,           -- 'ok' | 'failed' | 'never_run'
  last_error            text,
  rows_last_pull        integer
);

insert into crm_sync_state (id, last_status) values ('lead_outcomes', 'never_run')
on conflict (id) do nothing;
