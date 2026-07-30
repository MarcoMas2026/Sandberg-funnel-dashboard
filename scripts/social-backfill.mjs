// One-time historical backfill for the /social module (Instagram Analytics).
// Run once: node --env-file=.env.local scripts/social-backfill.mjs
//
// Ongoing daily accumulation is already handled by the live n8n workflows
// (W1-W6, see n8n/social-workflows.md) — this script only exists to seed the
// last 30 days of account insights and existing post/reel media so charts
// aren't empty while waiting for W1-W6 to accumulate day by day.
//
// What this CANNOT backfill (fundamental Graph API limits, not a bug here):
//   - Historical daily follower counts: there is no "followers on date X"
//     endpoint. Only today's snapshot is written; history starts accumulating
//     from today via W1.
//   - Stories: insights only queryable while the story is live (~24h) — any
//     story older than that is gone forever, backfill or not.
//
// See ~/Downloads/ANALYTICS_PLATFORM_ARCHITECTURE.md §3.2 for the endpoint
// reference this mirrors, and n8n/social-workflows.md for what the daily
// pipeline actually writes ongoing (so backfilled days have the same shape).

const GRAPH = "https://graph.facebook.com/v23.0";
const IG_USER_ID = process.env.IG_USER_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BACKFILL_DAYS = 30;

if (!IG_USER_ID || !IG_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing required env vars. Need IG_USER_ID, IG_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local)."
  );
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function graphGet(path, params) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("access_token", IG_ACCESS_TOKEN);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `HTTP ${res.status} on ${path}`);
  }
  return json;
}

function toUnix(dateStr) {
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
}

function dateNDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 1. Account row + today's profile snapshot (the only real snapshot we can get)

async function backfillAccount() {
  const profile = await graphGet(`/${IG_USER_ID}`, {
    fields: "username,followers_count,follows_count,media_count",
  });

  const { error: acctErr } = await supabase.from("ig_accounts").upsert(
    {
      id: IG_USER_ID,
      username: profile.username,
      access_token: IG_ACCESS_TOKEN,
    },
    { onConflict: "id" }
  );
  if (acctErr) errors.push(`ig_accounts upsert: ${acctErr.message}`);

  const today = new Date().toISOString().slice(0, 10);
  const { error: snapErr } = await supabase.from("daily_account_snapshots").upsert(
    {
      account_id: IG_USER_ID,
      date: today,
      followers: profile.followers_count,
      following: profile.follows_count,
      media_count: profile.media_count,
    },
    { onConflict: "account_id,date" }
  );
  if (snapErr) errors.push(`daily_account_snapshots upsert (${today}): ${snapErr.message}`);

  console.log(`Account: @${profile.username} — wrote today's snapshot (${today}).`);
  console.log(
    `  (Historical daily follower counts before today can't be backfilled — no such endpoint exists. History starts accumulating from today via n8n W1.)`
  );
}

// ---------------------------------------------------------------------------
// 2. Account insights, day by day, for the last 30 days
//    Mirrors what W1 actually writes today (core metrics, no breakdowns yet —
//    see "known gaps" in n8n/social-workflows.md) so backfilled rows have the
//    same shape as what accumulates going forward.

const CORE_METRICS = [
  "reach",
  "views",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "replies",
  "reposts",
];

async function backfillAccountInsights() {
  let daysWritten = 0;
  for (let n = BACKFILL_DAYS; n >= 1; n--) {
    const date = dateNDaysAgo(n);
    const since = toUnix(date);
    const until = since + 86400;

    try {
      const json = await graphGet(`/${IG_USER_ID}/insights`, {
        metric: CORE_METRICS.join(","),
        period: "day",
        metric_type: "total_value",
        since,
        until,
      });

      const rows = (json.data ?? []).map((m) => ({
        account_id: IG_USER_ID,
        date,
        metric: m.name,
        breakdown_key: "",
        value: m.total_value?.value ?? 0,
      }));

      if (rows.length) {
        const { error } = await supabase
          .from("daily_account_insights")
          .upsert(rows, { onConflict: "account_id,date,metric,breakdown_key" });
        if (error) errors.push(`daily_account_insights upsert (${date}): ${error.message}`);
        else daysWritten++;
      }
    } catch (e) {
      errors.push(`account insights fetch (${date}): ${e.message}`);
    }

    await sleep(250); // be polite to the API — 30 sequential calls, no rate-limit concern at this volume
  }
  console.log(`Account insights: wrote ${daysWritten}/${BACKFILL_DAYS} days.`);
}

// ---------------------------------------------------------------------------
// 3. Media (posts + reels) published in the last 30 days, plus their insights.
//    Stories are skipped — gone after ~24h, unrecoverable regardless.

function parseHashtags(caption) {
  if (!caption) return [];
  return Array.from(new Set((caption.match(/#[\w]+/g) ?? []).map((h) => h.slice(1))));
}

async function fetchAllRecentMedia() {
  const cutoff = new Date(Date.now() - BACKFILL_DAYS * 86400000);
  const items = [];
  let url = `${GRAPH}/${IG_USER_ID}/media`;
  let params = {
    fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp",
    limit: 50,
  };

  while (url) {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    if (!u.searchParams.has("access_token")) u.searchParams.set("access_token", IG_ACCESS_TOKEN);
    const res = await fetch(u);
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error?.message || `HTTP ${res.status} on media list`);

    let hitCutoff = false;
    for (const item of json.data ?? []) {
      if (new Date(item.timestamp) < cutoff) {
        hitCutoff = true;
        break;
      }
      if (item.media_product_type === "FEED" || item.media_product_type === "REELS") {
        items.push(item);
      }
    }
    if (hitCutoff || !json.paging?.next) break;
    url = json.paging.next;
    params = {}; // paging.next is a full URL already carrying params + token
    await sleep(200);
  }
  return items;
}

async function backfillMedia() {
  let items;
  try {
    items = await fetchAllRecentMedia();
  } catch (e) {
    errors.push(`media list fetch: ${e.message}`);
    console.log("Media: skipped (list fetch failed — see errors below).");
    return;
  }

  console.log(`Media: found ${items.length} posts/reels from the last ${BACKFILL_DAYS} days.`);

  let mediaWritten = 0;
  let insightsWritten = 0;

  for (const item of items) {
    const { error: mediaErr } = await supabase.from("media").upsert(
      {
        id: item.id,
        account_id: IG_USER_ID,
        product_type: item.media_product_type,
        media_type: item.media_type,
        caption: item.caption ?? null,
        hashtags: parseHashtags(item.caption),
        permalink: item.permalink ?? null,
        thumbnail_url: item.thumbnail_url ?? null,
        published_at: item.timestamp,
      },
      { onConflict: "id" }
    );
    if (mediaErr) {
      errors.push(`media upsert (${item.id}): ${mediaErr.message}`);
      continue;
    }
    mediaWritten++;

    const metrics =
      item.media_product_type === "REELS"
        ? "reach,views,likes,comments,saved,shares,total_interactions,ig_reels_avg_watch_time"
        : "reach,views,likes,comments,saved,shares,total_interactions";

    try {
      const insights = await graphGet(`/${item.id}/insights`, { metric: metrics });
      const rows = (insights.data ?? []).map((m) => ({
        media_id: item.id,
        metric: m.name,
        value: m.values?.[0]?.value ?? m.total_value?.value ?? 0,
      }));
      if (rows.length) {
        const { error } = await supabase
          .from("media_insights")
          .upsert(rows, { onConflict: "media_id,metric" });
        if (error) errors.push(`media_insights upsert (${item.id}): ${error.message}`);
        else insightsWritten++;
      }
    } catch (e) {
      errors.push(`media insights fetch (${item.id}): ${e.message}`);
    }

    await sleep(300);
  }

  console.log(`Media: wrote ${mediaWritten}/${items.length} items, insights for ${insightsWritten}.`);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`Starting one-time social backfill (last ${BACKFILL_DAYS} days)...\n`);
  await backfillAccount();
  await backfillAccountInsights();
  await backfillMedia();

  console.log("\nDone.");
  if (errors.length) {
    console.log(`\n${errors.length} error(s) occurred (partial data may still be usable):`);
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 1;
  }
}

main();
