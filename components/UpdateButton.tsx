"use client";

import { useState } from "react";

export default function UpdateButton({
  lastUpdated,
  onUpdated,
}: {
  lastUpdated: string | null;
  onUpdated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/update", { method: "POST" });
      const data = await res.json();
      if (!data.triggered) {
        setError(data.error ?? "Update failed");
      } else {
        onUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Updating…" : "Update"}
      </button>
      <span className="text-xs text-slate-400">
        {lastUpdated ? `Last updated ${new Date(lastUpdated).toLocaleString()}` : "Never updated"}
      </span>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
