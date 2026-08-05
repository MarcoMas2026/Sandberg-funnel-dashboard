-- Extends funnel_monthly_totals (004) with the fields needed to plug a past
-- month into the SAME campaign detail page (CampaignInfoBar, MetricsPanel,
-- IsometricFunnel, SummaryPanel) that live campaigns use — not a separate
-- lighter view. engagement/outbound_clicks are Meta numbers (same accuracy
-- rules as spend/leads elsewhere in this table); starts/form_id/form_name
-- are Typeform-sourced, only ever populated alongside a typeform_verified
-- leads_source. start_date/stop_date are Meta's own campaign-level fields
-- (not per-month, but cheap to capture in the same backfill call).
--
-- Run in the Supabase SQL editor.

alter table funnel_monthly_totals
  add column if not exists engagement numeric,
  add column if not exists outbound_clicks integer,
  add column if not exists starts integer,
  add column if not exists form_id text,
  add column if not exists form_name text,
  add column if not exists start_date date,
  add column if not exists stop_date date;
