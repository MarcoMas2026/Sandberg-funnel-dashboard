"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { OkrData } from "./types";

interface OkrState {
  data: OkrData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const OkrContext = createContext<OkrState | null>(null);

// Scoped to the (okr) route group (see app/(okr)/layout.tsx) rather than the
// root layout — Sheets reads have real API latency/quota cost, unlike the KV
// reads the rest of the app does, so pages that never touch OKR data
// shouldn't pay for a fetch on every load.
export function OkrProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OkrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/okr", { cache: "no-store" });
      const json: OkrData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load OKR data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <OkrContext.Provider value={{ data, loading, error, refresh }}>{children}</OkrContext.Provider>;
}

export function useOkr(): OkrState {
  const ctx = useContext(OkrContext);
  if (!ctx) throw new Error("useOkr must be used within OkrProvider");
  return ctx;
}
