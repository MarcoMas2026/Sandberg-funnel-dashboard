# Instagram Analytics — n8n workflow specs

**Deployed and active** on `n8n.srv980538.hstgr.cloud` as of 2026-07-30:

| Workflow | n8n ID | Status |
|---|---|---|
| `social-daily-account-etl` (W1) | `uGx1GBRRtyUuaHa3` | active |
| `social-media-sync` (W2) | `cSxreab0V0KE1v67` | active |
| `social-story-poller` (W3) | `a9BEmnwy4bhTfXSP` | active |
| `social-demographics-snapshot` (W4) | `FOqw5JB4o606Yvte` | active |
| `social-token-refresh` (W5) | `dC3J6FsIqfN8IXn4` | active |
| `social-competitors` (W6) | `i3475VsXqPwNbEd7` | active, tracking 8 competitors (added 2026-07-30): `drumelia_real_estate`, `homerunbrokers`, `ryanserhant`, `serhant`, `spain.sothebysrealty`, `theagency.mallorca`, `engelvoelkersmallorca`, `marcel.remus` |

Credentials used (created in n8n, not stored in this repo): `Supabase Social (service_role)` (httpCustomAuth,
dual header) and `Meta Graph - IG Access Token` (httpQueryAuth). If the IG token is ever regenerated, update
that credential's value in n8n — no workflow JSON changes needed.

**Known gaps in the deployed version** (intentionally scoped down from the original spec, safe to revisit later):
- W1 fetches core account metrics only — the extra breakdown calls (`follows_and_unfollows` by `follow_type`,
  `profile_links_taps` by `contact_button_type`, `views` by `follower_type`/`media_product_type`) aren't wired
  up yet, so `AccountData.profileActivity`/`viewsBreakdown` will stay empty until added.
- W2 doesn't populate `duration_s` for reels (not in the basic media fields list) — `retentionPct` on the Reels
  page will show "—" until that's added.
- W0 backfill (90-day history + full media catalog) was never built as a separate workflow — the current data is
  whatever was seeded manually during setup (10 recent reels, one story, today's snapshot, yesterday's account
  insights, current demographics). Real backfill still needs building if 90 days of history is wanted immediately
  rather than accumulating day by day.
- No error-notification workflow wired up (no email/Slack credential available) — W5's "alert on failure" is
  currently just a thrown error visible in n8n's execution list, not a push notification.

These were validated by running each workflow's transform logic locally against real live Graph API responses
(not by live-executing the n8n workflow itself — this instance's webhook routes didn't register on test triggers,
likely needs a worker restart on the host side, so ad-hoc execution via the public API wasn't possible). All
Supabase writes are idempotent upserts, so a bad first scheduled run self-corrects on the next one.

All HTTP nodes hit `https://graph.facebook.com/v23.0/...` (Facebook Login flavor — the IG account
is linked to a Facebook Page, chosen so `business_discovery` works for W6). All writes are upserts
against Supabase (Postgres node, or the Supabase REST/PostgREST endpoint with `Prefer:
resolution=merge-duplicates`) — every workflow is safe to re-run. Reuse the same "Error Workflow"
notification pattern the existing 3 funnel workflows should already have, or stand one up now: a
missed IG sync is a silent, permanent data gap (esp. for W3 — stories vanish after 24h).

Exact metric names, breakdowns, and field lists are documented in full in
`~/Downloads/ANALYTICS_PLATFORM_ARCHITECTURE.md` §3.2 — don't re-derive them from scratch, and
re-verify against the live API version at build time since Meta deprecates fields periodically.

## W0 — social-backfill (manual, run once)

Trigger: manual. Loops account insights in ≤30-day chunks covering the last 90 days (API's max
retention), plus a full paginated media-list backfill (`paging.next`) for FEED/REELS history and
every media item's insights. Populates `daily_account_snapshots`, `daily_account_insights`, `media`,
`media_insights` from empty. Run this once right after Meta credentials are wired in, before trusting
any chart on `/social`.

## W1 — social-daily (daily 04:00)

Profile snapshot (`GET /{ig-user-id}?fields=followers_count,follows_count,media_count,...`) →
upsert `daily_account_snapshots`. Account insights for yesterday with all breakdowns → upsert
`daily_account_insights`.

## W2 — social-media-sync (every 6h)

Fetch media list, upsert new items into `media` (parse hashtags from caption at ingest, fetch reel
duration). Fetch insights for every item published <7 days ago (covers the ~48h insights lag) →
upsert `media_insights`. Weekly sub-branch: refresh insights for everything <90 days old.

## W3 — social-story-poller (every 2–4h) — must not go down

`GET /{ig-user-id}/stories` for live story IDs → upsert into `media` (product_type=STORY) → fetch
story insights (`navigation` breakdown → `tap_forward`/`tap_back`/`tap_exit`/`swipe_forward`) →
upsert `media_insights`. Stories are gone forever if this window is missed — this is the one
workflow where a missed run is unrecoverable, not just delayed.

## W4 — social-demographics (weekly, Mon 05:00)

8 calls (2 audiences × 4 breakdowns: age/gender/country/city) → upsert `demographics_snapshots`.
Requires ≥100 followers or the API returns nothing — check the response, don't treat empty as an
error.

## W5 — social-token-refresh (weekly)

If `token_expires_at < now() + 14 days`: call the refresh endpoint, update `ig_accounts`. On
failure: alert immediately (this is the workflow that silently breaks all the others if it fails
and nobody notices for 60 days).

## W6 — social-competitors (daily)

For each tracked competitor username (list maintained in the workflow, or a small Supabase config
table if the list grows past a handful): `business_discovery` call for followers_count,
media_count, and recent media like/comment counts → compute avg_likes/avg_comments → upsert
`competitor_snapshots`. Public accounts only; no reach/views available (Metricool doesn't have that
either — same API limitation).
