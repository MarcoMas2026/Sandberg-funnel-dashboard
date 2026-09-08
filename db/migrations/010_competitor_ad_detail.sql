-- Extends competitor_ad_snapshots for the per-competitor detail view: every
-- creative variant (an "ad" from the Ads Library is often a rotating set of
-- several distinct property listings under one ad_archive_id — confirmed
-- 2026-09-08, one Engel & Völkers ad bundled 6 different properties), plus
-- Meta's real EU transparency (DSA) fields where the ad reached an EU country.
--
-- The existing singular ad_creative_body/ad_creative_link_title columns are
-- left as-is (first variant, used by the compact summary feed); these new
-- columns hold the full set, used only by the per-competitor detail page.
--
-- eu_total_reach/age_gender_breakdown/target_* are Meta's own real numbers
-- (Digital Services Act transparency), not present for ads that never reach
-- an EU country — null in that case, never backfilled or estimated.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

alter table competitor_ad_snapshots add column if not exists ad_creative_bodies text[];
alter table competitor_ad_snapshots add column if not exists ad_creative_link_titles text[];
alter table competitor_ad_snapshots add column if not exists ad_creative_link_descriptions text[];
alter table competitor_ad_snapshots add column if not exists eu_total_reach integer;
alter table competitor_ad_snapshots add column if not exists age_gender_breakdown jsonb;
alter table competitor_ad_snapshots add column if not exists target_ages text[];
alter table competitor_ad_snapshots add column if not exists target_gender text;
alter table competitor_ad_snapshots add column if not exists target_locations jsonb;
