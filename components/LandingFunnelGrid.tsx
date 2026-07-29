import { LandingEngagement } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { SECTION_LABELS } from "@/components/LandingEngagementPanel";

// Classic tapered funnel for the landing page itself — page view down through each template
// section to the CTA click. Bar WIDTHS are fixed by rank (a clean, always-narrowing silhouette),
// never resized against the live values — only the numbers/percentages next to each bar move as
// data changes, so the shape stays visually consistent across refreshes.
function boundaryWidthPct(i: number, n: number) {
  return 100 * (1 - 0.6 * (i / n));
}

export default function LandingFunnelGrid({ engagement }: { engagement: LandingEngagement }) {
  const rows = [
    { label: "Page View", value: engagement.page_views, pct: 1 },
    ...engagement.steps.map((s) => ({
      label: SECTION_LABELS[s.section] ?? s.section,
      value: s.views,
      pct: s.pct_of_page_views,
    })),
    { label: "CTA Click", value: engagement.cta_clicks, pct: engagement.cta_click_rate },
  ];
  const n = rows.length - 1;

  return (
    <div className="flex w-full flex-col items-center gap-2.5 px-2 py-2">
      {rows.map((row, i) => (
        <div key={row.label} className="flex w-full flex-col items-center gap-1">
          <div
            className="h-9 rounded-lg accent-gradient"
            style={{ width: `${boundaryWidthPct(i, n)}%` }}
          />
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-[var(--text)]">{row.label}</span>
            <span className="text-[var(--text-muted)]">{formatNumber(row.value)}</span>
            {i > 0 && <span className="text-[var(--text-faint)]">({formatPercent(row.pct, 0)})</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
