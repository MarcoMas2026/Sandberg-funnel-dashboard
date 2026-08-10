import { MetaCampaign } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { GlowPanel } from "@/components/ui/glow-panel";
import { Pinnable } from "@/components/Pinnable";

// campaignId is optional so this panel still works anywhere it's rendered
// without a real campaign id (e.g. future mock/preview contexts) — when
// present it makes each Kpi tile draggable into a Public View via Option+drag.
export default function SummaryPanel({ meta, campaignId }: { meta: MetaCampaign; campaignId?: string }) {
  return (
    <GlowPanel className="panel p-5">
      <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Campaign Summary</h2>
      <div className="grid grid-cols-2 gap-3">
        <Pinnable type="campaign-spend" campaignId={campaignId}>
          <Kpi label="Total Spend" value={formatCurrency(meta.spend)} />
        </Pinnable>
        <Pinnable type="campaign-leads" campaignId={campaignId}>
          <Kpi label="Total Leads" value={formatNumber(meta.leads)} accent />
        </Pinnable>
        <Pinnable type="campaign-cpl" campaignId={campaignId}>
          <Kpi label="Avg Cost / Lead" value={formatCurrency(meta.cpl, 2)} />
        </Pinnable>
        <Pinnable type="campaign-ctr" campaignId={campaignId}>
          <Kpi label="Overall CTR" value={formatPercent(meta.ctr, 2)} />
        </Pinnable>
      </div>
    </GlowPanel>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[var(--panel2)] p-4">
      <p className={`text-2xl font-semibold ${accent ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
    </div>
  );
}
