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
- **STALE NOTE, corrected 2026-07-16:** Compare is fully live/functional (real data). Insights,
  Demand Map, and Patterns are real pages too, but currently render `lib/mock.ts` data pending
  their ARCHITECTURE.md backend phases — every mocked number is tagged "preview" in the UI. Only
  the **Patterns** nav item text used to be a true disabled placeholder; that's gone now. Don't
  assume any nav item is inert — check `lib/mock.ts` vs live KV reads per page if unsure.

## The 3 n8n workflows (instance: n8n.srv980538.hstgr.cloud)

- Meta Sync `VQfmLUJ8Ti434TBS` → KV `meta:campaigns`
- Typeform Sync `8ddVaAR0TNyZkvGZ` → KV `typeform:forms`
- Update (orchestrator) `g9vuAw5CwhWl6SXf` → webhook `/webhook/funnel-update` → KV `funnel:merged`

**Next agreed build step: Phase 1 (daily history snapshots) — see CONTEXT.md §11 and
ARCHITECTURE.md.** Not started yet as of 2026-07-16.

Editing workflows needs the n8n API key (in the LANDINGS Claude memory `reference_n8n.md`, not in
this repo) — ask the user for it if needed. KV token + webhook URL are in `.env.local`.

## OKR tracking (added 2026-07-17, separate from the n8n pipeline above)

`/okrs` and `/tasks` read/write a Google Sheet directly via the Sheets API (service account, NOT
n8n). Each Key Result holds a named, dated task checklist (added via clicking the KR on `/okrs`),
synced to the sheet's Aligned Tasks cell; KR progress = completed/total tasks. Tasks for tomorrow
are chosen the evening before (in the check-in flow), not auto-generated each morning — Vercel
Cron (`vercel.json`) just activates that choice, or falls back to an auto-picked ranked list if
none was made. See CONTEXT.md §13 for the full design. Credentials are set locally in `.env.local`
and verified working; still need to be added to Vercel's env vars, and this whole feature is still
unpushed (local-only) as of 2026-07-17.

## Verifying changes

Use the preview tools to run the dev server. Note: **stop the dev server before running
`next build`** (a concurrent build corrupts the shared `.next` dir → unstyled pages). Prefer
`npx tsc --noEmit` for type-checks while the preview is running.
