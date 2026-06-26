import { MetaCampaign } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export default function SummaryPanel({ meta }: { meta: MetaCampaign }) {
  return (
    <div className="panel p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">Campaign Summary</h2>
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Total Spend" value={formatCurrency(meta.spend)} />
        <Kpi label="Total Leads" value={formatNumber(meta.leads)} accent />
        <Kpi label="Avg Cost / Lead" value={formatCurrency(meta.cpl, 2)} />
        <Kpi label="Overall CTR" value={formatPercent(meta.ctr, 2)} />
      </div>
    </div>
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
      <p className={`text-2xl font-semibold ${accent ? "text-[var(--accent)]" : "text-white"}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
    </div>
  );
}
