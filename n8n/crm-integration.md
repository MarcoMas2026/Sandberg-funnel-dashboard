# CRM two-way data exchange — n8n side

Built 2026-08-11. Companion to the outbound half (`GET /api/config`, `GET
/api/funnel-export`, both now token-protected — see `lib/api-auth.ts`) and the
inbound storage (`lib/crm/db.ts`, `db/migrations/006_crm_lead_outcomes.sql`).
No shared database, no webhooks, no coupled deploys — each side pulls on its
own schedule, exactly as agreed with the CRM team.

## Outbound: `/api/config` + `/api/funnel-export` now require a token

Both routes 401 without `Authorization: Bearer <FUNNEL_API_TOKEN>`, and 503 if
`FUNNEL_API_TOKEN` isn't set in the environment at all (fail closed, never
open). `/api/public-view/[slug]/*` is deliberately untouched — still fully
public by design.

- **`FUNNEL_API_TOKEN`** lives in `.env.local` for local dev, and is
  **confirmed live in Vercel** (2026-08-12: direct curl against
  `https://sandberg-funnel-dashboard.vercel.app/api/funnel-export` with the
  local token returned 200) — the earlier "not yet confirmed" note was stale.
- The Typeform Sync (`8ddVaAR0TNyZkvGZ`, node "Get Config") and Update
  orchestrator (`g9vuAw5CwhWl6SXf`, node "Read Config") workflows both call
  `/api/config` themselves — updated in place to send the same token via a new
  n8n credential **`Funnel API Token`** (`httpHeaderAuth`, id
  `gnuvIzBvRB6JZSml`), so guarding the route didn't break the existing
  pipeline. Verified live: both nodes carry the credential; workflows are
  still active.
- Give the CRM team the `FUNNEL_API_TOKEN` value out of band (not this repo,
  not chat logs) — Vercel's copy is confirmed set.

**Daniel confirmed 2026-08-12 he's wiring the pull on his side and asked for
three things alongside the token: the exact base URL, and whether
`/api/funnel-export` returns all campaigns in one response or one per call.**
Both answered: base URL is `https://sandberg-funnel-dashboard.vercel.app`;
`/api/funnel-export` returns **all campaigns in a single array** (`{campaigns:
[...], last_updated, status}`, see `app/api/funnel-export/route.ts`), no
per-campaign/per-id path. He'll run a dry pull against it once he has the
token and report back anything that doesn't match his expectations.

## Inbound: `Funnel Dashboard - CRM Lead Outcomes Pull` (n8n id `gREsPFHua1LbUqnK`)

Same instance (`n8n.srv980538.hstgr.cloud`), same "small dedicated workflow,
writes straight to storage" pattern as the Instagram module's six workflows —
not an in-repo cron, per the standing decision in CLAUDE.md. **Active**, JSON
export checked into `n8n/exports/crm-lead-outcomes-pull.json` (closes part of
the portability gap ARCHITECTURE.md §15 flagged — no workflow exports existed
anywhere in the repo before this).

**Trigger:** hourly schedule. Lifecycle events (viewings, offers, Arras) don't
need 30-min freshness the way ad spend does, and an hourly cadence is gentler
on a CRM endpoint that isn't even live yet.

**Flow:**
1. `Get Sync State` — reads `crm_sync_state` (Supabase) for the last
   successful `since` cursor.
2. `Pull CRM Lead Outcomes` — `GET <CRM_BASE_URL>?since=<cursor>` with
   `Authorization: Bearer <CRM token>`, `fullResponse` + `neverError` so a
   401/404/5xx is inspectable instead of throwing.
3. `Classify Pull Result` — turns the raw response into `{ok, events}` or
   `{ok:false, reason}`; a request that never completed at all (DNS/timeout)
   is classified the same as a network failure, never as "zero events".
4. **Success branch:** upserts rows into `crm_lead_outcomes` (idempotent on
   `response_id, event`), stamps `crm_event_types.live_as_of` the first time
   any given event type is ever observed (this is the "not emitted yet" vs.
   "zero so far" distinction from CONTEXT.md), advances
   `crm_sync_state.last_success_cursor` to the newest `occurred_at` seen (or
   leaves it unchanged on an empty-but-successful pull — never rewinds).
5. **Failure branch:** writes `crm_sync_state.last_status = 'failed'` with a
   human-readable `last_error`, and does **not** touch the cursor — so a
   transient outage never causes events to be silently skipped.

**Credentials created:**
- `Supabase CRM Outcomes (service_role)` (`httpCustomAuth`, id
  `sHIxDeEl7Pz5ag5g`) — dual `apikey`/`Authorization` headers, same
  `SUPABASE_SERVICE_ROLE_KEY` as everywhere else in this repo.
- `CRM Lead Outcomes Token` (`httpHeaderAuth`, id `kMzVQ3Yg7trSrDZr`) —
  **placeholder value** (`Bearer REPLACE_ME_WHEN_CRM_SHARES_TOKEN`) until the
  CRM team hands over their real bearer token.

## CRM endpoint went live 2026-08-11 — real URL + token now wired in

Daniel (CRM) confirmed their side is live the same day. What changed:

- **Real endpoint**: `https://crm.sandberg-estates.com/api/intelligence/lead-outcomes?since=<ISO>`
  — the "Pull CRM Lead Outcomes" node's URL was updated from the placeholder
  to this. Confirmed via a direct curl: returns `{"complete":true,"events":[...]}`,
  matching `Classify Pull Result`'s expected shape exactly, no surprises.
- **Real token** wired into the `CRM Lead Outcomes Token` credential
  (`kMzVQ3Yg7trSrDZr`), replacing the placeholder.
- **Contract, confirmed by Daniel, now enforced in `Classify Pull Result`**: a
  200 ALWAYS carries `complete: true` — they never send a partial 200. If a
  200 body is ever missing that flag, the code node now treats it as a
  failure (never advances the cursor) rather than a clean empty success, per
  Daniel's own words: "a silently short window would be permanent loss rather
  than a delay." A 503 from them means they couldn't see a full window —
  same handling, retry the same `since` next run. Response rows are exactly
  `{response_id, event, occurred_at}`, nothing else — no names/emails/phones.
- **Correction on event coverage** (Daniel's own words: "a correction... in
  your favour" — he miscounted first time): **14 of 15 event types are wired
  and live**, not 7. Only `QualifiedLead` is permanently dormant by design —
  it's an alias of `QualifiedBuyerLead`/`QualifiedSellerLead`, deliberately
  never fired (would double-count one qualification under two names).
  `crm_event_types.live_as_of` in Supabase and `lib/crm/events.ts`'s
  `liveAsOfSeed` were both updated to match (2026-08-11 date-stamp).
- **Important caveat, also from Daniel — don't lose this**: of those 14 live
  types, only `LeadCreated` and `QualifiedBuyerLead` are producing data
  *today*. The rest (viewings, offers, Arras, all seller-side events) are
  wired correctly but return zero because of an **attribution gap on the
  CRM's side** — as of 2026-08-11, only 1 of 963 seller leads and 0 of 443
  offers are linked to a campaign. **A zero count on those event types is a
  data gap, not a campaign verdict** — `/outcomes` now says this explicitly.
  Closing that gap is the CRM's stated top priority; when it lands, those
  events start flowing with no change needed on our side.
- **Also flagged by Daniel, worth remembering**: their "qualified" signal is
  currently broader than intended — ~25% of `QualifiedBuyerLead` events have
  no search criteria recorded. They're tightening this, so expect
  `QualifiedBuyerLead` volume to drop noticeably at some point — that's a
  data-quality correction on their side, not a sign campaigns got worse.
- **Follow-up detail from Daniel, 2026-08-12**: the attribution gap isn't
  even across lead sources — **no portal enquiry carries attribution at all**
  (0 for Idealista, James Edition, Rightmove). Only Typeform attributes
  reliably (109 of 115). So Typeform-sourced leads are the ones most likely
  to start showing post-qualification events first once the CRM's fix lands,
  not portal leads generally. He also restated the pull contract plainly:
  **200 ⇒ store and advance the cursor; anything else ⇒ change nothing,
  retry the same window** — every 200 carries `complete: true` explicitly
  (never inferred), and a 503 (can't see a full window) gets the same
  retry-same-window handling as a failure, never a silent partial 200 (a
  short window would be permanent loss on an incremental pull, not a delay).
  Every CRM response also carries a `coverage` block listing which event
  types are flowing vs. dormant, derived from their code — no need to
  maintain that list by hand on our side either.

**Bug found and fixed during verification**: the "Pull CRM Lead Outcomes"
node originally threw a hard, uncaught error on a DNS/network failure (it
was still pointed at the placeholder URL at the time) instead of flowing
into the failure-handling branch — meaning every hourly run before the real
URL/token landed was crashing outright rather than logging a clean `failed`
status. Fixed by setting `onError: "continueRegularOutput"` on that node.
Confirmed working: the run that hit this (execution `64010`) crashed; the
next one (`64422`, still on the old placeholder URL at that point) failed
*gracefully* into `Update Sync State Failed` instead.

## Verification done

- Token guard (`/api/config`, `/api/funnel-export`): all three auth outcomes
  (missing/wrong/correct) verified against the live production URL.
- `db/migrations/006_crm_lead_outcomes.sql` applied and verified (15 event
  types seeded, `crm_sync_state` clean, `crm_lead_outcomes` empty pre-pull).
- `/outcomes` and `/api/crm/outcomes` confirmed reading real Supabase data in
  production (`connected: true`).
- CRM endpoint confirmed reachable and returning the expected shape via a
  direct curl with the real token.
- `FUNNEL_API_TOKEN` reconfirmed live in Vercel 2026-08-12 via a direct curl
  against production `/api/funnel-export` (200 with the `.env.local` token).
- **Still pending**: confirming an actual n8n scheduled run (not a manual
  curl) lands rows in `crm_lead_outcomes` and advances
  `crm_sync_state.last_success_cursor` — being watched for as of this
  writing. Also pending: Daniel's own dry pull against `/api/funnel-export`
  once he has the token — he'll report anything that doesn't match his
  puller's expectations. Update this doc once either lands.
