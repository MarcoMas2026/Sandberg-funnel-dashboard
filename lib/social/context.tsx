"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { DateRange } from "./types";

export type RangePreset = "7d" | "30d" | "90d" | "this_month" | "last_month";

function presetToRange(preset: RangePreset): DateRange {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  if (preset === "this_month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    return { from, to };
  }
  if (preset === "last_month") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: from.toISOString().slice(0, 10), to: lastDay.toISOString().slice(0, 10) };
  }
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const from = new Date(today.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

interface SocialRangeState {
  preset: RangePreset;
  range: DateRange;
  compare: boolean;
  setPreset: (p: RangePreset) => void;
  setCompare: (c: boolean) => void;
}

// Scoped to the (social) route group, same reasoning as OkrProvider in
// lib/okr-context.tsx — pages outside /social never mount this and never pay
// for Supabase reads. Holds only the shared date-range/compare state; each
// page fetches its own section's data via useSocialData so a change here
// doesn't force every section to refetch simultaneously.
const SocialRangeContext = createContext<SocialRangeState | null>(null);

export function SocialRangeProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [compare, setCompare] = useState(true);
  const range = useMemo(() => presetToRange(preset), [preset]);

  return (
    <SocialRangeContext.Provider value={{ preset, range, compare, setPreset, setCompare }}>
      {children}
    </SocialRangeContext.Provider>
  );
}

export function useSocialRange(): SocialRangeState {
  const ctx = useContext(SocialRangeContext);
  if (!ctx) throw new Error("useSocialRange must be used within SocialRangeProvider");
  return ctx;
}
