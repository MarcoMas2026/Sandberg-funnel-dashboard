"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { FunnelData } from "./types";

interface DashboardState {
  data: FunnelData | null;
  loading: boolean;
  updating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  triggerUpdate: () => Promise<void>;
}

const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/funnel", { cache: "no-store" });
      const json: FunnelData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fires the n8n sync, then polls the funnel endpoint until the
  // last_updated timestamp changes (new data has landed).
  const triggerUpdate = useCallback(async () => {
    setUpdating(true);
    setError(null);
    const before = data?.last_updated ?? null;
    try {
      const res = await fetch("/api/update", { method: "POST" });
      const json = await res.json();
      if (!json.triggered) {
        setError(json.error ?? "Update failed");
        setUpdating(false);
        return;
      }
      // Poll for fresh data (the n8n chain takes a few seconds).
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const r = await fetch("/api/funnel", { cache: "no-store" });
        const next: FunnelData = await r.json();
        if (next.last_updated && next.last_updated !== before) {
          setData(next);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  }, [data?.last_updated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <DashboardContext.Provider
      value={{ data, loading, updating, error, refresh, triggerUpdate }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardState {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
