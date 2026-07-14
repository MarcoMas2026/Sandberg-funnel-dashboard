# Funnel Intelligence 2.0 — Platform Architecture

> The master plan for evolving the dashboard from a reporting tool into an AI-fueled
> paid-performance operating system. Written 2026-07-14. Constraints honored throughout:
> **zero paid APIs** (Meta Marketing API, Typeform API, Telegram Bot API, Upstash free tier,
> Vercel free tier, self-hosted n8n — all free) and **minimal Claude Code build tokens**
> (every phase reuses the patterns already proven in this repo; no new services, no new
> frameworks, no runtime LLM).

---

## 0. The thesis

Three facts define what this platform should become:

1. **Meta's Andromeda era killed manual targeting.** Meta's AI now picks audiences at the
   individual level from your *creative* — "creative is the new audience." The levers that
   remain for an advertiser are: (a) creative quality/diversity, (b) budget allocation,
   and (c) **the conversion signals you feed back to Meta**. Everything in this
   architecture aims at those three levers.
2. **The enterprise platforms of 2026 sell interpretation, not dashboards.** Anomaly
   detection with root-cause narratives, creative-fatigue detection, budget-pacing
   projections, compound lead scoring — that's the table-stakes feature set of tools
   charging $2k+/month. Every one of those is *statistics, not magic*: rolling means,
   z-scores, weighted sums. They can be computed in n8n Code nodes for free.
3. **This company owns the entire funnel.** Ad (Meta) → landing page (our repo) → form
   (our Typeform, with hidden-field attribution) → CRM (Salesforce). Most corporations
   have this fragmented across agencies and vendors. Owning every layer means we can do
   the one thing money can't easily buy: **close the loop** — teach Meta's AI what a
   *good* lead is, not just a lead.

**The one-sentence pitch:** a platform that doesn't just report cost-per-lead, but scores
every lead's quality from its own form answers, detects fatigue and anomalies before a
human would, tells you where the next €100 should go, and feeds quality signals back into
Meta so Andromeda optimizes for buyers — not form-fillers.

---

## 1. Layer map (what exists → what gets added)

```
┌────────────────────────────────────────────────────────────────────────┐
│  L5  FEEDBACK LOOP      value-based CAPI (teach Meta lead quality)     │
│  L4  AI ANALYST         Claude Code skills + rule-templated narratives │
│  L3  INTELLIGENCE       fatigue · anomalies · pacing · reallocation    │
│  L2  LEAD QUALITY       compound lead scoring · buyer demand map       │
│  L1  DATA FOUNDATION+   history snapshots · ad-level · answer-level    │
│  L0  TODAY (BUILT)      campaign sync · funnel · compare · benchmarks  │
└────────────────────────────────────────────────────────────────────────┘
```

Everything above L0 follows the same proven pattern: **n8n computes → KV stores a JSON
contract → Next.js renders it → Claude Code reasons over it on demand.** No new moving
parts, ever.

---

## 2. L1 — Data Foundation+ (the enabler; build first)

Today the pipeline keeps only the *current* state. Three cheap additions unlock every
intelligence feature above them:

### 2.1 Daily history snapshots
A scheduled n8n workflow (daily 07:00, same pattern as the meta-ads-dashboard) appends
each campaign's daily row to `history:{campaign_id}` in KV. ~1 KV command/campaign/day —
irrelevant against the 10k/day free tier. **This is the single highest-leverage build**:
lifecycle curves, anomaly baselines, fatigue trends, and pacing projections all read from
this one key.

### 2.2 Ad-level & breakdown sync
The campaign-level Meta sync gets a sibling call at the **ad level** (`/ads` edge with
`insights` + `creative{title,body,image_url,video_id}`), plus free breakdowns Meta already
computes: `age, gender, publisher_platform, platform_position,
hourly_stats_aggregated_by_advertiser_time_zone`. Written to `ads:{campaign_id}`.
In the Andromeda era this is where the real signal lives — campaign averages hide which
*creative* is carrying the campaign and which is dead weight.

### 2.3 Answer-level Typeform extraction
The Typeform sync already downloads every response; it currently only *counts* them. One
Code-node change parses each submission's answers into a buyer profile:
`{budget_range, timeline, areas[], bedrooms, features[], language, is_serious,
submitted_at, utm_campaign}` → `leads:{campaign_id}`. Zero extra API calls — the data is
already in the payload we fetch.

---

## 3. L2 — Lead Quality Engine (the differentiator)

This is the layer that makes a public company *need* the platform, and it directly solves
the problem the team already voiced: *"cheaper leads can mean less qualified leads."*

### 3.1 Compound lead score (0–100, rule-based, no LLM)
Every submission gets scored from its own answers, e.g.:

| Signal | Example weights |
|---|---|
| Budget range | <1M: 10 · 1–3M: 25 · 3–5M: 32 · >5M: 40 |
| Buying timeline | ASAP: 30 · <6mo: 22 · 6–12mo: 12 · browsing: 3 |
| "Seriously considering?" | yes: 15 · no: 0 |
| Profile completeness | up to 10 (answered optional questions) |
| Contact quality | 5 (corporate email / full phone) |

Weights live in `lib/config.ts` (the established single-source-of-truth pattern) so the
team tunes them without touching n8n. Scores are computed in the Typeform sync Code node.

### 3.2 New headline metrics (replace vanity metrics)
- **QLS (Qualified Lead Share)** — % of leads scoring ≥60.
- **CPQL⁺ (cost per quality-weighted lead)** — spend ÷ Σ(score/100). A campaign producing
  10 hot buyers beats one producing 30 browsers *in the numbers*, finally.
- Campaign page gets a **lead quality distribution** strip (cold/warm/hot) and the Compare
  ranking's composite score upgrades from raw lead count → quality-weighted leads.

### 3.3 Buyer Demand Map (the C-suite feature)
Aggregating profiles across *all* campaigns produces market intelligence no external tool
can sell them: which areas, budget bands, bedroom counts, and features Mallorca buyers are
actively demanding *this month*, from their own paid traffic. Rendered as a heatmap page.
This turns the marketing department's ad spend into a **listing-acquisition and pricing
intelligence asset for the whole company** — the moment a platform stops being a cost
center and becomes strategy infrastructure.

---

## 4. L3 — Intelligence Engines (statistics dressed as AI — because that's what they are)

All computed in the daily n8n snapshot run, written to one `insights:feed` KV key as
structured findings: `{severity, type, campaign_id, metric, evidence, recommendation,
detected_at}`. The dashboard renders them as an **Insight Feed** — the "AI analyst"
surface. Each engine is a ~50-line Code node:

### 4.1 Creative fatigue detector (per ad, not per campaign)
The 2026-standard heuristic set: 7-day rolling CTR slope negative **and** frequency
rising **and** CPM rising → fatigue score. Cross-metric correlation is exactly what
commercial fatigue tools do — no ML required at this scale. Output: *"Ad 'Pool sunset
video' fatigued: CTR −34% over 7 days while frequency hit 3.2. Rotate creative."*
In the Andromeda world this is the single most actionable alert that exists, because
creative *is* the targeting.

### 4.2 Anomaly sentinel
Day-of-week-aware rolling mean ± 2σ per metric per campaign (needs ~2 weeks of history).
Catches: CPM spikes (auction pressure), CTR cliffs, spend burn anomalies, **zero-lead days
on spending campaigns**, and tracking breaks (spend > 0 but link_clicks = 0 → pixel/page
outage — worth the entire build the first time it fires).

### 4.3 Budget pacing & reallocation advisor
Marginal CPQL⁺ per campaign over the trailing 7 days → ranked "next €100" advice:
*"Shift €15/day from Finca X (CPQL⁺ €41, fatiguing) to Anchorage (CPQL⁺ €9, stable) —
projected +11 quality leads/month."* **Advice only, human executes** — bounded autonomy
is deliberate: the token is ads_read, and recommendation-not-execution is both the safe
and the enterprise-credible design. (Auto-execution via ads_management is a possible
opt-in Phase 6; default forever-off.)

### 4.4 Lifecycle curves (predictive pacing)
From history snapshots of finished campaigns, build the median "winner curve" (CPL and
lead velocity by campaign-day) per campaign type. Every active campaign then shows
**day-N vs the winners at day-N** — the Compare feature upgraded from a static endpoint
comparison to a live trajectory: *"Day 9: you're 22% ahead of where Finca Son Llum (best
performer) was at day 9."*

### 4.5 Creative DNA library (Andromeda alignment)
From ad-level data + creative metadata, tag every creative (video/image, hook style,
duration, language) and accumulate per-tag performance across campaigns → *"video ads
with pool-first openings produce 2.1× the QLS of interior-first."* This is the
"creative strategy" layer the 2026 playbooks say now decides Meta performance. Tags are
maintained in config (a Claude Code session can tag a batch of creatives in-session when
new ones launch — zero API cost, minutes of work).

---

## 5. L4 — The AI Analyst with zero API cost

The trick that keeps this whole platform LLM-free at runtime:

1. **Narratives are rule-templated.** Every insight type has a sentence template filled
   with computed numbers (that's how most commercial "AI insights" actually work). No
   generation cost, deterministic, auditable.
2. **Claude Code (the existing Pro plan) is the on-demand brain.** The `insights:feed` is
   machine-readable *by design* so a Claude Code session can consume it. Two new skills:
   - **`/briefing`** — reads insights:feed + funnel + history, delivers the morning
     analyst readout with prioritized actions, drafts the reallocation plan.
   - **`/postmortem <campaign>`** — on campaign end: full lifecycle autopsy vs winners,
     what to replicate, auto-appends the campaign to the historical Compare pool (the
     backfill that's currently manual becomes a 1-command ritual).
3. **Push, don't poll.** The daily n8n run sends a Telegram message (free Bot API) or
   Postmark email (already paid) *only when* severity ≥ warning: the platform taps you on
   the shoulder; you open Claude Code to act. This is the 2026 "agentic" pattern with a
   human where the human belongs.

---

## 6. L5 — The Feedback Loop (the moat)

The endgame, and the piece that genuinely changes ad performance rather than reporting it:

### 6.1 Value-based CAPI (teach Andromeda what quality means)
The n8n instance **already runs Facebook CAPI workflows per property** (the FACEBOOK
CAPI - TEMPLATE lineage). Today they send "a lead happened." Upgrade: send the **lead
score as the event value** (`value: 85, currency: EUR` or a custom `lead_score` property).
Meta's Advantage+ / Andromeda then optimizes delivery toward *people who resemble
high-scoring leads* — the platform stops filtering bad leads after the fact and starts
preventing them at auction time. Cost: one field in an existing workflow. This is the
feature that top-tier agencies sell as "value-based optimization" — here it's nearly free
because the CAPI plumbing already exists.

### 6.2 Salesforce outcome loop (later)
Lead scores are a *prediction*; Salesforce knows the *truth* (viewing booked, offer made,
sold). A monthly export comparing score vs outcome recalibrates the weights — done as a
Claude Code session reading a CSV, adjusting `config.ts`. Over quarters, the score becomes
a genuinely proprietary model of "what a Mallorca luxury buyer looks like" — the kind of
data asset that survives any tool migration and that competitors cannot buy.

---

## 7. New pages (thin — they only render precomputed KV JSON)

| Page | Contents |
|---|---|
| **Insights** (new tab) | The Insight Feed: severity-sorted cards, each with evidence + recommendation; "act on this" deep-links |
| **Campaign page+** | Lead-quality strip, fatigue badge per ad, day-N winner-curve overlay, per-ad table |
| **Demand Map** (new tab) | Buyer demand heatmap: areas × budget × timeline, trend vs last month |
| **Patterns** (finally real) | Creative DNA library: per-tag performance across all campaigns |
| **Compare+** | Quality-weighted ranking; trajectory comparison replaces endpoint comparison |

---

## 8. Build economics (the least-token path)

**Principles that keep token cost near floor:**
- Compute lives in **n8n Code nodes** (edited via the REST API exactly as done 15+ times
  already in this project — the gotchas are documented in CONTEXT.md; no rediscovery cost).
- Every feature = **one KV key contract + one thin React component**. No state libraries,
  no charts beyond the Recharts patterns already in the repo.
- **No runtime LLM anywhere.** Narratives are templates; analysis is Claude-Code-on-demand.
- Each phase is **independently shippable** and ~1 session:

| Phase | Scope | Est. effort |
|---|---|---|
| 1 | History snapshots + scheduled daily run (L1.1) | ~1 short session |
| 2 | Answer extraction + lead scoring + quality UI (L1.3, L2.1–2.2) | ~1 session |
| 3 | Insight Feed: anomaly + pacing engines + Insights tab (L3.2, L3.3) | ~1 session |
| 4 | Ad-level sync + fatigue detector + per-ad UI (L1.2, L3.1) | ~1 session |
| 5 | Lifecycle curves + Compare trajectory + Demand Map (L3.4, L2.3) | ~1–2 sessions |
| 6 | Value-based CAPI + Telegram alerts + /briefing skill (L5.1, L4) | ~1 session |
| 7 | Creative DNA / Patterns tab (L3.5) | ~1 session |

**Free-tier budget check:** history snapshots + insight feed ≈ 30–60 KV commands/day vs
10,000/day free; Meta ad-level sync ≈ +2 calls/run vs effectively unlimited ads_read;
Typeform unchanged; Telegram free; Vercel static+API well within hobby tier. Headroom: >100×.

**Priority order rationale:** Phase 1 unlocks everything and costs least — nothing else
can be built without history. Phase 2 is the differentiator and needs zero new data
sources. Phase 3 delivers the daily "the platform talks to you" experience. Phases 4–7
compound on those foundations.

---

## 9. What this platform deliberately does NOT do

- **No auto-execution of budget/bid changes** (advice only; opt-in future, default off).
- **No paid LLM calls, ever** — if a feature seems to need one at runtime, the answer is
  a rule-template or a Claude Code skill instead.
- **No new lead-counting methodologies mixed silently** — the Typeform-submissions
  definition of a lead (and the verified-attribution rule for historical data) stays law.
- **No generic "AI-generated creative"** — creative *intelligence* yes (what works),
  creative *generation* belongs in the team's existing tools.
