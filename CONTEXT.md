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
  changes). Navbar + both pages consume it via `useDashboard()`.
- `app/page.tsx` — **Overview**: grid of ACTIVE-campaign cards (property, ref, spend, leads,
  start date) → link to `/campaign/[id]`.
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
- Nav: Overview, Campaign, and **Compare are functional**; **Patterns is still an intentionally
  dimmed / non-functional** placeholder. The purple **Update** button is in the nav.

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

## 10. Current state (as of 2026-07-13)

Campaigns in `CAMPAIGN_MAP`: Catalina Duplex `120249096771300071`/`pqBjw5Y6` (property), Finca
Bugambilia `120248931370460071`/`d53a9GPD` (property), CAN VILA `120248754551970071`/`BZDwyYhN`
(property) — all **PAUSED** as of 2026-07-01. Anchorage Club `120250284542490071`/`OEtGQCfj`
(community) — **ACTIVE**, verified live (€314 spend, 55 leads via Typeform, engagement 655).
Reactivating the paused ones repopulates automatically via the config-driven,
id-safe pipeline.

## 11. Known non-blocking items (audited, deliberately left)

- Typeform response fetch is single-page `page_size=1000` (no pagination) — fine, forms will never
  exceed 1000 responses.
- A failed n8n run isn't surfaced to the user (webhook returns 200 immediately; dashboard polls
  ~30s then silently stops). No error-alert workflow exists.
- Funnel conversion %s are cross-source ratios (Meta stage ÷ previous Meta stage; Typeform starts ÷
  Meta link clicks) — approximations, not strict subsets.
