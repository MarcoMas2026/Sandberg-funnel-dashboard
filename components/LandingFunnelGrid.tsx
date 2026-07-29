import { LandingEngagement } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { SECTION_LABELS } from "@/components/LandingEngagementPanel";

// Simple step funnel for the landing page itself — page view down through each template
// section to the CTA click — replacing the decorative funnel image in the center grid box
// on the "Enters Landing Page" layer. Bar widths are proportional to page_views; always
// renders the full step list, 0-width bars when there's no traffic yet.
export default function LandingFunnelGrid({ engagement }: { engagement: LandingEngagement }) {
  const maxViews = engagement.page_views || 1;

  const rows = [
    { label: "Page View", value: engagement.page_views, pct: 1 },
    ...engagement.steps.map((s) => ({
      label: SECTION_LABELS[s.section] ?? s.section,
      value: s.views,
      pct: s.pct_of_page_views,
    })),
    { label: "CTA Click", value: engagement.cta_clicks, pct: engagement.cta_click_rate },
  ];

  return (
    <div className="flex w-full flex-col justify-center gap-3 px-4 py-6">
      {rows.map((row, i) => {
        const widthPct = Math.max(6, (row.value / maxViews) * 100);
        return (
          <div key={row.label} className="flex flex-col items-center gap-1.5">
            <div
              className="h-11 rounded-lg accent-gradient transition-[width] duration-500"
              style={{ width: `${widthPct}%` }}
            />
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-[var(--text)]">{row.label}</span>
              <span className="text-[var(--text-muted)]">{formatNumber(row.value)}</span>
              {i > 0 && <span className="text-[var(--text-faint)]">({formatPercent(row.pct, 0)})</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
