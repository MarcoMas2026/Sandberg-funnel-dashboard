import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  AccountData,
  CommunityData,
  CompetitorsData,
  DateRange,
  DemographicsData,
  HashtagsData,
  HeatmapData,
  MediaItem,
  MediaProductType,
  PostsData,
  ReelsData,
  SocialSummaryData,
  StoriesData,
} from "./types";

// Server-only client — SUPABASE_SERVICE_ROLE_KEY must never reach the browser
// bundle (mirrors how KV_REST_API_TOKEN is server-only in lib/kv.ts). All
// queries here run through Next.js API routes, never client components.
let client: SupabaseClient | null | undefined;

export function isSocialConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!isSocialConfigured()) {
    client = null;
    return client;
  }
  client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    // Next.js patches global fetch() and caches responses by default, even for
    // route handlers marked force-dynamic in some cases — that silently serves
    // stale rows since supabase-js's PostgREST calls go through fetch(). Opt
    // every Supabase request out explicitly rather than relying on route-level config.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}

function notConnected(error = "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY") {
  return { connected: false as const, error };
}

async function getAccountId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("ig_accounts").select("id").limit(1).maybeSingle();
  return data?.id ?? null;
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export function pctDelta(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function parseRange(searchParams: URLSearchParams): DateRange {
  const to = searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const from =
    searchParams.get("from") ?? new Date(new Date(to).getTime() - 29 * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

function previousPeriod({ from, to }: DateRange): DateRange {
  const span = new Date(to).getTime() - new Date(from).getTime();
  const prevTo = new Date(new Date(from).getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Community

export async function getCommunityData(range: DateRange): Promise<CommunityData> {
  const supabase = getClient();
  if (!supabase) return { ...notConnected(), growth: [], balance: [], tiles: emptyTiles() };

  const accountId = await getAccountId(supabase);
  if (!accountId) {
    return { connected: true, growth: [], balance: [], tiles: emptyTiles(), error: "No IG account connected yet" };
  }

  const { data } = await supabase
    .from("daily_account_snapshots")
    .select("date, followers, following, media_count")
    .eq("account_id", accountId)
    .gte("date", range.from)
    .lte("date", range.to)
    .order("date", { ascending: true });

  const rows = data ?? [];
  const growth = rows.map((r) => ({
    date: r.date,
    followers: r.followers ?? 0,
    following: r.following ?? 0,
    mediaCount: r.media_count ?? 0,
  }));

  const balance = growth.map((row, i) => ({
    date: row.date,
    delta: i === 0 ? 0 : row.followers - growth[i - 1].followers,
  }));

  const first = growth[0];
  const last = growth[growth.length - 1];
  const followersGrowth = first && last ? last.followers - first.followers : 0;
  const span = daysBetween(range.from, range.to);
  const avgFollowersPerDay = followersGrowth / span;
  const postsInPeriod = first && last ? Math.max(0, last.mediaCount - first.mediaCount) : 0;
  const followersPerPost = postsInPeriod ? followersGrowth / postsInPeriod : 0;
  const postsPerDay = postsInPeriod / span;

  return {
    connected: true,
    growth,
    balance,
    tiles: { followersGrowth, avgFollowersPerDay, followersPerPost, postsPerDay },
  };
}

function emptyTiles() {
  return { followersGrowth: 0, avgFollowersPerDay: 0, followersPerPost: 0, postsPerDay: 0 };
}

// ---------------------------------------------------------------------------
// Demographics

export async function getDemographicsData(): Promise<DemographicsData> {
  const supabase = getClient();
  const empty = { snapshotDate: null, followers: [], engaged: [], meetsMinimumFollowers: false };
  if (!supabase) return { ...notConnected(), ...empty };

  const accountId = await getAccountId(supabase);
  if (!accountId) return { connected: true, ...empty, error: "No IG account connected yet" };

  // Checked independent of snapshot presence below — a missing snapshot and a
  // sub-100-follower account are two different reasons for no data, and the UI
  // needs to tell them apart rather than defaulting to "not enough followers".
  const { data: snap } = await supabase
    .from("daily_account_snapshots")
    .select("followers")
    .eq("account_id", accountId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const meetsMinimumFollowers = (snap?.followers ?? 0) >= 100;

  const { data: latestRow } = await supabase
    .from("demographics_snapshots")
    .select("date")
    .eq("account_id", accountId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRow) return { connected: true, ...empty, meetsMinimumFollowers };

  const { data } = await supabase
    .from("demographics_snapshots")
    .select("audience, breakdown, key, value")
    .eq("account_id", accountId)
    .eq("date", latestRow.date);

  const rows = data ?? [];
  const group = (audience: "followers" | "engaged") => {
    const byBreakdown = new Map<string, { key: string; value: number }[]>();
    for (const r of rows.filter((row) => row.audience === audience)) {
      const list = byBreakdown.get(r.breakdown) ?? [];
      list.push({ key: r.key, value: r.value });
      byBreakdown.set(r.breakdown, list);
    }
    return Array.from(byBreakdown.entries()).map(([breakdown, entries]) => ({
      breakdown: breakdown as "age" | "gender" | "country" | "city",
      entries,
    }));
  };

  return {
    connected: true,
    snapshotDate: latestRow.date,
    followers: group("followers"),
    engaged: group("engaged"),
    meetsMinimumFollowers,
  };
}

// ---------------------------------------------------------------------------
// Account

const INTERACTION_METRICS = ["likes", "comments", "saves", "shares", "replies", "reposts"] as const;

export async function getAccountData(range: DateRange): Promise<AccountData> {
  const supabase = getClient();
  const empty = {
    reach: [],
    views: [],
    accountsEngagedDaily: [],
    interactions: [],
    profileActivity: { accountsEngaged: 0, profileLinkTaps: [] },
    viewsBreakdown: { byFollowerType: [], byMediaProductType: [] },
  };
  if (!supabase) return { ...notConnected(), ...empty };

  const accountId = await getAccountId(supabase);
  if (!accountId) return { connected: true, ...empty, error: "No IG account connected yet" };

  const { data } = await supabase
    .from("daily_account_insights")
    .select("date, metric, breakdown_key, value")
    .eq("account_id", accountId)
    .gte("date", range.from)
    .lte("date", range.to);

  const rows = data ?? [];
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }

  const dates = Array.from(byDate.keys()).sort();
  const reach = dates.map((date) => ({
    date,
    value: sumMetric(byDate.get(date) ?? [], "reach", ""),
  }));
  const views = dates.map((date) => ({
    date,
    value: sumMetric(byDate.get(date) ?? [], "views", ""),
  }));
  const interactions = dates.map((date) => {
    const dayRows = byDate.get(date) ?? [];
    const vals = Object.fromEntries(
      INTERACTION_METRICS.map((m) => [m, sumMetric(dayRows, m, "")])
    ) as Record<(typeof INTERACTION_METRICS)[number], number>;
    return {
      date,
      likes: vals.likes,
      comments: vals.comments,
      saves: vals.saves,
      shares: vals.shares,
      replies: vals.replies,
      reposts: vals.reposts,
      total: sumMetric(dayRows, "total_interactions", ""),
    };
  });

  const accountsEngaged = rows
    .filter((r) => r.metric === "accounts_engaged")
    .reduce((s, r) => s + r.value, 0);
  const accountsEngagedDaily = dates.map((date) => ({
    date,
    value: sumMetric(byDate.get(date) ?? [], "accounts_engaged", ""),
  }));

  const profileLinkTaps = groupByBreakdown(rows, "profile_links_taps");
  const byFollowerType = groupByBreakdown(rows, "views", "follower_type:");
  const byMediaProductType = groupByBreakdown(rows, "views", "media_product_type:");

  return {
    connected: true,
    reach,
    views,
    accountsEngagedDaily,
    interactions,
    profileActivity: {
      accountsEngaged,
      profileLinkTaps: profileLinkTaps.map((e) => ({ type: e.key, value: e.value })),
    },
    viewsBreakdown: { byFollowerType, byMediaProductType },
  };
}

function sumMetric(rows: { metric: string; breakdown_key: string; value: number }[], metric: string, breakdownPrefix: string) {
  return rows
    .filter((r) => r.metric === metric && r.breakdown_key.startsWith(breakdownPrefix))
    .reduce((s, r) => s + r.value, 0);
}

function groupByBreakdown(
  rows: { metric: string; breakdown_key: string; value: number }[],
  metric: string,
  prefix = ""
) {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.metric !== metric || !r.breakdown_key.startsWith(prefix) || r.breakdown_key === "") continue;
    const key = r.breakdown_key.slice(prefix.length).replace(/^[a-z_]+:/, "");
    map.set(key, (map.get(key) ?? 0) + r.value);
  }
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}

// ---------------------------------------------------------------------------
// Media (posts / reels / stories share the same fetch)

async function fetchMediaWithInsights(
  supabase: SupabaseClient,
  accountId: string,
  productType: MediaProductType,
  range: DateRange
): Promise<MediaItem[]> {
  const { data: mediaRows } = await supabase
    .from("media")
    .select("id, product_type, media_type, caption, hashtags, permalink, thumbnail_url, published_at, duration_s")
    .eq("account_id", accountId)
    .eq("product_type", productType)
    .gte("published_at", `${range.from}T00:00:00Z`)
    .lte("published_at", `${range.to}T23:59:59Z`)
    .order("published_at", { ascending: false });

  const media = mediaRows ?? [];
  if (media.length === 0) return [];

  const ids = media.map((m) => m.id);
  const { data: insightRows } = await supabase
    .from("media_insights")
    .select("media_id, metric, value")
    .in("media_id", ids);

  const insightsByMedia = new Map<string, Record<string, number>>();
  for (const r of insightRows ?? []) {
    const map = insightsByMedia.get(r.media_id) ?? {};
    map[r.metric] = r.value;
    insightsByMedia.set(r.media_id, map);
  }

  return media.map((m) => {
    const metrics = insightsByMedia.get(m.id) ?? {};
    const reach = metrics.reach ?? 0;
    const interactionSum = (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.saved ?? 0) + (metrics.shares ?? 0);
    return {
      id: m.id,
      productType: m.product_type as MediaProductType,
      mediaType: m.media_type,
      caption: m.caption,
      hashtags: m.hashtags ?? [],
      permalink: m.permalink,
      thumbnailUrl: m.thumbnail_url,
      publishedAt: m.published_at,
      durationS: m.duration_s,
      metrics,
      engagementRate: reach ? (interactionSum / reach) * 100 : null,
    };
  });
}

export async function getPostsData(range: DateRange): Promise<PostsData> {
  const supabase = getClient();
  const empty = {
    tiles: { engagementRate: 0, totalInteractions: 0, avgReachPerPost: 0, totalViews: 0, postCount: 0 },
    interactions: { likes: 0, comments: 0, saved: 0, shares: 0 },
    typeDistribution: { image: 0, carousel: 0 },
    items: [],
  };
  if (!supabase) return { ...notConnected(), ...empty };
  const accountId = await getAccountId(supabase);
  if (!accountId) return { connected: true, ...empty, error: "No IG account connected yet" };

  const items = await fetchMediaWithInsights(supabase, accountId, "FEED", range);
  const totalReach = items.reduce((s, i) => s + (i.metrics.reach ?? 0), 0);
  const totalViews = items.reduce((s, i) => s + (i.metrics.views ?? 0), 0);
  const likes = items.reduce((s, i) => s + (i.metrics.likes ?? 0), 0);
  const comments = items.reduce((s, i) => s + (i.metrics.comments ?? 0), 0);
  const saved = items.reduce((s, i) => s + (i.metrics.saved ?? 0), 0);
  const shares = items.reduce((s, i) => s + (i.metrics.shares ?? 0), 0);
  const totalInteractions = likes + comments + saved + shares;
  const image = items.filter((i) => i.mediaType === "IMAGE" || i.mediaType === "VIDEO").length;
  const carousel = items.filter((i) => i.mediaType === "CAROUSEL_ALBUM").length;

  return {
    connected: true,
    tiles: {
      engagementRate: totalReach ? (totalInteractions / totalReach) * 100 : 0,
      totalInteractions,
      avgReachPerPost: items.length ? totalReach / items.length : 0,
      totalViews,
      postCount: items.length,
    },
    interactions: { likes, comments, saved, shares },
    typeDistribution: { image, carousel },
    items,
  };
}

export async function getReelsData(range: DateRange): Promise<ReelsData> {
  const supabase = getClient();
  if (!supabase)
    return {
      ...notConnected(),
      tiles: { engagementRate: 0, totalInteractions: 0, avgReachPerReel: 0, totalViews: 0, reelCount: 0 },
      items: [],
    };
  const accountId = await getAccountId(supabase);
  if (!accountId)
    return {
      connected: true,
      error: "No IG account connected yet",
      tiles: { engagementRate: 0, totalInteractions: 0, avgReachPerReel: 0, totalViews: 0, reelCount: 0 },
      items: [],
    };

  const items = await fetchMediaWithInsights(supabase, accountId, "REELS", range);
  const totalReach = items.reduce((s, i) => s + (i.metrics.reach ?? 0), 0);
  const totalViews = items.reduce((s, i) => s + (i.metrics.views ?? 0), 0);
  const totalInteractions = items.reduce((s, i) => s + (i.metrics.total_interactions ?? 0), 0);

  const withRetention = items.map((i) => {
    const avgWatchMs = i.metrics.ig_reels_avg_watch_time ?? null;
    const avgWatchTimeS = avgWatchMs !== null ? avgWatchMs / 1000 : null;
    const retentionPct =
      avgWatchMs !== null && i.durationS ? (avgWatchMs / (i.durationS * 1000)) * 100 : null;
    const skipRate = i.metrics.reels_skip_rate ?? null;
    return { ...i, avgWatchTimeS, retentionPct, skipRate };
  });

  return {
    connected: true,
    tiles: {
      engagementRate: totalReach ? (totalInteractions / totalReach) * 100 : 0,
      totalInteractions,
      avgReachPerReel: items.length ? totalReach / items.length : 0,
      totalViews,
      reelCount: items.length,
    },
    items: withRetention,
  };
}

export async function getStoriesData(range: DateRange): Promise<StoriesData> {
  const supabase = getClient();
  if (!supabase) return { ...notConnected(), evolution: [], items: [] };
  const accountId = await getAccountId(supabase);
  if (!accountId) return { connected: true, error: "No IG account connected yet", evolution: [], items: [] };

  const items = await fetchMediaWithInsights(supabase, accountId, "STORY", range);

  const withExit = items.map((i) => {
    const views = i.metrics.views ?? 0;
    const tapExit = i.metrics["navigation:tap_exit"] ?? 0;
    return { ...i, exitRatePct: views ? (tapExit / views) * 100 : null };
  });

  const byDate = new Map<string, { views: number; reach: number; count: number }>();
  for (const i of items) {
    const date = i.publishedAt.slice(0, 10);
    const entry = byDate.get(date) ?? { views: 0, reach: 0, count: 0 };
    entry.views += i.metrics.views ?? 0;
    entry.reach += i.metrics.reach ?? 0;
    entry.count += 1;
    byDate.set(date, entry);
  }
  const evolution = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, e]) => ({ date, views: e.views, avgReach: e.count ? e.reach / e.count : 0, count: e.count }));

  return { connected: true, evolution, items: withExit };
}

// ---------------------------------------------------------------------------
// Hashtags (derived from own FEED + REELS captions)

export async function getHashtagsData(range: DateRange): Promise<HashtagsData> {
  const supabase = getClient();
  if (!supabase) return { ...notConnected(), hashtags: [] };
  const accountId = await getAccountId(supabase);
  if (!accountId) return { connected: true, error: "No IG account connected yet", hashtags: [] };

  const [posts, reels] = await Promise.all([
    fetchMediaWithInsights(supabase, accountId, "FEED", range),
    fetchMediaWithInsights(supabase, accountId, "REELS", range),
  ]);
  const items = [...posts, ...reels];

  const byTag = new Map<string, { posts: number; views: number; likes: number; comments: number }>();
  for (const item of items) {
    for (const tag of item.hashtags) {
      const e = byTag.get(tag) ?? { posts: 0, views: 0, likes: 0, comments: 0 };
      e.posts += 1;
      e.views += item.metrics.views ?? 0;
      e.likes += item.metrics.likes ?? 0;
      e.comments += item.metrics.comments ?? 0;
      byTag.set(tag, e);
    }
  }

  const hashtags = Array.from(byTag.entries())
    .map(([hashtag, e]) => ({
      hashtag,
      posts: e.posts,
      totalViews: e.views,
      avgLikes: e.posts ? e.likes / e.posts : 0,
      avgComments: e.posts ? e.comments / e.posts : 0,
    }))
    .sort((a, b) => b.totalViews - a.totalViews);

  return { connected: true, hashtags };
}

// ---------------------------------------------------------------------------
// Best-time-to-post heatmap (own performance, 7x24)

export async function getHeatmapData(): Promise<HeatmapData> {
  const supabase = getClient();
  if (!supabase) return { ...notConnected(), cells: [] };
  const accountId = await getAccountId(supabase);
  if (!accountId) return { connected: true, error: "No IG account connected yet", cells: [] };

  // Own-performance heatmap uses all historical media, not just the selected range.
  const range: DateRange = { from: "2000-01-01", to: new Date().toISOString().slice(0, 10) };
  const [posts, reels] = await Promise.all([
    fetchMediaWithInsights(supabase, accountId, "FEED", range),
    fetchMediaWithInsights(supabase, accountId, "REELS", range),
  ]);
  const items = [...posts, ...reels];

  const buckets = new Map<string, { reach: number; engagement: number; n: number }>();
  for (const item of items) {
    const d = new Date(item.publishedAt);
    const key = `${d.getUTCDay()}:${d.getUTCHours()}`;
    const e = buckets.get(key) ?? { reach: 0, engagement: 0, n: 0 };
    e.reach += item.metrics.reach ?? 0;
    e.engagement += item.engagementRate ?? 0;
    e.n += 1;
    buckets.set(key, e);
  }

  const cells = Array.from(buckets.entries()).map(([key, e]) => {
    const [weekday, hour] = key.split(":").map(Number);
    return { weekday, hour, avgReach: e.n ? e.reach / e.n : 0, avgEngagement: e.n ? e.engagement / e.n : 0, sampleSize: e.n };
  });

  return { connected: true, cells };
}

// ---------------------------------------------------------------------------
// Competitors

export async function getCompetitorsData(): Promise<CompetitorsData> {
  const supabase = getClient();
  if (!supabase) return { ...notConnected(), competitors: [] };

  const { data } = await supabase
    .from("competitor_snapshots")
    .select("username, date, followers, media_count, avg_likes, avg_comments")
    .order("date", { ascending: true });

  const rows = data ?? [];
  const byUsername = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byUsername.get(r.username) ?? [];
    list.push(r);
    byUsername.set(r.username, list);
  }

  const competitors = Array.from(byUsername.entries()).map(([username, history]) => {
    const latestRow = history[history.length - 1] ?? null;
    const thirtyAgoIdx = Math.max(0, history.length - 31);
    const thirtyAgoRow = history[thirtyAgoIdx] ?? null;
    return {
      username,
      latest: latestRow
        ? {
            date: latestRow.date,
            followers: latestRow.followers ?? 0,
            mediaCount: latestRow.media_count ?? 0,
            avgLikes: latestRow.avg_likes ?? 0,
            avgComments: latestRow.avg_comments ?? 0,
          }
        : null,
      followersDelta30d:
        latestRow && thirtyAgoRow ? (latestRow.followers ?? 0) - (thirtyAgoRow.followers ?? 0) : null,
      history: history.map((r) => ({ date: r.date, followers: r.followers ?? 0 })),
    };
  });

  return { connected: true, competitors };
}

// ---------------------------------------------------------------------------
// Summary (overview tiles)

export async function getSocialSummaryData(range: DateRange): Promise<SocialSummaryData> {
  const supabase = getClient();
  const emptyTilesShape = {
    followers: 0,
    followersDeltaPct: null,
    reach: 0,
    reachDeltaPct: null,
    views: 0,
    viewsDeltaPct: null,
    interactions: 0,
    interactionsDeltaPct: null,
    engagementRatePct: 0,
    engagementRateDeltaPct: null,
  };
  if (!supabase) return { ...notConnected(), username: null, tiles: emptyTilesShape };

  const accountId = await getAccountId(supabase);
  if (!accountId) return { connected: true, error: "No IG account connected yet", username: null, tiles: emptyTilesShape };

  const { data: account } = await supabase.from("ig_accounts").select("username").eq("id", accountId).maybeSingle();

  const [current, previous, currentPosts, previousPosts] = await Promise.all([
    getAccountData(range),
    getAccountData(previousPeriod(range)),
    getPostsData(range),
    getPostsData(previousPeriod(range)),
  ]);

  const { data: snapCurrent } = await supabase
    .from("daily_account_snapshots")
    .select("followers")
    .eq("account_id", accountId)
    .lte("date", range.to)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: snapPrevious } = await supabase
    .from("daily_account_snapshots")
    .select("followers")
    .eq("account_id", accountId)
    .lte("date", previousPeriod(range).to)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sumReach = (a: AccountData) => a.reach.reduce((s, p) => s + p.value, 0);
  const sumViews = (a: AccountData) => a.views.reduce((s, p) => s + p.value, 0);
  const sumInteractions = (a: AccountData) => a.interactions.reduce((s, d) => s + d.total, 0);

  return {
    connected: true,
    username: account?.username ?? null,
    tiles: {
      followers: snapCurrent?.followers ?? 0,
      followersDeltaPct: pctDelta(snapCurrent?.followers ?? 0, snapPrevious?.followers ?? 0),
      reach: sumReach(current),
      reachDeltaPct: pctDelta(sumReach(current), sumReach(previous)),
      views: sumViews(current),
      viewsDeltaPct: pctDelta(sumViews(current), sumViews(previous)),
      interactions: sumInteractions(current),
      interactionsDeltaPct: pctDelta(sumInteractions(current), sumInteractions(previous)),
      engagementRatePct: currentPosts.tiles.engagementRate,
      engagementRateDeltaPct: pctDelta(currentPosts.tiles.engagementRate, previousPosts.tiles.engagementRate),
    },
  };
}
