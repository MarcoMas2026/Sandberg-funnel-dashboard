// Live Grid assets (hero, agent, videos, landing links) per property ref.
// Written by scripts/sync-live-grid-assets.py (run via the /live-grid-sync
// command) to a public Supabase Storage bucket as manifest.json — read here at
// request time, so new properties show up without a commit or deploy.
export interface LiveAssets {
  hero: string | null;
  agent: string | null;
  agentPhoto: string | null;
  askingPrice: number | null; // EUR, parsed from the landing hero's "Asking price: €..." tagline
  videos: Record<string, { src: string; poster: string }>;
  landings: Record<string, string>;
}

export async function getLiveAssets(): Promise<Record<string, LiveAssets>> {
  const base = process.env.SUPABASE_URL;
  if (!base) return {};
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/storage/v1/object/public/live-grid/manifest.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, LiveAssets>;
  } catch {
    return {};
  }
}
