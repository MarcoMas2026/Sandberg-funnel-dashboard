import Link from "next/link";
import { FunnelCampaign } from "@/lib/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { HomeIcon } from "./icons";

export default function CampaignCard({ campaign }: { campaign: FunnelCampaign }) {
  const { meta } = campaign;
  return (
    <Link
      href={`/campaign/${campaign.campaign_id}`}
      className="group panel flex flex-col gap-5 p-5 transition-colors hover:border-[var(--border-strong)]"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel2)] text-[var(--accent)]">
            <HomeIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-base font-semibold text-[var(--text)]">{campaign.property}</p>
            <p className="text-xs text-[var(--text-muted)]">Ref {campaign.ref}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Active
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total spend" value={formatCurrency(meta.spend)} />
        <Stat label="Total leads" value={formatNumber(meta.leads)} accent />
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
        <span>Started {formatDate(meta.start_date)}</span>
        <span className="text-[var(--accent2)] opacity-0 transition-opacity group-hover:opacity-100">
          View funnel →
        </span>
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[var(--panel2)] p-3">
      <p className={`text-xl font-semibold ${accent ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
    </div>
  );
}
