import { FunnelCampaign } from "@/lib/types";

export default function CampaignStatusBadge({
  status,
}: {
  status: FunnelCampaign["status"];
}) {
  const isActive = status === "ACTIVE";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-200 text-slate-500"
      }`}
    >
      {isActive ? "Active" : status === "PAUSED" ? "Inactive" : "Archived"}
    </span>
  );
}
