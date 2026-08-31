"use client";

import { useEffect, useState } from "react";
import { Scales } from "@phosphor-icons/react";
import CompareSlot from "@/components/compare/CompareSlot";
import { CompareCatalogCampaign } from "@/components/compare/ComparePicker";

export default function TwoSidesPage() {
  const [catalog, setCatalog] = useState<CompareCatalogCampaign[]>([]);

  useEffect(() => {
    fetch("/api/history/campaigns-catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCatalog(d.campaigns ?? []))
      .catch(() => setCatalog([]));
  }, []);

  return (
    <div className="space-y-5 pt-2">
      <div className="flex items-center gap-3">
        <span className="panel-icon">
          <Scales className="h-4 w-4" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-[var(--text)]">Two Sides</h1>
          <p className="text-xs text-[var(--text-faint)]">
            Compare any two campaigns, active or inactive, to see why one converted better than the other.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CompareSlot catalog={catalog} />
        <CompareSlot catalog={catalog} />
      </div>
    </div>
  );
}
