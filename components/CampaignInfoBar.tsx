import { FunnelCampaign } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { HomeIcon } from "./icons";

export default function CampaignInfoBar({
  campaign,
  lastUpdated,
}: {
  campaign: FunnelCampaign;
  lastUpdated: string | null;
}) {
  const { meta } = campaign;
  // "Current date" = the day the dashboard data was last refreshed (falls back to today).
  const currentDate = lastUpdated ?? new Date().toISOString();
  return (
    <div className="panel flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--panel2)] text-[var(--accent)]">
          <HomeIcon className="h-5 w-5" />
        </span>
        <span className="text-lg font-semibold text-white">{campaign.property}</span>
        <span className="h-5 w-px bg-[var(--border-strong)]" />
        <span className="text-sm text-[var(--text-muted)]">Ref {campaign.ref}</span>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-[var(--text-muted)]">
          Start date:{" "}
          <span className="text-white">{formatDate(meta.start_date)}</span>
        </span>
        <span className="h-5 w-px bg-[var(--border-strong)]" />
        <span className="text-[var(--text-muted)]">
          Current date: <span className="text-white">{formatDate(currentDate)}</span>
        </span>
      </div>
    </div>
  );
}
