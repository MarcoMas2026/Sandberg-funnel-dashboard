import { MediaItem } from "./types";

export interface DaySeriesPoint {
  date: string;
  count: number;
  reach: number;
  views: number;
  interactions: number;
}

// Buckets a list of posts/reels by publish day for the "published in period" combo
// charts (bars = views, lines = avg reach / interactions). total_interactions is
// preferred (reels carry it directly); FEED items fall back to summing the four
// organic actions since Meta doesn't always populate total_interactions for posts.
export function bucketMediaByDay(items: MediaItem[]): DaySeriesPoint[] {
  const byDate = new Map<string, DaySeriesPoint>();
  for (const item of items) {
    const date = item.publishedAt.slice(0, 10);
    const entry = byDate.get(date) ?? { date, count: 0, reach: 0, views: 0, interactions: 0 };
    const interactions =
      item.metrics.total_interactions ??
      (item.metrics.likes ?? 0) + (item.metrics.comments ?? 0) + (item.metrics.saved ?? 0) + (item.metrics.shares ?? 0);
    entry.count += 1;
    entry.reach += item.metrics.reach ?? 0;
    entry.views += item.metrics.views ?? 0;
    entry.interactions += interactions;
    byDate.set(date, entry);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
