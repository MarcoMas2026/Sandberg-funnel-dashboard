import { FunnelCampaign } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { GlowPanel } from "@/components/ui/glow-panel";
import CampaignSelector from "./CampaignSelector";

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
    <GlowPanel className="panel flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <CampaignSelector currentCampaignId={campaign.campaign_id} variant="icon" />
        <span className="text-lg font-semibold text-[var(--text)]">{campaign.property}</span>
        <span className="h-5 w-px bg-[var(--border-strong)]" />
        <span className="text-sm text-[var(--text-muted)]">Ref {campaign.ref}</span>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-[var(--text-muted)]">
          Start date:{" "}
          <span className="text-[var(--text)]">{formatDate(meta.start_date)}</span>
        </span>
        <span className="h-5 w-px bg-[var(--border-strong)]" />
        <span className="text-[var(--text-muted)]">
          Current date: <span className="text-[var(--text)]">{formatDate(currentDate)}</span>
        </span>
      </div>
    </GlowPanel>
  );
}
