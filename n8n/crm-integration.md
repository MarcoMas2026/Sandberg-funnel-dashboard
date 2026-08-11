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

- **`FUNNEL_API_TOKEN`** lives in `.env.local` for local dev. **Not yet
  confirmed set in Vercel's project env vars** — add it there before the CRM's
  own pull against the live site will work (same "confirm it's in Vercel"
  step every other env var addition in this repo has needed).
- The Typeform Sync (`8ddVaAR0TNyZkvGZ`, node "Get Config") and Update
  orchestrator (`g9vuAw5CwhWl6SXf`, node "Read Config") workflows both call
  `/api/config` themselves — updated in place to send the same token via a new
  n8n credential **`Funnel API Token`** (`httpHeaderAuth`, id
  `gnuvIzBvRB6JZSml`), so guarding the route didn't break the existing
  pipeline. Verified live: both nodes carry the credential; workflows are
  still active.
- Give the CRM team the `FUNNEL_API_TOKEN` value out of band (not this repo,
  not chat logs) once Vercel's copy is confirmed set.

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

## What's still blocked on the CRM / on you

1. **The CRM endpoint isn't live yet.** The "Pull CRM Lead Outcomes" node's
   URL is a placeholder (`https://REPLACE-WITH-CRM-BASE-URL/...`) — swap it
   for the real `GET /api/intelligence/lead-outcomes` base URL once the CRM
   confirms it's deployed, and update the `CRM Lead Outcomes Token`
   credential with their real token. Nothing else in the workflow needs to
   change.
2. **`db/migrations/006_crm_lead_outcomes.sql` needs to be run in the
   Supabase SQL editor** (same manual step every prior migration in this repo
   has needed — no DDL execution path is available via the REST API key this
   project uses). Until it is, every run of this workflow will fail at "Get
   Sync State" / the final Supabase writes, which is expected and shows up as
   `last_status = 'failed'` — not silently.
3. **`FUNNEL_API_TOKEN` needs to be added to Vercel's env vars** (see above)
   before the CRM's own pull against the live dashboard will authenticate.

## Verification done vs. not done

- Verified: workflow structure accepted by n8n's API (POST + activate
  succeeded, `triggerCount: 1`), both existing workflows' `/api/config` calls
  still carry a valid credential, `/api/funnel-export` and `/api/config`
  tested locally for all three auth outcomes (missing/wrong/correct token).
- **Not verified end to end** — the CRM endpoint doesn't exist yet, so the
  success branch (rows actually landing in `crm_lead_outcomes`) has not run
  against real data. Per the brief: treat 404 as the expected state until the
  CRM confirms, and make sure that shows up as a distinct failure, not a
  quiet zero — which is exactly what `Classify Pull Result` does.
