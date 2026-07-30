"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectionState, DateRange } from "./types";

// Generic fetcher for the /api/social/* routes — every route returns a
// ConnectionState-shaped payload with an empty-safe fallback (see
// app/api/social/*/route.ts), so pages can render a stable structure
// whether or not Supabase/Meta credentials are configured yet.
export function useSocialData<T extends ConnectionState>(
  path: string,
  range?: DateRange,
  extraParams?: Record<string, string>
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...(range ? { from: range.from, to: range.to } : {}), ...extraParams });
      const qs = params.toString();
      const res = await fetch(`${path}${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const json: T = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, range?.from, range?.to, JSON.stringify(extraParams)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
