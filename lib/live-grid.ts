import { getFunnelData } from "@/lib/kv";
import { getPortfolioComparison } from "@/lib/history/db";
import { todayISOMadrid } from "@/lib/format";
import { AGENT_ROSTER } from "@/lib/agents";
import { LIVE_BASELINES } from "@/lib/live-grid-baselines";
import { getLiveAssets } from "@/lib/live-grid-assets";

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
  video: { src: string; poster: string } | null;
  impressions: number;
  ctr: number; // 0..1
  landingUrl: string | null;
  linkClicks: number;
  typeformStarts: number;
  leads: number;
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
  lanes: LiveLane[];
}

// Server-side reduction of funnel:merged to only what the Live Grid displays,
// so the shareable /live page never ships the full portfolio payload.
export async function getLiveProperties(): Promise<{ properties: LiveProperty[]; lastUpdated: string | null }> {
  try {
    const [data, liveAssets] = await Promise.all([getFunnelData(), getLiveAssets()]);
    const properties = data.campaigns
      .filter((c) => c.status === "ACTIVE" && c.campaign_type === "property")
      .map((c): LiveProperty => {
        const assets = liveAssets[c.ref];
        // One lane per ad set / language variant; a single-audience campaign is one unlabeled lane.
        const base = LIVE_BASELINES[c.ref];
        // Single-audience campaign that also ran inside the finished 3-5M test: add its ad's share.
        const overlay = (m: typeof c.meta, tf: typeof c.typeform) => {
          if (!base) return { meta: m, tf };
          const impressions = m.impressions + base.impressions;
          const clicksAll = m.impressions * m.ctr + base.clicks;
          const formUnlinked = tf.views === 0 && tf.starts === 0 && tf.completions === 0 && base.form;
          return {
            meta: {
              ...m,
              spend: m.spend + base.spend,
              impressions,
              link_clicks: m.link_clicks + base.linkClicks,
              ctr: impressions > 0 ? clicksAll / impressions : 0,
            },
            tf: formUnlinked ? { ...tf, starts: base.form!.starts, completions: base.form!.completions } : tf,
          };
        };
        const sources = c.variants?.length
          ? c.variants.map((v) => ({ key: v.key as string | null, meta: v.meta, tf: v.typeform }))
          : [{ key: null as string | null, ...overlay(c.meta, c.typeform) }];
        const lanes = sources.map((s): LiveLane => ({
          label: s.key,
          video: assets?.videos[s.key ?? "ENG"] ?? null,
          impressions: s.meta.impressions,
          ctr: s.meta.ctr,
          landingUrl: assets ? (assets.landings[s.key ?? "default"] ?? assets.landings.default) : null,
          linkClicks: s.meta.link_clicks,
          typeformStarts: s.tf.starts,
          leads: s.tf.completions,
        }));
        const totalSpend = c.meta.spend + (base?.spend ?? 0);
        const totalLeads = c.variants?.length ? c.variants.reduce((n, v) => n + v.typeform.completions, 0) : lanes[0].leads;
        const startMs = [c.meta.start_date, base?.since]
          .filter((d): d is string => Boolean(d))
          .map((d) => new Date(d).getTime());
        return {
          id: c.campaign_id,
          property: c.property,
          ref: c.ref,
          spend: totalSpend,
          cpl: base ? (totalLeads > 0 ? totalSpend / totalLeads : 0) : c.meta.cpl,
          daysLive: startMs.length ? Math.max(0, Math.floor((Date.now() - Math.min(...startMs)) / 86_400_000)) : null,
          hero: assets?.hero ?? null,
          agent: assets?.agent ?? null,
          agentPhoto: assets?.agentPhoto ?? null,
          lanes,
        };
      });
    return { properties, lastUpdated: data.last_updated };
  } catch {
    return { properties: [], lastUpdated: null };
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
