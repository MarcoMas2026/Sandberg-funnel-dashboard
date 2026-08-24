# Instagram Analytics & Reporting Platform — Architecture Blueprint

> Goal: replicate **Metricool's Analytics + Reports modules** (Instagram only, single business account) as a self-hosted platform built with **Claude Code** (development), **N8N** (data pipelines / scheduling), **GitHub** (source control + CI), and **Vercel** (hosting + serverless).
>
> Scope explicitly excludes: publishing/planner, inbox, ads management, link-in-bio, multi-brand/agency features.

---

## 1. How Metricool actually works (reverse-engineered)

Metricool is not doing anything magical — it is a **snapshot-and-aggregate ETL system** on top of Meta's official Instagram Graph API:

```
┌─────────────┐   OAuth    ┌──────────────────┐   cron ETL   ┌────────────┐
│ Instagram    │──────────▶│ Connection layer  │─────────────▶│ Time-series │
│ Business acct│  (Meta     │ (tokens, account  │  (pull +     │ database    │
│              │  Graph API)│  linking)         │   snapshot)  │ (per-day    │
└─────────────┘            └──────────────────┘              │  rows)      │
                                                              └─────┬──────┘
                                                                    │
                                          ┌─────────────────────────┼──────────────┐
                                          ▼                         ▼              ▼
                                   ┌────────────┐          ┌──────────────┐ ┌────────────┐
                                   │ Aggregation │          │ Dashboard UI │ │ Report     │
                                   │ layer       │          │ (charts,     │ │ generator  │
                                   │ (derived    │          │  tables,     │ │ (PDF,      │
                                   │  metrics)   │          │  heatmaps)   │ │  email)    │
                                   └────────────┘          └──────────────┘ └────────────┘
```

The five architectural insights that make the clone work:

1. **The API is stateless; Metricool's value is the database.** Meta only stores account-level insight data for ~90 days and each request can cover at most ~30 days. Metricool polls daily and **stores every day's numbers forever**, which is what enables "evolution" charts, year-over-year views, and arbitrary date-range reports. Your platform must do the same: *pull frequently, store permanently*.
2. **Followers history is a snapshot, not an API metric.** There is no "followers on March 3rd" endpoint. Metricool reads `followers_count` from the profile every day and stores it. The "Followers balance" chart is the day-over-day delta of those snapshots combined with the `follows_and_unfollows` metric.
3. **Stories die after 24 h.** Story insights are only queryable while the story is live. Metricool polls for active stories several times a day and persists their metrics before they expire. Miss the window and the data is gone forever.
4. **Everything visible in the UI is either a raw API metric or a trivial derivation** (sums, averages, ratios like engagement rate). Section 5 lists every formula.
5. **Reports are just the dashboard re-rendered to PDF** for a chosen date range, with a template/branding layer, generated on a schedule and emailed.

---

## 2. Target feature inventory (what you are cloning, exactly)

Metricool's Instagram analytics is organized into these sections. This is the definition of done for the dashboard.

### 2.1 Community
- **Growth chart**: followers (total, end of each day), following, total content count — daily time series.
- **Followers balance**: net daily follower change (gains vs losses as +/- bars).
- **Summary tiles**: followers growth in period, daily average followers gained, followers per post, posts per day / per week.

### 2.2 Demographics (current state only — no history from API)
- Gender split, age brackets, top countries, top cities (follower_demographics).
- Optional: same breakdowns for the *engaged* audience (engaged_audience_demographics).
- Requires ≥ 100 followers (API restriction).

### 2.3 Account (organic + paid, account-level)
- Reach evolution (daily), Views evolution (daily; replaced impressions in April 2025).
- Interactions evolution: likes, comments, saves, shares, replies, reposts, total_interactions.
- Profile activity: accounts engaged, profile link taps (breakdown by contact button type).
- Views breakdown by follower vs non-follower and by content type (posts / reels / stories).

### 2.4 Posts (feed posts + carousels published in period)
- Summary tiles: engagement %, total interactions, average reach/post, total views, post count.
- Interactions block: likes, comments, saved, shares — totals + per-post and per-day averages.
- Content-type distribution (image vs carousel).
- **Posts table** (one row per post): thumbnail, type, date, reach, views, interactions, likes, comments, saved, shares, engagement %, profile visits, follows. (Paid columns only if you later connect Ads — out of scope v1.)

### 2.5 Reels
- Summary tiles: engagement %, interactions, average reach/reel, views, reel count.
- **Reels table**: date, reach, views, interactions, likes, comments, saved, shares, engagement %, average watch time, total watch time, duration, retention % (= avg watch time ÷ duration), skip rate.

### 2.6 Stories
- Evolution chart: views, average reach/story, story count per day.
- **Stories table**: date, reach, views, replies, taps back, taps forward, exits (navigation breakdown), link clicks, profile visits, follows.

### 2.7 Hashtags (derived from your own posts)
- Per hashtag used in your captions: number of posts, total views, avg likes, avg comments.

### 2.8 Best time to post (heatmap)
- 7×24 heatmap. Computed from your own historical performance: average reach/engagement of posts bucketed by publish weekday × hour. (Meta's `online_followers` metric has been deprecated/unreliable — verify availability at build time; the own-performance heatmap works regardless.)

### 2.9 Competitors (optional, phase 2)
- Via the `business_discovery` API: for any public IG business/creator username you can read followers_count, media_count and recent media with like/comment counts. Snapshot daily → competitor growth + avg likes/comments + engagement tables. (No reach/views for competitors — Metricool doesn't have them either.)

### 2.10 Reports module
- Date-range picker + section toggles (include/exclude each section above).
- Comparison vs previous period (every KPI tile shows Δ%).
- Branded PDF export (logo, colors, cover page).
- Scheduled reports: e.g. 1st of each month, auto-generate previous month's PDF and email it.

---

## 3. Data source: Instagram Graph API (the only ingredient)

### 3.1 Prerequisites (one-time setup)
1. Instagram account must be a **Business (or Creator) account**.
2. Create a **Meta Developer App** (https://developers.facebook.com) — type "Business". For a single own account, the app can stay in **Development mode** forever (no App Review needed for your own account's data).
3. Two auth flavors — pick one:
   - **Instagram API with Instagram Login** (recommended, simpler): no Facebook Page required. Scopes: `instagram_business_basic`, `instagram_business_manage_insights`. Tokens: 60-day long-lived, refreshable via `GET /refresh_access_token` before expiry.
   - **Instagram API with Facebook Login**: requires the IG account linked to a Facebook Page. Scopes: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`. Required if you want `business_discovery` (competitors) — verify current requirements at build time.
4. Store: `IG_USER_ID`, `ACCESS_TOKEN` (long-lived), `APP_ID`, `APP_SECRET`.

### 3.2 Endpoints & exact metric names (current, post-v22 / April 2025)

**A. Profile snapshot** (poll daily — this builds followers history):
```
GET /{ig-user-id}?fields=followers_count,follows_count,media_count,username,profile_picture_url,biography
```

**B. Account insights — interaction metrics** (`period=day`, `metric_type=total_value`, max ~30-day since/until window per call):
```
GET /{ig-user-id}/insights
  ?metric=reach,views,accounts_engaged,total_interactions,likes,comments,shares,saves,replies,reposts,profile_links_taps,follows_and_unfollows
  &period=day&metric_type=total_value&since={unix}&until={unix}
```
- `reach` also supports `metric_type=time_series` (daily series in one call) and breakdowns `media_product_type`, `follow_type`.
- `views` supports breakdowns `follower_type`, `media_product_type`.
- `profile_links_taps` breakdown: `contact_button_type`.
- `follows_and_unfollows` breakdown: `follow_type` (→ Followers balance chart).
- ⚠️ `impressions`, `profile_views`, `website_clicks`, `email_contacts`, `phone_call_clicks`, `text_message_clicks`, non-reel `video_views` are **deprecated** — do not use.

**C. Demographics** (`period=lifetime`, snapshot weekly):
```
GET /{ig-user-id}/insights
  ?metric=follower_demographics,engaged_audience_demographics
  &period=lifetime&metric_type=total_value
  &breakdown=age|city|country|gender      (one breakdown per call)
  &timeframe=last_30_days                 (options: last_14_days, last_30_days, last_90_days, this_month, this_week, prev_month)
```

**D. Media list** (poll several times daily to discover new content):
```
GET /{ig-user-id}/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=50
```
- `media_product_type` ∈ `FEED`, `REELS` (stories come from a different edge).
- Paginate with `paging.next` for full backfill of historical posts.
- Note: **media insights only exist for posts created after the account became a Business account**; older posts return basic like/comment counts only.

**E. Media insights per item** — metric set depends on `media_product_type`:
- FEED (posts & carousels):
  ```
  GET /{media-id}/insights?metric=reach,views,likes,comments,saved,shares,reposts,total_interactions,profile_visits,follows,profile_activity
  ```
- REELS:
  ```
  GET /{media-id}/insights?metric=reach,views,likes,comments,saved,shares,reposts,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time
  ```
  (`ig_reels_avg_watch_time` and total time are in **milliseconds**. Optional: `reels_skip_rate` where available.)
- STORY:
  ```
  GET /{ig-user-id}/stories                → live story IDs (24 h window!)
  GET /{story-id}/insights?metric=reach,views,replies,shares,total_interactions,follows,profile_visits,link_clicks,navigation&breakdown=story_navigation_action_type
  ```
  `navigation` breakdown yields `tap_forward`, `tap_back`, `tap_exit`, `swipe_forward`. ⚠️ `replies` returns 0 for viewers in EU/Japan (privacy rules). Insights data can lag up to ~48 h for all media types — re-poll recent media.

**F. Competitors (phase 2, Facebook Login only):**
```
GET /{ig-user-id}?fields=business_discovery.username({competitor}){followers_count,media_count,media.limit(30){like_count,comments_count,timestamp,media_type}}
```

### 3.3 Limits & gotchas (design constraints)

| Constraint | Consequence for design |
|---|---|
| Account insights: max ~30-day range per request, ~90-day server-side retention | Daily ETL + permanent local storage; backfill loop in ≤30-day chunks for the last 90 days on first run |
| Stories queryable only while live (24 h) | Dedicated N8N poller every 2–4 h |
| Insights lag up to 48 h | Re-fetch media insights for content < 7 days old on every daily run |
| Demographics: no history, ≥100 followers | Weekly snapshot table to build your own demographic history |
| Long-lived token expires in 60 days | Monthly token-refresh N8N workflow + expiry alert |
| Rate limits (~200 calls/user/hour tier) | Irrelevant at single-account scale if you batch sensibly; add 1 s pause between media-insight calls anyway |
| Reel `views` counts replays since 2025-04-21 | Note in UI when comparing to pre-2025 data |

---

## 4. System architecture

```
┌──────────────────────────  N8N (ETL + scheduling)  ──────────────────────────┐
│  W1 daily-account-etl   W2 media-sync   W3 story-poller   W4 demographics    │
│  W5 token-refresh       W6 report-scheduler         (HTTP Request → Postgres)│
└──────────────┬───────────────────────────────────────────────┬───────────────┘
               │ writes                                        │ triggers
               ▼                                               ▼
      ┌─────────────────┐   reads   ┌──────────────────────────────────────┐
      │  Supabase        │◀─────────│  Next.js app on Vercel               │
      │  (Postgres)      │          │  /dashboard (charts) /api (queries)  │
      │  single source   │          │  /report/[id] (print view + PDF)     │
      │  of truth        │          └──────────────────────────────────────┘
      └─────────────────┘                GitHub → Vercel auto-deploy (CI)
```

**Role of each tool:**
- **N8N** — all Meta API calls, cron schedules, token refresh, report scheduling + email. *N8N never renders anything.*
- **Supabase (Postgres)** — recommended DB: free tier, plays well with both the N8N Postgres node and Vercel; you also get row-level security and a REST layer for free. (Neon/Vercel Postgres works identically if you prefer.)
- **Next.js on Vercel** — dashboard UI, query API routes, report print view + PDF endpoint. *The app never calls Meta directly* (except optionally the OAuth connect flow).
- **GitHub** — repo, PRs, and the Vercel integration (push to `main` = deploy).
- **Claude Code** — builds all of the above following the phase plan in §9.

Clean separation rule: **ingestion (N8N) and presentation (Vercel) only meet at the database.** This is exactly Metricool's internal split and it makes each side independently debuggable.

---

## 5. Data model (Postgres DDL)

```sql
-- One row per connected account (you'll have 1, but don't hardcode it)
CREATE TABLE ig_accounts (
  id            BIGINT PRIMARY KEY,          -- ig-user-id
  username      TEXT NOT NULL,
  connected_at  TIMESTAMPTZ DEFAULT now(),
  access_token  TEXT NOT NULL,               -- long-lived; N8N refreshes
  token_expires_at TIMESTAMPTZ
);

-- Daily profile snapshot → Community section
CREATE TABLE daily_account_snapshots (
  account_id    BIGINT REFERENCES ig_accounts(id),
  date          DATE NOT NULL,
  followers     INT, following INT, media_count INT,
  PRIMARY KEY (account_id, date)
);

-- Daily account insights → Account section (one row per metric per day; EAV
-- beats wide tables here because Meta renames metrics every couple of years)
CREATE TABLE daily_account_insights (
  account_id    BIGINT REFERENCES ig_accounts(id),
  date          DATE NOT NULL,
  metric        TEXT NOT NULL,               -- 'reach','views','likes',...
  breakdown_key TEXT NOT NULL DEFAULT '',    -- e.g. 'media_product_type:reel'
  value         BIGINT NOT NULL,
  PRIMARY KEY (account_id, date, metric, breakdown_key)
);

-- Content catalog (posts, reels, stories)
CREATE TABLE media (
  id            TEXT PRIMARY KEY,            -- media-id
  account_id    BIGINT REFERENCES ig_accounts(id),
  product_type  TEXT NOT NULL,               -- FEED | REELS | STORY
  media_type    TEXT,                        -- IMAGE | VIDEO | CAROUSEL_ALBUM
  caption       TEXT,
  hashtags      TEXT[],                      -- parsed from caption at ingest
  permalink     TEXT, thumbnail_url TEXT,
  published_at  TIMESTAMPTZ NOT NULL,
  duration_s    NUMERIC                      -- reels only (for retention %)
);

-- Latest metric values per media item (upserted on every poll)
CREATE TABLE media_insights (
  media_id      TEXT REFERENCES media(id),
  metric        TEXT NOT NULL,               -- 'reach','views','saved',
                                             -- 'navigation:tap_back', ...
  value         BIGINT NOT NULL,
  fetched_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (media_id, metric)
);

-- Weekly demographics snapshot → Demographics section (+ your own history!)
CREATE TABLE demographics_snapshots (
  account_id    BIGINT REFERENCES ig_accounts(id),
  date          DATE NOT NULL,
  audience      TEXT NOT NULL,               -- 'followers' | 'engaged'
  breakdown     TEXT NOT NULL,               -- 'age' | 'gender' | 'country' | 'city'
  key           TEXT NOT NULL,               -- '25-34', 'F', 'ES', 'Madrid'
  value         BIGINT NOT NULL,
  PRIMARY KEY (account_id, date, audience, breakdown, key)
);

-- Reports
CREATE TABLE report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, sections JSONB,                 -- toggles + order
  branding JSONB,                            -- logo url, colors, title
  schedule JSONB                             -- {cron:'0 8 1 * *', email:'...'} | null
);
CREATE TABLE generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES report_templates(id),
  period_start DATE, period_end DATE,
  pdf_url TEXT,                              -- Supabase Storage path
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 2
CREATE TABLE competitor_snapshots (
  username TEXT, date DATE,
  followers INT, media_count INT,
  avg_likes NUMERIC, avg_comments NUMERIC,
  PRIMARY KEY (username, date)
);
```

### Derived metrics (computed in SQL/API layer — never stored)

| Metric | Formula (Metricool-equivalent) |
|---|---|
| Engagement rate (account, period) | `Σ organic interactions on posts ÷ Σ organic reach of posts × 100` |
| Engagement rate (single post) | `(likes + comments + saved + shares) ÷ reach × 100` |
| Followers balance (day) | `followers(d) − followers(d−1)`, cross-checked with `follows_and_unfollows` |
| Avg reach/post | `Σ reach of posts in period ÷ post count` |
| Reel retention % | `ig_reels_avg_watch_time ÷ (duration_s × 1000) × 100` |
| Story exit rate | `navigation:tap_exit ÷ views × 100` |
| Hashtag stats | group posts by `unnest(hashtags)` → count, Σviews, avg likes/comments |
| Best-time heatmap cell | `avg(reach)` of posts where `extract(dow/hour from published_at)` matches |
| Period comparison Δ% | `(current − previous) ÷ previous × 100` (previous = same-length window immediately before) |

---

## 6. N8N workflows (the ETL layer)

Each workflow = Schedule Trigger → HTTP Request node(s) against `https://graph.instagram.com/v23.0/...` (or graph.facebook.com for the FB-login flavor) → transform in a Code node → Postgres upsert node. All idempotent (upserts, never inserts) so re-runs are safe.

| # | Workflow | Schedule | What it does |
|---|---|---|---|
| W1 | `daily-account-etl` | daily 04:00 | Fetch profile snapshot (§3.2-A) → `daily_account_snapshots`. Fetch account insights for **yesterday** with all breakdowns (§3.2-B) → `daily_account_insights`. |
| W2 | `media-sync` | every 6 h | Fetch media list (§3.2-D); upsert new items into `media` (parse hashtags, fetch reel duration). Then fetch insights (§3.2-E) for every media item **< 7 days old** (covers the 48 h lag) → upsert `media_insights`. Weekly sub-branch: refresh insights for all media < 90 days old (long-tail growth). |
| W3 | `story-poller` | every 3 h | `GET /{ig-user-id}/stories` → for each live story: upsert into `media` (STORY) + fetch story insights → `media_insights`. This is the workflow that must never be down. |
| W4 | `demographics-snapshot` | weekly Mon 05:00 | 8 calls (2 audiences × 4 breakdowns, §3.2-C) → `demographics_snapshots`. |
| W5 | `token-refresh` | weekly | If `token_expires_at < now()+14d`: call the refresh endpoint, update `ig_accounts`. On failure: email/Telegram alert immediately. |
| W6 | `report-scheduler` | daily 07:00 | For each `report_templates.schedule` due today: `POST {VERCEL_URL}/api/reports/generate` (template id + period) → receives PDF URL → email it (Gmail/Resend node) → log to `generated_reports`. |
| W0 | `backfill` (manual, run once) | manual | Loop account insights in 30-day chunks back 90 days; paginate full media history + insights. Populates the DB on day one. |

Error handling: a shared error workflow (N8N "Error Workflow" setting) that notifies you on any failure — silent ETL gaps are the classic way these dashboards rot.

---

## 7. Dashboard app (Next.js on Vercel)

- **Stack**: Next.js (App Router) + TypeScript + Tailwind + **Recharts** (line/bar/heatmap) + TanStack Table (sortable media tables) + Supabase JS client (server-side only). Simple password/Supabase Auth gate (it's your private data).
- **Global UI**: date-range picker (presets: 7/30/90 days, this month, last month, custom) + "compare with previous period" toggle — every widget receives `{from, to, compare}`.

| Route | Metricool equivalent | Widgets |
|---|---|---|
| `/dashboard` | Overview | KPI tiles with Δ% (followers, reach, views, interactions, engagement), mini charts |
| `/dashboard/community` | Community | Followers evolution line, balance bars, growth tiles |
| `/dashboard/demographics` | Demographics | Gender donut, age bars, country/city ranked lists (+ evolution from your snapshots — a feature Metricool doesn't have) |
| `/dashboard/account` | Account | Reach & views daily lines, interactions stacked bars, views breakdown (followers vs non, by content type), profile taps |
| `/dashboard/posts` | Posts | Summary tiles, interactions block, type donut, posts table, hashtag table, best-time heatmap |
| `/dashboard/reels` | Reels | Summary tiles, reels table incl. watch time & retention |
| `/dashboard/stories` | Stories | Evolution chart, stories table with navigation metrics |
| `/reports` | Reports | Template list/editor (section toggles, branding, schedule), generated-report history |
| `/report/[id]/print` | — | Server-rendered print-layout page consumed by the PDF engine |

**API routes** (all read-only against Postgres): `/api/summary`, `/api/community`, `/api/demographics`, `/api/account`, `/api/media?type=FEED|REELS|STORY`, `/api/hashtags`, `/api/heatmap` — each accepting `from`,`to`,`compare`. Plus `/api/reports/generate` (POST, secured with a bearer secret shared with N8N).

## 8. Report generation (PDF)

Pipeline: `/api/reports/generate` → renders `/report/[id]/print?from&to` with **Puppeteer-core + @sparticuz/chromium** (works on Vercel serverless; set function memory 1536 MB+) → `page.pdf({format:'A4'})` → upload to Supabase Storage → return URL. N8N W6 emails it.
- Report layout = cover page (logo, account, period) → one page per enabled section, reusing the same chart components as the dashboard (print CSS).
- Fallback if Puppeteer on Vercel fights you: render PDF in N8N via Gotenberg, or use `@react-pdf/renderer` (charts as SVG). Puppeteer route is closest to Metricool's "dashboard-as-PDF" look.

---

## 9. Repo, CI/CD, secrets

```
ig-analytics/
├── app/                    # Next.js routes (dashboard, reports, api)
├── components/charts/      # shared dashboard+PDF chart components
├── lib/                    # db client, queries/, derived-metric functions
├── db/migrations/          # SQL from §5 (run via supabase CLI)
├── n8n/                    # exported workflow JSONs (W0–W6) — version them!
├── docs/                   # this file
└── .github/workflows/ci.yml  # lint + typecheck + build on PR
```
- GitHub → Vercel integration: push to `main` deploys; PRs get preview URLs.
- Env vars (Vercel + N8N credentials store — never in git): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `META_APP_ID`, `META_APP_SECRET`, `IG_USER_ID`, `IG_ACCESS_TOKEN` (N8N only), `REPORT_API_SECRET`, `RESEND_API_KEY`.

## 10. Build plan (phases for Claude Code)

1. **Foundation** — repo, Next.js scaffold, Supabase project, run migrations, Vercel + GitHub wiring. *Done when a hello-world deploys on push.*
2. **Meta plumbing** — create Meta app, get long-lived token, verify every §3.2 call in curl/Postman against your real account. *Done when all endpoints return data.*
3. **ETL** — build W0 backfill + W1–W5 in N8N. *Done when the DB has 90 days of account history, full media history, and a story captured end-to-end.*
4. **Dashboard** — API routes + the seven dashboard pages, section by section (community → account → posts → reels → stories → demographics → heatmap/hashtags). *Done when it matches the §2 inventory against a Metricool trial side-by-side.*
5. **Reports** — print view, PDF endpoint, template editor, W6 scheduler + email. *Done when the monthly report lands in your inbox unattended.*
6. **Phase 2 (optional)** — competitors via business_discovery, engaged-audience demographics, Meta Ads paid columns.

## 11. Known limitations vs Metricool (accept these up front)

- **History starts at first backfill** (max 90 days back for account insights; media insights only since the account became Business). Metricool has the same constraint — it just connected earlier.
- No paid/ads columns until you integrate the Marketing API (phase 2+).
- Story `replies` = 0 for EU/Japan viewers (API privacy rule — affects Metricool too).
- Demographics have no official history (but your weekly snapshots build one going forward).
- `online_followers`-based best-time data may be unavailable; the own-performance heatmap is the reliable substitute.
- Competitor data limited to public counts (followers, likes, comments) — same as Metricool.

---
*Sources: Metricool help center (Instagram metrics guide), Meta Instagram Platform docs (user insights, media insights, insights overview), current as of July 2026. Verify exact metric availability against the live API version (v23.0+) during Phase 2.*
