"use client";

import { useCallback, useEffect, useState } from "react";
import FunnelColumn from "@/components/FunnelColumn";
import UpdateButton from "@/components/UpdateButton";
import { FunnelData } from "@/lib/types";

export default function OverviewPage() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/funnel");
      const json: FunnelData = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Funnel Overview</h1>
          <p className="text-sm text-slate-500">Meta Ad → Landing Page → Typeform → Qualified Lead</p>
        </div>
        <UpdateButton lastUpdated={data?.last_updated ?? null} onUpdated={fetchData} />
      </div>

      {loading && (
        <p className="text-sm text-slate-400">Loading funnel data…</p>
      )}

      {!loading && data && data.campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-24 text-center">
          <p className="text-base font-medium text-navy">No funnel data yet</p>
          <p className="mt-1 text-sm text-slate-500">Click Update to load your funnel data</p>
        </div>
      )}

      {!loading && data && data.campaigns.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.campaigns.map((campaign) => (
            <FunnelColumn key={campaign.campaign_id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
