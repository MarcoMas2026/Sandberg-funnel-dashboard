# FUNNEL-CTX — Full platform context

> This is the complete brief for the **Sandberg Estates – Funnel Intelligence** dashboard.
> When the user types **`FUNNEL-CTX`**, read this whole file to reload everything about the platform.
> (No secret values are stored here — see "Secrets & access" for where they live.)

---

## 1. What it is & what it's for

A full-stack marketing funnel dashboard tracking each property ad campaign end to end:
**Meta Ad → Landing Page → Typeform → Qualified Lead.** It pulls live data from the Meta
Ads API and the Typeform API, joins them per campaign, and visualizes spend, leads,
cost-per-lead, conversion rates, and stage-by-stage funnel drop-off. It's a decision tool
for the marketing team to see, at a glance, which active property campaigns convert cheaply
and where leads drop off.

- **Live URL:** https://sandberg-funnel-dashboard.vercel.app
- **GitHub:** `MarcoMas2026/Sandberg-funnel-dashboard` (private)
  - **Vercel free-team build rule:** commits MUST be authored as **MarcoMas2026** or Vercel
    won't build. Pushes are done with a PAT in the remote URL, then the remote is reset back
    to the clean https URL.

## 2. Stack

- Next.js 14 (App Router, TypeScript), Tailwind (dark theme, purple accent `#6c4bdb`), Recharts.
- **Storage: Upstash Redis** accessed via its REST API directly in `lib/kv.ts` with
  `fetch(..., { cache: 'no-store' })`. **Do NOT switch back to the `@vercel/kv` SDK** — its
  internal fetch ignored Next's `dynamic = 'force-dynamic'` and served stale cached reads.
- Deployed to Vercel (auto-deploy on push to `main`).

## 3. Frontend structure

- `lib/dashboard-context.tsx` — single client `DashboardProvider`; fetches `/api/funnel` once,
  exposes `triggerUpdate()` (POSTs `/api/update`, then polls `/api/funnel` until `last_updated`
  changes). Sidebar + Topbar + CommandPalette + every page consume it via `useDashboard()`.
- `app/icon.svg` — custom favicon ("V Dashboard Logo", navy mark, transparent bg), added
  2026-07-15. Next.js file-convention icon — auto-served, no `metadata.icons` config needed.
  Browsers cache favicons aggressively; a hard refresh/re-bookmark may be needed to see it update.
- `app/campaign/[id]/page.tsx` — **Campaign deep dive**: info bar + 2-col layout. Left 35%:
  `MetricsPanel` (4 daily charts) + `SummaryPanel` (2×2 KPIs). Right 65%: `MarketingFunnel`.
- `components/MarketingFunnel.tsx` — fully code-drawn animated SVG cone (no image; the old
  `public/funnel-empty.png`/`funnel-plain.png` are unused). 5 stages, blue→fuchsia gradient,
  glowing rims, animated flow lines + scanline (CSS keyframes in `globals.css`, respects
  `prefers-reduced-motion`), count-up numbers on mount, hover-per-stage drop-off tooltip. **Stage 2
  is conditional on `campaign.campaign_type`**: `"property"` → "Watches Video" (`meta.video_plays`);
  `"community"` → "Engagement" (`meta.engagement` = Meta's `post_engagement` action — community
  campaigns run image ads with no video).
- `components/MetricsPanel.tsx` — 4 charts: Leads/day (bar), Spend/day (bar), Cost per lead
  (area; skips 0-lead days via `cplLine=null`+`connectNulls`; custom tooltip shows Leads + CPL),
  Unique Outbound CTR (small-dot scatter via tight `ZAxis range`).
- `lib/format.ts` — `parseCampaignName` ("SP - REF - PROPERTY"), `formatDate`, `shortDay`,
  currency/number/percent helpers.
- `app/compare/page.tsx` — **Compare**: pick a subject — an ACTIVE campaign or a verified PAST one
  (two pill-selector groups; a campaign that's both only appears under Active) — benchmark it
  against its top 3 OTHER campaigns of the same `campaign_type` across 6 metrics (spend, leads,
  CPL, CTR, click→form rate, completion rate) via `components/MetricCompareChart.tsx` (grouped
  horizontal bars, direction-aware "▲/▼ N% vs avg" badge). Ranking logic in `lib/ranking.ts`
  (`rankHistoricalCampaigns` excludes the subject by id, so picking a past campaign as the subject
  ranks the rest of the historical pool against it — same function, no special-casing needed) — see
  §7 for how the underlying historical data is populated and its real limitations.
- **Shell (2026-07-14 rebuild, restyled same day):** the old pill Navbar is GONE.
  `components/Sidebar.tsx` = grouped nav (Overview/Intelligence/Strategy sections, collapsible via
  a real toggle, unread-insights badge count), brand block, pipeline-status dot, **Update Data**
  button. `components/Topbar.tsx` = breadcrumb (Overview / Section) + a search bar that dispatches
  a synthetic ⌘K keydown to open `components/CommandPalette.tsx` (jump to any page/campaign,
  trigger sync). Both wired in `app/layout.tsx`.
  **Visual language restyle (2026-07-14, matched to user-supplied reference decks — crypto/fleet/
  trading dashboards):** softer graphite palette (`--bg:#101014`, `--panel2:#1e1e26`, NOT
  near-black), starfield speckle (`body::after`) + mesh glow (`body::before`), bigger radii
  (`--radius-lg:1.5rem`), `.glass`/`.gradient-border`/`.pill`/`.cta-light`/`.accent-bar` utility
  classes in `globals.css`. `components/viz.tsx` = shared primitives (CountUp, **Sparkline** now
  supports `markers` + `peakLabel` for the reference decks' signature dotted-marker +
  floating-value-chip pattern, DeltaChip, RingGauge, Pill). **Gotcha hit once, fixed same session:**
  the palette restyle briefly introduced `--panel-2` (hyphenated) while every existing component
  reads `--panel2` (no hyphen) — always `grep -rn "panel2\|panel-2"` before touching that token if
  editing globals.css again; a mismatch silently renders transparent backgrounds, no error thrown.
- **New preview pages on MOCK data** (`lib/mock.ts` — one export per ARCHITECTURE.md phase, every
  mocked number visibly tagged "preview" in the UI; funnel/campaign/compare stay 100% live-data):
  `app/page.tsx` is now **Mission Control** (greeting-style headline; price-card hero KPIs — colored
  `.accent-bar`, 3-dot menu, DeltaChip, peak-tooltip Sparkline — count-ups + REAL portfolio
  sparklines from live daily data; live-insight ticker; campaign cards with an identity gradient
  wash + "Meta synced"/"Typeform synced" connection badges + a start→today lifecycle strip + real
  lead sparklines + mock quality strips; a **Portfolio Leaderboard** table — REAL data, merges live
  active campaigns with the verified `historical:campaigns` pool, ranked by leads, with per-row
  trend sparklines), `/insights` (severity-coded analyst feed → Phase 3), `/demand` (buyer demand
  heatmap → Phase 5), `/patterns` (Creative DNA library → Phase 7, tab finally functional). When a
  backend phase ships, replace the corresponding `lib/mock.ts` export with a KV-backed API read and
  drop the "preview" tags for that surface.

## 4. API routes (`app/api/*`)

- `GET /api/funnel` — reads `funnel:merged` from KV (force-dynamic, no-store).
- `POST /api/update` — POSTs the n8n webhook (`NEXT_PUBLIC_N8N_WEBHOOK_URL`), returns triggered/ts.
- `GET /api/health` — returns `last_updated`.
- `GET /api/config` — **single source of truth**: returns `CAMPAIGN_MAP` from `lib/config.ts`.
  Both n8n workflows read this.
- `GET /api/historical` — returns `historical:campaigns` from KV (the Compare benchmark pool).

## 5. Data pipeline — n8n (the real backend)

Instance: `https://n8n.srv980538.hstgr.cloud`. Three workflows, all ACTIVE, owned by
`marketing@sandberg-estates.com` (n8n project `W0wwjWnSMxFvksmO`):

| Workflow | ID | Role |
|---|---|---|
| Funnel Dashboard - Meta Sync | `VQfmLUJ8Ti434TBS` | Pull Meta insights → KV `meta:campaigns` |
| Funnel Dashboard - Typeform Sync | `8ddVaAR0TNyZkvGZ` | Pull Typeform responses → KV `typeform:forms` |
| Funnel Dashboard - Update | `g9vuAw5CwhWl6SXf` | Orchestrator; webhook → runs both → merge → KV `funnel:merged` + `funnel:last_updated` |

- **Webhook (Update):** `POST https://n8n.srv980538.hstgr.cloud/webhook/funnel-update`
  (= `NEXT_PUBLIC_N8N_WEBHOOK_URL`). Fire-and-forget (responds 200 immediately, chain runs async).
- **n8n credentials to reuse** (IDs, not secrets): Meta `Meta Ads Insights` = `1tUtE81YWW5i1QDz`
  (never-expiring System User token, ads_read, ad account `act_908802846497778`); Typeform
  `Typeform account 3` = `zxf4hkaMaCINOMtm`; KV `Upstash KV Auth` = `FtPesyt3E1pd9ItX`
  (httpHeaderAuth `Authorization: Bearer <KV_REST_API_TOKEN>`).
- **KV (Upstash):** base `https://maximum-anteater-96315.upstash.io`; keys `meta:campaigns`,
  `typeform:forms`, `funnel:merged`, `funnel:last_updated`. REST: `POST /set/<key>` (raw body),
  `GET /get/<key>` → `{"result": "<string|null>"}`.

### Data-accuracy rules (LEARNED THE HARD WAY — keep these)

1. **Totals come from the Meta AGGREGATE, never summed daily.** Meta Sync makes TWO calls:
   *Get Totals* = `insights.date_preset(maximum){...}` (no time_increment) → authoritative
   spend/impressions/etc. (matches Ads Manager exactly); *Get Daily* =
   `insights.time_range({since:today-90d, until:today}).time_increment(1).limit(120){...}` →
   used ONLY for the trend-chart `daily[]` array. Summing the daily rows under-reports ~5%.
2. **LEADS = Typeform SUBMISSIONS**, not Meta's `lead` pixel. The Merge overrides
   `meta.leads = tf.completions`, `meta.cpl = meta.spend / tf.completions`, and each
   `meta.daily[].leads/.cpl` from a per-day submissions map. Frontend reads the same `meta.*`
   fields, so no frontend change was needed. Funnel "Fills Typeform" (= tf.completions) equals
   Total Leads.
3. **Date window = campaign start → today (inclusive).** `until = today` INCLUDES today (date
   presets exclude it). Meta returns no rows before a campaign's start, so the rolling 90-day
   window yields each campaign's data from its real start through today. If a campaign ever runs
   >90 days, bump the `minus({days:90})`.
4. **Meta filter `effective_status = ACTIVE`.** Paused campaigns → `meta:campaigns = []` →
   dashboard shows "No active campaigns". This is correct/expected; reactivating repopulates.
5. Field notes: `video_3_sec_watched_actions` is NOT valid in field-expansion → use
   `video_play_actions` (funnel "Watches Video Ad"). `link_clicks` = `inline_link_clicks`
   (== `link_click` action). Leads = only the unified `lead` action (but overridden by Typeform
   anyway).

### n8n structural gotchas

- Sub-workflows called via "Execute Workflow" must ALSO be activated, not just the orchestrator.
- "Execute Workflow Trigger" needs `parameters: {"inputSource":"passthrough"}`.
- **Multiple wires into one node's input does NOT batch** — chain nodes SEQUENTIALLY and pull each
  by `$('Node Name').first()`; don't rely on a Merge node for parallel branches.
- Webhook node needs explicit `httpMethod` + a `webhookId`, and after PUTting a workflow you must
  deactivate→reactivate for webhook/trigger changes to register.
- Typeform Insights API (top-of-funnel views) 404s on this plan → `views` is a proxy (= starts),
  not displayed. Responses fetched via `/responses?completed=true|false` (`starts` = completed +
  partial). Per-day submissions grouped by `submitted_at` in Europe/Madrid (`en-CA` date).
- Typeform Build joins responses to forms by **`form_id`** (via `pairedItem`, fallback index) —
  never by raw array position.

## 6. Single source of truth: adding a campaign

Edit **`lib/config.ts`** `CAMPAIGN_MAP` (add `meta_campaign_id`, `typeform_form_id`, property,
ref, names, and **`campaign_type`**: `"property"` or `"community"` — controls the funnel's 2nd
stage, see §3) → push to `main`. Vercel redeploys `/api/config`, and BOTH n8n workflows read it live
(Typeform Sync "Set Form List" via a "Get Config" node; orchestrator Merge via a "Read Config"
node, which also falls back to inferring type from a `CW` name prefix if a campaign isn't in
config). No hardcoded copies remain. Find a Typeform form id from the Typeform admin URL, or via
the API (`GET api.typeform.com/forms?page_size=200`, match by title) — **watch for duplicate
titles**; confirm the real form by grepping the live landing page HTML for `typeform.com/to/<id>`.

## 7. Historical data for Compare (`historical:campaigns` in KV)

Unlike everything else, this is **NOT a live n8n pipeline** — it's a manually-populated KV key
(`historical:campaigns`, read by `GET /api/historical`), because past (paused) campaigns' data
never changes and because resolving them is real detective work, not something to redo on every
Update. `lib/ranking.ts` reads this pool and, for a given active campaign, ranks past campaigns of
the same `campaign_type` by a composite score (50% normalized lead volume + 50% normalized
1/cost-per-lead, computed within the eligible pool) — filtered to spend ≥ `MIN_HISTORICAL_SPEND`
(€250, agreed with the user 2026-07-13) and excluding the campaign itself.

**Critical rule — do not add a campaign to this pool unless its leads are verifiably its own.**
Typeform doesn't know which ad campaign drove a submission unless the response's `hidden` fields
say so (checked via `GET /forms/{id}/responses`, inspect `.items[].hidden`). Two attribution
schemes exist in practice: newer community-page submissions carry `hidden.utm_campaign` = the
exact Meta campaign ID; older property-page submissions carry `hidden.campaign_name` /
`hidden.listing_reference` = the ref number. **A form matched only by name/landing-page similarity,
with no matching hidden field, must be excluded** — reusing the same form/landing page across
multiple ad campaigns over time means "total submissions" would double-count. This is exactly why,
in the 2026-07-13 backfill, 3 property campaigns (Villa Tulum, Finca Son Catlar, Apartamento Vista
Mar — empty hidden fields) and 2 old `"...WAITLIST"`-named community campaigns (Sa Vinya, Anchorage
— zero responses / all responses tagged to the *current* Anchorage campaign, not the old one) were
investigated and deliberately left OUT, rather than guessed.

Current pool (5 verified entries): Catalina Duplex, Finca Bugambilia, Villa Sa Caleta, Finca Son
Llum (all `property`, all already in `CAMPAIGN_MAP` or resolved via landing-page grep against
`~/Desktop/LANDINGS/sandbergestates.es/<ref>/index.html`), and Anchorage Club (`community` — the
only verified community campaign so far, so Compare correctly shows "not enough historical
community campaigns" until more exist). To extend the pool: find candidates via Meta (any status,
`spend >= 250`), resolve each to its real form via the landing-page grep method above, verify via
hidden-field attribution, compute `ctr`/`cpl`/`click_to_form_start_rate`/`form_completion_rate`,
then `POST` the appended array to `https://maximum-anteater-96315.upstash.io/set/historical:campaigns`.

**DEAD END — do not re-investigate (2026-07-14):** the 7 old `"...WAITLIST"`-named community
campaigns (Santanyi ×2, Campos ×2, SA VINYA, Mardavall, Anchorage Waitlist) predate Typeform entirely
— per the user, they went straight to an on-site form, not Typeform. Confirmed no Typeform form
exists for any of them (searched all 139 forms by title for santanyi/campos/mardavall/waitlist/
community — only the unused shared template `VCuyK1F1` and an unrelated property-listing form
matched; the template itself has 0 responses). Meta's own on-site lead pixel DOES have a real,
internally-consistent signal for them (`onsite_web_lead` = `lead` = `offsite_conversion.fb_pixel_lead`
= `offsite_lead_add_20_s_calls`, identical across all 4 action types per campaign — no double-count
ambiguity, unlike the aggregate-vs-daily issue elsewhere). Passing spend≥€250: SA VINYA (€590, 3
leads), Mardavall (€592, 9 leads), Anchorage Waitlist (€1316, 8 leads) — would have exactly filled
the community pool. **User explicitly declined to add them** (2026-07-14) to keep the pool
single-methodology (Typeform-only) rather than mix lead sources. Do not add Meta-pixel-sourced
historical entries unless the user asks again.

## 8. Secrets & access (where they live — NOT in this repo)

- **KV creds** (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) + `NEXT_PUBLIC_N8N_WEBHOOK_URL`: in
  `.env.local` (gitignored) and in Vercel project env vars.
- **n8n public API key + instance URL:** documented in the LANDINGS Claude memory
  (`reference_n8n.md`). Needed to script workflow edits via the n8n REST API — provide it in-session
  if you need to modify workflows from here.
- **GitHub push PAT:** user supplies per-push (repo is private; needs `repo` + `workflow` scopes).

## 9. Env vars

`NEXT_PUBLIC_N8N_WEBHOOK_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` — in `.env.local` and Vercel.

## 10. Current state (as of 2026-07-16)

Campaigns in `CAMPAIGN_MAP`: Catalina Duplex `120249096771300071`/`pqBjw5Y6` (property), Finca
Bugambilia `120248931370460071`/`d53a9GPD` (property), CAN VILA `120248754551970071`/`BZDwyYhN`
(property) — all **PAUSED** as of 2026-07-01. Anchorage Club `120250284542490071`/`OEtGQCfj`
(community) — **ACTIVE** (live spend/leads change daily — check the dashboard itself for current
numbers, don't trust any figure pinned in this file). Reactivating the paused ones repopulates
automatically via the config-driven, id-safe pipeline.

## 11. What to build next — Phase 1 (agreed, not yet built)

Per `ARCHITECTURE.md`'s 7-phase roadmap (§8 there has the full table), **Phase 1 — daily history
snapshots** is the agreed next step, decided 2026-07-16. Rationale: it's the cheapest phase AND
the enabler — Phases 3–5 (anomaly detection, fatigue detection, lifecycle "winner curves", budget
pacing advice) all need a day-by-day trend to read from, which doesn't exist yet (the pipeline
only keeps *current* state). Concretely: a new small n8n workflow, same proven pattern as the
existing 3 (see §5) — daily schedule trigger (e.g. 07:00), for each active campaign append that
day's row to a new KV key `history:{campaign_id}`. No new Meta/Typeform API calls needed — Meta
Sync already fetches this data, it just isn't retained over time. Cost: ~1 KV write per active
campaign per day, negligible against the free tier. Nothing has been built for this yet — when
picking this up, read `ARCHITECTURE.md` in full first (`§2.1` has the original spec).

## 12. Known non-blocking items (audited, deliberately left)

- Typeform response fetch is single-page `page_size=1000` (no pagination) — fine, forms will never
  exceed 1000 responses.
- A failed n8n run isn't surfaced to the user (webhook returns 200 immediately; dashboard polls
  ~30s then silently stops). No error-alert workflow exists.
- Funnel conversion %s are cross-source ratios (Meta stage ÷ previous Meta stage; Typeform starts ÷
  Meta link clicks) — approximations, not strict subsets.

## 13. OKR tracking + daily task automation (added 2026-07-17, reworked same day into current form)

A second, independent pipeline — separate from the Meta/Typeform/n8n system above — that turns the
team's manually-updated OKR Google Sheet into a live view plus a daily task-automation loop.
**Uses Google Sheets API + Vercel Cron, NOT n8n** (n8n stays reserved for the funnel pipeline).
This went through two build passes the same day: an initial version that auto-synthesized one
generic "Advance X" task per behind-pace Key Result, then a full rework (below) once the user
clarified they want each Key Result to hold its own named, deadline-having task checklist that
lives in the sheet. The description below is the CURRENT architecture only — the generic-task /
`"backlog"`-status / %-delta-bucket-checkin version it replaced is gone, not a fallback mode.

- **Source of truth:** Google Sheet `1OJk2cqTmwS1_GBhJL_U67-fzH-gqkfqD2ODBzFb_0kU`, tabs
  "Marketing Dept", "Paid Media", "Organic Content". Each tab has a header stat block
  (Cycle/Start/End Date, Days Left, Time Progress, Overall Progress) then Objective blocks with
  variable-count Key Results (Metric/Initial %/Objective(target) %/Actual %/Progress/Aligned Tasks
  columns). **Column letters drift between tabs** — `lib/sheets.ts` locates every column
  dynamically (header-stat labels, the KR table header row, and each KR's own name — see below)
  by scanning, never hardcoding a letter.
- **Key Result names** — each KR's real descriptive text sits in the sheet cell immediately after
  whichever cell in that row matches "Key Result N :" (verified live: e.g. Paid Media row 12 has
  "Key Result 1 :" then "Funnel visualization dashboard live & tracking metrics..." in the next
  cell). `lib/sheets.ts` locates this per-row (not a fixed column) and populates `KeyResult.name`
  — shown throughout the UI instead of the old generic "Key Result 1" label.
- **Tasks are named, dated, and platform-authored only** (never hand-typed into the sheet — the
  Aligned Tasks cell is a write-target the app keeps in sync, not something to edit directly).
  Click a Key Result on `/okrs` to open `components/KrDetailModal.tsx` (portalled to
  `document.body` like `CheckInModal.tsx`, same containing-block-bug fix — see below): shows the
  KR's live "N / M done · X%" line, its task checklist (checkbox + name + due date + delete), and
  an add-task form (name + date, prefilled via `computeDueDate` as a *suggestion* only — always
  user-editable, no longer authoritative). Task mutations go through `POST /api/okr/tasks`
  (`{krId, action: "add"|"toggle"|"delete", ...}`), which also patches today's Kanban board in KV
  if that task is already on it, so the two views never drift apart.
- **Aligned Tasks cell format** — one task per line inside the single cell (Sheets cells support
  `\n`), parsed/serialized by `lib/sheets.ts`'s `parseAlignedTasksCell`/`serializeAlignedTasksCell`:
  ```
  [x] Create video campaign brief (due 2026-07-19) {t1}
  [ ] Record voiceover (due 2026-07-19) {t2}
  ```
  Parsed by stripping fixed-shape suffixes right-to-left (checkbox → trailing `{tN}` id → trailing
  `(due YYYY-MM-DD)` → whatever remains is the name), so punctuation inside a task name never
  causes ambiguity. Lines that don't start with a checkbox (pre-existing free-text notes some KRs
  already had, e.g. Meta campaign ID references like `"32242, 32254, 31740"`) are skipped, not
  force-parsed — confirmed with the user as fine to silently overwrite on first real task add to
  that KR (informal notes, not tracked data). **Verified live**: adding two tasks and toggling one
  done via the UI produced exactly this format in the real sheet, and the Actual Percentage cell
  updated to match (`50%` → `100%`) — the sheet's own "Progress" column is a live formula off
  Actual/Initial/Objective, so nothing else needs writing.
- **Key Result progress = completed / total tasks**, always — `computeKrActualFromTasks` in
  `lib/okr-pace.ts`, `0` if a KR has no tasks yet. This is the sole source for `kr.actual`; the
  sheet's Actual Percentage cell is write-only from the app's perspective. The old %-delta-bucket
  afternoon check-in step (`none/+5/+10/+20/complete`) is gone entirely, fully replaced.
- **`lib/okr-pace.ts`** (client-safe — split from `lib/okr-tasks.ts` so client components, e.g.
  `/okrs` and the check-in modal, can use pacing/candidate-pool logic without pulling in
  `googleapis`/Node-only code; this split caused a real client-bundle-breaking bug once already
  when violated — keep it that way): `computeExpectedPace`, `scoreGap`, `priorityForGap`,
  `computeKrActualFromTasks`, date helpers (`addDays`/`daysBetween`/`computeDueDate`), and
  `buildCandidatePool(okr)` — every not-done `KrTask` across every KR (skipping blank-title
  objectives), priority **recomputed fresh from the parent KR's current pace gap every time**
  (never frozen at task-creation time), sorted by priority then due date. `DAILY_CAPACITY = 10` —
  an explicit placeholder, expected to change once real per-KR task volume from the (not yet
  built) task-breakdown system is known; the user said 8–12/day felt right for now.
- **Daily flow is evening-driven, not morning-auto-generated**: the afternoon/evening check-in
  (`components/CheckInModal.tsx`, two steps) — step 1: mark each of today's active tasks
  Done/In Progress/Blocked (buttons only, no free text); "Done" flips the underlying
  `KrTask.done = true`. Step 2: the ranked candidate pool (excluding anything just marked done),
  each with a checkbox, top `DAILY_CAPACITY` pre-checked, user adjusts freely, confirms → written
  as a `PendingSelection` (KV key `okr:pendingSelection`, `{date, taskIds}` where `date` is
  *tomorrow's* date) for the morning cron to activate. `lib/okr-tasks.ts`'s `activateNextBoard()`
  (used by both the morning cron and the manual "Auto-fill today" button): if a `PendingSelection`
  exists for today, activates it as the board (validated against **freshly-parsed `kr.tasks`, not
  just that the `krId` still exists** — closes the monthly-reset gap, see below); otherwise falls
  back to auto-selecting the top `DAILY_CAPACITY` from `buildCandidatePool` (covers day one, a
  skipped evening step, or first deploy — a board is never silently empty).
- **Monthly reset handling**: the user manually rewrites Objectives/Key Results in the sheet at
  the start of every month. `KeyResult.id` is positional (`${tab}-o${n}-kr${n}`), so a same-shaped
  rewrite reuses the same ids for entirely different content — a naive "does this krId still
  exist" check would wrongly keep last month's stale tasks. The fix costs nothing extra: since
  `KrTask` data lives *inside* the Aligned Tasks cell itself, retyping that row for the new month
  naturally clears its task list back to empty, so validating against `kr.tasks.some(t => t.id ===
  taskId)` (not just KR existence) makes a stale reference simply not be found — handled by
  `activateNextBoard` automatically, no explicit "is this a new month" detection needed.
- **`TaskStatus`** is `"todo" | "in_progress" | "done"` — no `"backlog"` status anymore; a
  not-yet-selected candidate simply doesn't exist on the board, it only appears in the check-in's
  step-2 pool.
- **KV:** `okr:board` (current `KanbanBoard`, mirrors `funnel:merged`'s pattern) and
  `okr:pendingSelection` (cleared once consumed) — no per-day history key for either, since the
  sheet is the durable OKR/task record.
- **API routes:** `GET /api/okr` (live tree), `POST /api/okr/tasks` (task CRUD, see above),
  `GET/POST /api/tasks` (board read / manual column move — moving a card is pure organizational
  state, never touches the sheet), `POST /api/tasks/generate` (manual "Auto-fill today" override —
  wraps `activateNextBoard`'s fallback path, not the primary daily flow anymore), `POST
  /api/tasks/checkin` (applies step-1 outcomes, batches one sheet write per affected KR — not per
  task, writes the `PendingSelection` from step 2), `GET /api/cron/morning-board` (calls
  `activateNextBoard`) + `GET /api/cron/evening-reminder` (flags `checkinDue` if the board has open
  tasks) — both Vercel Cron-only, gated on a `CRON_SECRET` bearer header.
- **Scheduling:** `vercel.json` crons — `morning-board` at `30 7 * * *` UTC (09:30 Mallorca time in
  July's CEST/UTC+2 offset), `evening-reminder` at `30 14 * * *` UTC (16:30 Mallorca). **Fixed UTC
  times, not timezone-aware** — when Spain switches back to CET/UTC+1 (last Sunday of October),
  these same UTC crons fire an hour later in local time (10:30/17:30) until manually adjusted.
  Vercel Hobby allows cron jobs (confirmed via Vercel's docs/changelog: up to 100/project, each
  fires at most once/day, may land anywhere within its scheduled hour not the exact minute).
- **Frontend:** `/okrs` and `/tasks` under the `app/(okr)/` route group so `lib/okr-context.tsx`'s
  `OkrProvider` (a live Sheets fetch) only runs on those two pages. `/okrs` — dept pill tabs,
  header stat card, Objective cards listing Key Results (real name, `components/ProgressBar.tsx`
  with an expected-pace tick mark, task-count summary), click a KR to open `KrDetailModal`. `/tasks`
  — Board/Timeline `Pill` toggle, 3-column Kanban (To Do/In Progress/Done, manual "move to →" per
  card — organizational only, never writes the sheet), an "Auto-fill today" override button
  (relabeled from "Generate today's tasks" to reflect it's no longer the primary flow), check-in
  banner. `components/TaskTimeline.tsx` — hand-rolled div/CSS Gantt-style view, no chart library,
  one row per task on a shared date axis, dept-cycle band per row, "Today" marker.
- **New env vars** (`.env.local` + Vercel): `GOOGLE_SHEETS_CLIENT_EMAIL`,
  `GOOGLE_SHEETS_PRIVATE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `CRON_SECRET`.
- **Bugs found and fixed during live verification against the real sheet (2026-07-17, both still
  relevant lessons for this codebase)**: (1) `lib/sheets.ts`'s objective/KR row scan used
  `row[0] ?? row[1] ?? ""` to fall through an empty column A to the real content in column B —
  `??` only falls back on `null`/`undefined`, not `""`, and column A is `""` (not undefined) in
  almost every row, so this silently produced zero objectives/KRs on every tab until changed to
  `||`. (2) `components/CheckInModal.tsx` (and now `KrDetailModal.tsx`) render inline inside a
  page's `.fade-up`-animated wrapper would break — per the CSS spec, any non-`none` `transform`
  value (even a resolved identity transform from a finished entrance animation) makes that
  ancestor a new containing block for `position: fixed` descendants. Both modals are portalled to
  `document.body` instead — the pattern to reach for if any future modal is nested inside an
  animated wrapper rather than mounted at the layout root like `CommandPalette.tsx`.
- **Current state (2026-07-17):** fully built, credentials supplied, and verified end-to-end
  against the real sheet — added real tasks to a live Key Result via the UI, confirmed the exact
  sheet cell format, confirmed Actual % + the sheet's own Progress formula update correctly,
  walked the full two-step check-in (outcome → tomorrow selection), confirmed the morning cron
  correctly activates a `PendingSelection` (validated with a manual KV write + cron trigger), and
  confirmed the "Auto-fill today" fallback path picks only genuinely-open tasks. All test data was
  reset afterward (sheet cells back to empty/0%, KV board and pending selection cleared) since it
  was verification, not real work. **Nothing has been pushed to `main`/Vercel yet** — this is all
  still local, uncommitted work as of this writing. Remaining before production use: (1) set the
  same 4 env vars in Vercel (Production + Preview); (2) push to `main` (commit author must be
  `MarcoMas2026` per the Vercel free-team build rule) so the two cron jobs start actually firing.
- **Known deliberate gap**: no per-KR task-breakdown *template* system exists yet (e.g. a reusable
  "launch campaign" checklist auto-applied to matching KRs) — the user described this as future
  work to define once real campaign task patterns are clearer; today every task is added one at a
  time per KR through the detail modal.
