import type { FunnelCampaign } from "@/lib/types";

// Ad-set level lanes for the Live Grid. The pipeline's merged data only splits a campaign
// by language (ENG/DEU) and folds every other ad set (e.g. a "LOCAL" targeting ad set that
// reuses the ENG video, landing and form) into those variants. This module reads the raw
// per-ad-set Meta data (KV `meta:campaigns`, written by Meta Sync) and attributes Typeform
// submissions to ad sets via the `utm_term` hidden field (= Meta ad set ID, filled in by
// the ads' dynamic URL parameters and passed through by the landing page).
//
// Limits: only COMPLETED responses carry the hidden fields — abandoned/partial ones don't —
// so leads per ad set are exact but form STARTS per ad set are estimated when ad sets share a
// form (partial starts are apportioned by link clicks). Needs TYPEFORM_API_TOKEN at runtime.

interface KvAdset {
  id: string;
  name: string;
  status?: string;
  impressions: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
}

export interface AdsetLane {
  adsetId: string;
  label: string | null;
  langKey: string; // which video / landing / form language this ad set reuses
  impressions: number;
  ctr: number;
  linkClicks: number;
  typeformStarts: number;
  leads: number;
  estimatedStarts: boolean;
}

const LANG_TOKENS: Record<string, string> = { ENG: "ENG", EN: "ENG", DEU: "DEU", DE: "DEU", SWE: "SWE", FRA: "FRA", ESP: "ESP", NLD: "NLD" };
const LANG_ORDER = ["ENG", "DEU"];

// "Ad Set - 31856 - LOCAL" -> "LOCAL"; "Ad Set - 31856 - ENG - Lookalike" -> "ENG · LOOKALIKE"; no label -> null.
export function adsetLabel(name: string): string | null {
  const parts = name.split(/\s+-\s+/);
  return parts.length >= 3 ? parts.slice(2).join(" · ").toUpperCase() : null;
}

// Language the ad set reuses: a language token in its label, otherwise ENG (the default video/landing/form).
export function adsetLangKey(label: string | null): string {
  for (const word of (label ?? "").split(/[^A-Z]+/)) if (LANG_TOKENS[word]) return LANG_TOKENS[word];
  return "ENG";
}

const kvHeaders = () => ({ Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` });

async function getMetaAdsetsByCampaign(): Promise<Record<string, KvAdset[]>> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/meta:campaigns`, { headers: kvHeaders(), cache: "no-store" });
  const { result } = await res.json();
  if (!result) return {};
  const out: Record<string, KvAdset[]> = {};
  for (const c of JSON.parse(result) as { id: string; adsets?: KvAdset[] }[]) out[c.id] = c.adsets ?? [];
  return out;
}

// Completed submissions per ad set ID (utm_term) across the given forms.
async function getCompletionsByAdset(formIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const formId of formIds) {
    let before: string | undefined;
    for (let page = 0; page < 20; page++) {
      const url = `https://api.typeform.com/forms/${formId}/responses?page_size=1000${before ? `&before=${before}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.TYPEFORM_API_TOKEN}` }, next: { revalidate: 300 } });
      if (!res.ok) throw new Error(`Typeform ${res.status}`);
      const data = (await res.json()) as { items: { token: string; hidden?: Record<string, string> }[] };
      for (const r of data.items) {
        const adset = r.hidden?.utm_term;
        if (adset) counts[adset] = (counts[adset] ?? 0) + 1;
      }
      if (data.items.length < 1000) break;
      before = data.items[data.items.length - 1].token;
    }
  }
  return counts;
}

// Ad-set lanes for every campaign that runs 2+ ad sets. Campaigns with a single ad set (or when
// the Typeform token / KV read is unavailable) are simply absent — callers fall back to the
// pipeline's own single-lane / language-variant view.
export async function getAdsetLanes(campaigns: FunnelCampaign[]): Promise<Record<string, AdsetLane[]>> {
  if (!process.env.TYPEFORM_API_TOKEN || !process.env.KV_REST_API_URL) return {};
  try {
    const adsetsByCampaign = await getMetaAdsetsByCampaign();
    const multi = campaigns
      .map((c) => ({ c, adsets: (adsetsByCampaign[c.campaign_id] ?? []).filter((a) => a.status === "ACTIVE" || a.impressions > 0) }))
      .filter((x) => x.adsets.length >= 2);
    if (multi.length === 0) return {};

    const formIds = new Set<string>();
    for (const { c } of multi) {
      if (c.typeform.form_id) formIds.add(c.typeform.form_id);
      for (const v of c.variants ?? []) if (v.typeform.form_id) formIds.add(v.typeform.form_id);
    }
    const completionsByAdset = await getCompletionsByAdset([...formIds]);

    const out: Record<string, AdsetLane[]> = {};
    for (const { c, adsets } of multi) {
      const formOf = (lang: string) => c.variants?.find((v) => v.key === lang)?.typeform ?? c.typeform;
      const rows = adsets.map((a) => {
        const label = adsetLabel(a.name);
        return { a, label, lang: adsetLangKey(label), attributed: completionsByAdset[a.id] ?? 0 };
      });
      // Ad sets that reuse the same form (e.g. ENG + LOCAL) split its numbers between them.
      const byForm = new Map<string, typeof rows>();
      for (const r of rows) {
        const id = formOf(r.lang).form_id;
        byForm.set(id, [...(byForm.get(id) ?? []), r]);
      }
      const lanes: AdsetLane[] = rows.map((r) => {
        const tf = formOf(r.lang);
        const group = byForm.get(tf.form_id)!;
        const solo = group.length === 1;
        let starts = tf.starts;
        if (!solo) {
          const partials = Math.max(0, tf.starts - tf.completions);
          const clicks = group.reduce((s, g) => s + g.a.link_clicks, 0);
          starts = r.attributed + Math.round(clicks > 0 ? (partials * r.a.link_clicks) / clicks : 0);
        }
        return {
          adsetId: r.a.id,
          label: r.label,
          langKey: r.lang,
          impressions: r.a.impressions,
          ctr: r.a.ctr,
          linkClicks: r.a.link_clicks,
          typeformStarts: starts,
          leads: solo ? tf.completions : r.attributed,
          estimatedStarts: !solo,
        };
      });
      const rank = (l: AdsetLane) => (LANG_ORDER.indexOf(l.label ?? "") >= 0 ? LANG_ORDER.indexOf(l.label ?? "") : 99);
      out[c.campaign_id] = lanes.sort((x, y) => rank(x) - rank(y) || (x.label ?? "").localeCompare(y.label ?? ""));
    }
    return out;
  } catch {
    return {};
  }
}
