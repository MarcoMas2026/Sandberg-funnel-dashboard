"use client";

import Link from "next/link";
import { House } from "@phosphor-icons/react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { FunnelCampaign } from "@/lib/types";

// Simplified campaign card matching the reference exactly: icon, name, ref,
// Live badge, Spend/Leads/CPL, date range — no funnel donut, sync badges, or
// sparkline (those stay on the richer /campaign/[id] detail page).
export function VantageCampaignCard({ campaign: c, lastUpdated }: { campaign: FunnelCampaign; lastUpdated: string | null }) {
  return (
    <Link href={`/campaign/${c.campaign_id}`} className="vantage-card block p-6">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="vantage-icon-box h-11 w-11">
            <House className="h-6 w-6" />
          </span>
          <div>
            <p className="text-base font-semibold text-[var(--vantage-text)]">{c.property}</p>
            <p className="text-xs text-[var(--vantage-text-muted)]">
              Ref {c.ref} · {c.campaign_type === "community" ? "Community" : "Property Specific"}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--vantage-icon-box)] px-2.5 py-1 text-xs font-medium text-[var(--vantage-text)]">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
        </span>
      </div>

      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-[var(--vantage-text)]">{formatCurrency(c.meta.spend)}</p>
          <p className="text-[11px] uppercase tracking-wide text-[var(--vantage-text-muted)]">spend</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[var(--vantage-text)]">{formatNumber(c.meta.leads)}</p>
          <p className="text-[11px] uppercase tracking-wide text-[var(--vantage-text-muted)]">leads</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[var(--vantage-text)]">{c.meta.leads > 0 ? formatCurrency(c.meta.cpl, 2) : "—"}</p>
          <p className="text-[11px] uppercase tracking-wide text-[var(--vantage-text-muted)]">cpl</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--vantage-text-muted)]">
        <span>{formatDate(c.meta.start_date)}</span>
        <span className="h-px flex-1 bg-[var(--vantage-icon-box)]" />
        <span>{lastUpdated ? formatDate(lastUpdated) : "today"}</span>
      </div>
    </Link>
  );
}
