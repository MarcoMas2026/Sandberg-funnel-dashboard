// Instagram Analytics module types. Fully separate from lib/types.ts (funnel
// pipeline) — nothing here is read/written through lib/kv.ts.

export interface ConnectionState {
  connected: boolean;
  error?: string;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface CommunityData extends ConnectionState {
  growth: { date: string; followers: number; following: number; mediaCount: number }[];
  balance: { date: string; delta: number }[];
  tiles: {
    followersGrowth: number;
    avgFollowersPerDay: number;
    followersPerPost: number;
    postsPerDay: number;
  };
}

export interface DemographicBreakdown {
  breakdown: "age" | "gender" | "country" | "city";
  entries: { key: string; value: number }[];
}

export interface DemographicsData extends ConnectionState {
  snapshotDate: string | null;
  followers: DemographicBreakdown[];
  engaged: DemographicBreakdown[];
  meetsMinimumFollowers: boolean; // API requires >=100 followers
}

export interface InteractionsDay {
  date: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  replies: number;
  reposts: number;
  total: number;
}

export interface AccountData extends ConnectionState {
  reach: DailyPoint[];
  views: DailyPoint[];
  accountsEngagedDaily: DailyPoint[];
  interactions: InteractionsDay[];
  profileActivity: {
    accountsEngaged: number;
    profileLinkTaps: { type: string; value: number }[];
  };
  viewsBreakdown: {
    byFollowerType: { key: string; value: number }[];
    byMediaProductType: { key: string; value: number }[];
  };
}

export type MediaProductType = "FEED" | "REELS" | "STORY";

export interface MediaItem {
  id: string;
  productType: MediaProductType;
  mediaType: string | null;
  caption: string | null;
  hashtags: string[];
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedAt: string; // ISO
  durationS: number | null;
  metrics: Record<string, number>;
  engagementRate: number | null; // (likes+comments+saved+shares)/reach*100
}

export interface PostsData extends ConnectionState {
  tiles: {
    engagementRate: number;
    totalInteractions: number;
    avgReachPerPost: number;
    totalViews: number;
    postCount: number;
  };
  interactions: { likes: number; comments: number; saved: number; shares: number };
  typeDistribution: { image: number; carousel: number };
  items: MediaItem[];
}

export interface ReelsData extends ConnectionState {
  tiles: {
    engagementRate: number;
    totalInteractions: number;
    avgReachPerReel: number;
    totalViews: number;
    reelCount: number;
  };
  items: (MediaItem & { avgWatchTimeS: number | null; retentionPct: number | null; skipRate: number | null })[];
}

export interface StoriesData extends ConnectionState {
  evolution: { date: string; views: number; avgReach: number; count: number }[];
  items: (MediaItem & { exitRatePct: number | null })[];
}

export interface HashtagStat {
  hashtag: string;
  posts: number;
  totalViews: number;
  avgLikes: number;
  avgComments: number;
}

export interface HashtagsData extends ConnectionState {
  hashtags: HashtagStat[];
}

export interface HeatmapCell {
  weekday: number; // 0=Sunday..6=Saturday
  hour: number; // 0..23
  avgReach: number;
  avgEngagement: number;
  sampleSize: number;
}

export interface HeatmapData extends ConnectionState {
  cells: HeatmapCell[];
}

export interface CompetitorSummary {
  username: string;
  latest: { date: string; followers: number; mediaCount: number; avgLikes: number; avgComments: number } | null;
  followersDelta30d: number | null;
  history: { date: string; followers: number }[];
}

export interface CompetitorsData extends ConnectionState {
  competitors: CompetitorSummary[];
}

export interface SocialSummaryData extends ConnectionState {
  username: string | null;
  tiles: {
    followers: number;
    followersDeltaPct: number | null;
    reach: number;
    reachDeltaPct: number | null;
    views: number;
    viewsDeltaPct: number | null;
    interactions: number;
    interactionsDeltaPct: number | null;
    engagementRatePct: number;
    engagementRateDeltaPct: number | null;
  };
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}
