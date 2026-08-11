# CLAUDE.md — Sandberg Estates · Funnel Intelligence

This is the **Funnel Intelligence** marketing dashboard: a Next.js 14 "command center" app
(sidebar + breadcrumb/search topbar + ⌘K palette) that visualizes each active property ad
campaign's funnel (Meta Ad → Landing Page → Typeform → Qualified Lead), fed by 3 n8n workflows
that write to Upstash Redis (KV). Live at https://sandberg-funnel-dashboard.vercel.app.

## FUNNEL-CTX — full context trigger

When the user types **`FUNNEL-CTX`** (or asks you to "load the funnel context"), **read
[`CONTEXT.md`](CONTEXT.md) in full** — it contains the complete platform brief: architecture, the
3 n8n workflow IDs, KV keys, credential IDs, data-accuracy rules, n8n gotchas, how to add a
campaign, where secrets live, and current state. Load it before doing any non-trivial work on the
pipeline or data logic.

For roadmap/vision work, also read [`ARCHITECTURE.md`](ARCHITECTURE.md) — the phased master plan
(L1–L5: history snapshots, lead-quality scoring, intelligence engines, AI-analyst layer,
value-based CAPI feedback loop) with build-order and zero-API-cost constraints.

## Critical rules (do not violate)

- **KV access:** use the Upstash REST API directly in `lib/kv.ts` with `cache: 'no-store'`. Never
  reintroduce the `@vercel/kv` SDK (it caused stale cached reads).
- **Meta totals come from the aggregate** (`date_preset(maximum)`), NEVER from summing the daily
  (`time_increment`) rows — the daily breakdown under-reports ~5%. Daily data is for charts only.
- **Leads = Typeform submissions** (`tf.completions`), not Meta's lead pixel. Cost-per-lead =
  Meta spend ÷ submissions. The Merge overrides `meta.leads/.cpl` and each `meta.daily[]` entry.
- **Single source of truth for the campaign map:** `lib/config.ts` → exposed at `/api/config` →
  read live by both n8n workflows. Add a campaign by editing `lib/config.ts` and pushing; do NOT
  hardcode mappings in n8n.
- **Vercel free-team build rule:** git commits must be authored as `MarcoMas2026` or the deploy
  won't build.
- **STALE NOTE, corrected 2026-07-29:** Compare is fully live/functional (real data). **Insights
  is also fully live** as of 2026-07-29 — `lib/insights.ts`'s `computeInsights()` /
  `computePortfolioHealth()` run rule-based detectors directly on `funnel:merged` (Meta's
  `meta.daily[]`, Typeform field drop-off, Clarity friction) at render time in the browser; no
  mock data, no `insights:feed` KV key. This is a lighter, non-n8n path than ARCHITECTURE.md's
  original Phase 3 spec (see CONTEXT.md §11.1) — ad-level fatigue and lifecycle "winner curves"
  (Phases 4–5) still need the n8n history-snapshot workflow and remain unbuilt. Demand Map and
  Patterns are real pages but still render `lib/mock.ts` data pending their ARCHITECTURE.md
  backend phases — every mocked number is tagged "preview" in the UI. Don't assume any nav item
  is inert — check `lib/mock.ts` vs live KV/computed reads per page if unsure.

## The 3 n8n workflows (instance: n8n.srv980538.hstgr.cloud)

- Meta Sync `VQfmLUJ8Ti434TBS` → KV `meta:campaigns`
- Typeform Sync `8ddVaAR0TNyZkvGZ` → KV `typeform:forms`
- Update (orchestrator) `g9vuAw5CwhWl6SXf` → webhook `/webhook/funnel-update` → KV `funnel:merged`

**Next agreed build step: Phase 1 (daily history snapshots) — see CONTEXT.md §11 and
ARCHITECTURE.md.** Not started yet as of 2026-07-16.

Editing workflows needs the n8n API key (in the LANDINGS Claude memory `reference_n8n.md`, not in
this repo) — ask the user for it if needed. KV token + webhook URL are in `.env.local`.

## OKR view (added 2026-07-17, read-only as of 2026-07-21, separate from the n8n pipeline above)

`/okrs` reads a Google Sheet directly via the Sheets API (service account, NOT n8n) to visualize
Objectives, Key Results, and their progress. **View-only by design — the dashboard never writes
back to the sheet.** Each Key Result's tasks (name/done/due-date) are read from the sheet's Aligned
Tasks cell and shown read-only in a detail modal; KR progress = completed/total tasks, computed
from that same read. There is no Task Board, no check-in flow, no cron jobs, and no rename/clear —
that whole write-capable "Tasks" feature (Kanban board, evening check-in, daily-task cron) was
torn out on 2026-07-21 at the user's request ("only to visualize okrs and their progress"). "Sync
now" on `/okrs` just re-fetches the sheet — still read-only. See CONTEXT.md §13 for the current
design. Credentials are set locally in `.env.local` and verified working; pushed to `main` on
2026-07-21 — **confirm `GOOGLE_SHEETS_CLIENT_EMAIL`/`GOOGLE_SHEETS_PRIVATE_KEY`/
`GOOGLE_SHEETS_SPREADSHEET_ID` are set in Vercel's project env vars**, or `/okrs` will render the
"not connected" empty state on the live site. `CRON_SECRET` is no longer needed (the cron jobs it
gated were removed) — safe to leave in Vercel unused or delete it.

## Instagram Analytics module (added 2026-07-30, separate from both the n8n funnel pipeline and the OKR view)

`/social` clones Metricool's Instagram Analytics (Community/Account/Posts/Reels/Stories/
Demographics/Competitors) for the single Sandberg Estates IG business account. Built from
`~/Downloads/ANALYTICS_PLATFORM_ARCHITECTURE.md` — see that file for the full metric/endpoint
reference if extending this.

- **Data store: Supabase Postgres, NOT Upstash KV.** This module needs real time-series queries
  (daily history, per-post tables, hashtag GROUP BY, a 7×24 heatmap) that KV can't do well. Schema
  in `db/migrations/001_social_init.sql`. Nothing in `lib/social/*` touches `lib/kv.ts` or its keys
  — the two pipelines are intentionally decoupled end to end.
- **Data layer:** `lib/social/db.ts` (Supabase client + query functions, `SUPABASE_SERVICE_ROLE_KEY`
  server-only — same rule as `KV_REST_API_TOKEN`), consumed by `app/api/social/*/route.ts` (thin
  wrappers, same empty-safe-shape-on-error pattern as `app/api/okr/route.ts`), rendered by
  `app/(social)/social/*` pages via the `useSocialData` hook.
- **Auth flavor: Facebook Login** (IG account linked to a Facebook Page) — chosen over the simpler
  Instagram Login flavor specifically to unlock `business_discovery` for Competitor tracking. The
  live `IG_ACCESS_TOKEN` is a **Page-scoped token with `expires_at: 0` (permanent)**, obtained via
  `oauth/access_token?grant_type=fb_exchange_token` — not the Instagram-Login-flavor short-lived
  token, and not derived through Graph API Explorer's "Get Page Access Token" button (that
  consistently returned a short-lived token in practice on 2026-07-30, cause unconfirmed).
- **Automation is live in n8n** (`n8n.srv980538.hstgr.cloud`, same instance as the funnel pipeline —
  explicit user call to not move scheduling into in-repo cron). All 6 workflows deployed and active
  as of 2026-07-30 — IDs, credentials, and known scope gaps in `n8n/social-workflows.md`. No W0
  backfill workflow exists; current data is whatever was manually seeded during setup plus whatever
  W1–W6 have accumulated since.
- **V1 scope is core sections + Competitors.** Explicitly deferred (do not build unless asked):
  AI content-tagging/classification of posts (property type, video vs photo, CTA type correlated
  with performance) and PDF export / scheduled email reports. Both are documented ideas, not
  partially-built — don't assume stub code exists for them.
- **Credentials are live as of 2026-07-30** — Supabase schema migrated (`db/migrations/001_social_init.sql`
  + `002_ids_as_text.sql`, the latter a real bug fix: Instagram's 18-digit IDs exceed
  `Number.MAX_SAFE_INTEGER` and silently corrupt on the JS side if stored as `bigint`/read back as a
  JSON number — always store Meta platform IDs as `text`). All values are in `.env.local`; not yet
  confirmed set in Vercel's project env vars for production. `social-competitors` (W6) is tracking 8
  real competitors as of 2026-07-30 — see `n8n/social-workflows.md` for the list.

## CRM two-way data exchange (added 2026-08-11, fully verified on our side same day — see CONTEXT.md §16)

`/api/config` and the new `GET /api/funnel-export` require `Authorization: Bearer <FUNNEL_API_TOKEN>`
(`lib/api-auth.ts`) — missing/wrong → 401, token unset → 503. **Verified live in production**: all
three auth outcomes tested against `https://sandberg-funnel-dashboard.vercel.app` (`FUNNEL_API_TOKEN`
is set in Vercel), plus confirmed the existing Typeform Sync/Update orchestrator n8n nodes that read
`/api/config` still work (via the new `Funnel API Token` n8n credential). `/api/public-view/[slug]/*`
confirmed still unauthenticated, unchanged.

`db/migrations/006_crm_lead_outcomes.sql` **has been applied** — `crm_event_types` verified seeded
with all 15 rows (7 stamped live, 8 pending), `crm_sync_state` verified in its clean `never_run`
state, `crm_lead_outcomes` verified empty (correct, nothing to ingest yet). `/api/crm/outcomes` and
`/outcomes` confirmed reading these live tables in production (`connected: true`), not the static
fallback. One transient PostgREST schema-cache 404 hit the pull workflow's first run right after the
migration (expected — Supabase's schema cache lags new tables by anywhere from seconds to a couple
minutes) and resolved on its own; not a migration problem, no action was needed.

**CRM endpoint went live 2026-08-11, same day** — real URL + token wired into the pull workflow,
verified via a direct curl returning the expected `{complete:true, events:[...]}` shape. A real bug
(an uncaught DNS error crashing the whole run instead of failing gracefully) was found and fixed in
the process — see `n8n/crm-integration.md`. Event coverage was also corrected the same day: **14 of
15 types are live**, not 7 — only `QualifiedLead` is permanently dormant by design. Most of those 14
still show zero data today due to an attribution gap on the CRM's side, not campaign performance —
`/outcomes` says so explicitly. Full detail, including Daniel's caveats, in `n8n/crm-integration.md`
and CONTEXT.md §16. **Still open:** confirming an actual scheduled n8n run (not just a manual curl)
lands rows in `crm_lead_outcomes`.

## Verifying changes

Use the preview tools to run the dev server. Note: **stop the dev server before running
`next build`** (a concurrent build corrupts the shared `.next` dir → unstyled pages). Prefer
`npx tsc --noEmit` for type-checks while the preview is running.
