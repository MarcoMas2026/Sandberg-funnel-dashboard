import { getFunnelData } from "@/lib/kv";
import { getPortfolioComparison } from "@/lib/history/db";
import { todayISOMadrid } from "@/lib/format";
import { AGENT_ROSTER } from "@/lib/agents";
import { applyBaselineToCampaign } from "@/lib/test-attribution";
import { countLiveAds, getAdsetLanes } from "@/lib/live-adsets";
import { getLiveAssets, type LiveAssets, type LiveCreative } from "@/lib/live-grid-assets";

export interface LiveAgent {
  name: string;
  slug: string;
  photo: string; // head-and-shoulders crop in public/team-avatars
}

// Letters-only key so "Anne-Sophie Kayrak" / "Anne Sophie Kayrak" match.
export const agentSlug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");

// Whole listing-agent roster (not just agents with a live campaign), for the Live Grid filter.
export const LIVE_AGENTS: LiveAgent[] = AGENT_ROSTER.map((name) => ({
  name,
  slug: agentSlug(name),
  photo: `/team-avatars/${agentSlug(name)}.jpg`,
})).sort((a, b) => a.name.localeCompare(b.name));

export interface LiveLane {
  label: string | null; // "ENG" | "DEU" | ... — null for a single-ad campaign
  creatives: LiveCreative[]; // every video/static launched for this lane — all of them land on `landingUrl`
  impressions: number;
  ctr: number; // 0..1
  landingUrl: string | null;
  linkClicks: number;
  typeformStarts: number;
  leads: number;
  estimatedStarts?: boolean; // form starts apportioned between ad sets that share a form
}

export interface LiveProperty {
  id: string;
  property: string;
  ref: string;
  spend: number;
  cpl: number;
  daysLive: number | null; // whole days since the Meta campaign started
  hero: string | null;
  agent: string | null;
  agentPhoto: string | null;
  askingPrice: number | null;
  lanes: LiveLane[];
}

// Assets are keyed by ref; a campaign without one (e.g. Sa Cantolina) uses its property slug.
export const assetKey = (c: { ref: string; property: string }) => c.ref || c.property.replace(/^SP\s*-\s*/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function creativesFor(assets: LiveAssets | undefined, langKey: string): LiveCreative[] {
  const list = assets?.creatives?.[langKey];
  if (list?.length) return list;
  const v = assets?.videos[langKey] ?? assets?.videos.ENG;
  return v ? [{ kind: "video", label: "", ...v }] : [];
}

// Server-side reduction of funnel:merged to only what the Live Grid displays,
// so the shareable /live page never ships the full portfolio payload.
export async function getLiveProperties(): Promise<{ properties: LiveProperty[]; lastUpdated: string | null; liveAds: number | null }> {
  try {
    const [data, liveAssets] = await Promise.all([getFunnelData(), getLiveAssets()]);
    // Adds the finished 3-5M test's per-ad share to its four properties (display only).
    const live = data.campaigns.filter((c) => c.status === "ACTIVE" && c.campaign_type === "property").map(applyBaselineToCampaign);
    const [adsetLanes, liveAds] = await Promise.all([getAdsetLanes(live), countLiveAds(new Set(live.map((c) => c.campaign_id)))]);
    const properties = live
      .map((c): LiveProperty => {
        const assets = liveAssets[assetKey(c)];
        // One lane per ad set / language variant; a single-audience campaign is one unlabeled lane.
        const sources = c.variants?.length
          ? c.variants.map((v) => ({ key: v.key as string | null, meta: v.meta, tf: v.typeform }))
          : [{ key: null as string | null, meta: c.meta, tf: c.typeform }];
        const perAdset = adsetLanes[c.campaign_id];
        const lanes = perAdset
          ? perAdset.map((l): LiveLane => ({
              label: l.label,
              creatives: creativesFor(assets, l.langKey),
              impressions: l.impressions,
              ctr: l.ctr,
              landingUrl: assets ? (assets.landings[l.langKey] ?? assets.landings.default) : null,
              linkClicks: l.linkClicks,
              typeformStarts: l.typeformStarts,
              leads: l.leads,
              estimatedStarts: l.estimatedStarts,
            }))
          : sources.map((s): LiveLane => ({
          label: s.key,
          creatives: creativesFor(assets, s.key ?? "ENG"),
          impressions: s.meta.impressions,
          ctr: s.meta.ctr,
          landingUrl: assets ? (assets.landings[s.key ?? "default"] ?? assets.landings.default) : null,
          linkClicks: s.meta.link_clicks,
          typeformStarts: s.tf.starts,
          leads: s.tf.completions,
        }));
        return {
          id: c.campaign_id,
          property: c.property,
          ref: c.ref,
          spend: c.meta.spend,
          cpl: c.meta.cpl,
          daysLive: c.meta.start_date ? Math.max(0, Math.floor((Date.now() - new Date(c.meta.start_date).getTime()) / 86_400_000)) : null,
          hero: assets?.hero ?? null,
          agent: assets?.agent ?? null,
          agentPhoto: assets?.agentPhoto ?? null,
          askingPrice: assets?.askingPrice ?? null,
          lanes,
        };
      });
    return { properties, lastUpdated: data.last_updated, liveAds };
  } catch {
    return { properties: [], lastUpdated: null, liveAds: null };
  }
}

export interface LiveMonthSummary {
  monthLabel: string; // e.g. "September"
  spend: number;
  leads: number;
  cpl: number | null;
  // % change vs the previous calendar month (null = no comparable data)
  deltas: { spendPct: number | null; leadsPct: number | null; cplPct: number | null };
}

// Current calendar month (Madrid), portfolio-wide across all campaigns — same source as
// Mission Control's KPI cards (funnel_daily_history in Supabase), so the numbers match.
export async function getLiveMonthSummary(): Promise<LiveMonthSummary | null> {
  try {
    const [year, month] = todayISOMadrid().split("-").map(Number);
    const cmp = await getPortfolioComparison(year, month);
    if (!cmp.current.connected) return null;
    return {
      monthLabel: new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long" }),
      spend: cmp.current.spend,
      leads: cmp.current.leads,
      cpl: cmp.current.cpl,
      deltas: cmp.deltaVsPreviousMonth,
    };
  } catch {
    return null;
  }
}
