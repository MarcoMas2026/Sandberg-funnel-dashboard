import Link from "next/link";
import { FunnelCampaign } from "@/lib/types";
import CampaignStatusBadge from "./CampaignStatusBadge";

function rateColor(rate: number): string {
  if (rate >= 0.6) return "text-emerald-600";
  if (rate >= 0.3) return "text-amber-500";
  return "text-red-500";
}

function ConversionArrow({ rate }: { rate: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-1.5">
      <span className="text-slate-300">↓</span>
      <span className={`text-xs font-semibold ${rateColor(rate)}`}>
        {(rate * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function formatCurrency(n: number): string {
  return `€${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function FunnelColumn({ campaign }: { campaign: FunnelCampaign }) {
  const { meta, typeform, derived } = campaign;
  const ctaToFormRate = derived.click_to_form_start_rate;
  const completionRate = derived.form_completion_rate;

  return (
    <div className="rounded-xl border border-border bg-white p-5 transition-colors hover:border-slate-300">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <Link
            href={`/campaign/${campaign.campaign_id}`}
            className="text-base font-semibold text-navy hover:underline"
          >
            {campaign.property}
          </Link>
          <p className="text-xs text-slate-400">{campaign.campaign_name}</p>
        </div>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      {/* Meta Ad node */}
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Meta Ad</p>
        <p className="mt-1 text-lg font-semibold text-navy">{formatCurrency(meta.spend)}</p>
        <p className="text-xs text-slate-500">
          {meta.impressions.toLocaleString()} impressions · {meta.link_clicks.toLocaleString()} link clicks
        </p>
      </div>

      <ConversionArrow rate={ctaToFormRate} />

      {/* Landing Page node */}
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Landing Page</p>
        <p className="mt-1 text-lg font-semibold text-navy">{typeform.starts.toLocaleString()} form starts</p>
        <p className="text-xs text-slate-500">from {meta.link_clicks.toLocaleString()} link clicks</p>
      </div>

      <ConversionArrow rate={completionRate} />

      {/* Typeform node */}
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Typeform</p>
        <p className="mt-1 text-lg font-semibold text-navy">
          {typeform.completions.toLocaleString()} completions
        </p>
        <p className="text-xs text-slate-500">
          {(typeform.completion_rate * 100).toFixed(0)}% completion rate
        </p>
      </div>

      <div className="flex items-center justify-center py-1.5">
        <span className="text-slate-300">↓</span>
      </div>

      {/* Qualified Lead node */}
      <div className="rounded-lg bg-navy p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-300">Qualified Lead</p>
        <p className="mt-1 text-lg font-semibold text-white">
          {formatCurrency(derived.cost_per_qualified_lead)}
        </p>
        <p className="text-xs text-slate-400">cost per qualified lead</p>
      </div>
    </div>
  );
}
