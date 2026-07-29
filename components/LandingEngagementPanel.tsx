import { LandingEngagement } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { GlowPanel } from "@/components/ui/glow-panel";

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  intro: "Intro",
  specs: "Specifications",
  gallery: "Gallery",
  features: "Features",
  location: "Location",
  cta: "Download CTA",
};

// Section-level drop-off on the landing page itself, between ad click and Typeform —
// fed by Clarity-adjacent client events (property-landing-template's data-fnl-section
// tracker) via the "Funnel Dashboard - Landing Engagement Sync" n8n workflow.
export default function LandingEngagementPanel({ engagement }: { engagement?: LandingEngagement }) {
  if (!engagement || engagement.page_views === 0) {
    return (
      <GlowPanel className="panel p-5">
        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">Landing Page Engagement</h2>
        <p className="text-xs text-[var(--text-muted)]">
          No landing engagement data yet — this section populates once visitors land on the page.
        </p>
      </GlowPanel>
    );
  }

  const maxViews = engagement.page_views;

  return (
    <GlowPanel className="panel p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Landing Page Engagement</h2>
        <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
          {formatNumber(engagement.page_views)} page views
        </span>
      </div>
      <div className="space-y-2.5">
        {engagement.steps.map((step) => (
          <div key={step.section} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              {SECTION_LABELS[step.section] ?? step.section}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel2)]">
              <div
                className="h-full rounded-full accent-gradient"
                style={{ width: `${Math.max(2, (step.views / maxViews) * 100)}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-xs font-semibold text-[var(--text)]">
              {formatPercent(step.pct_of_page_views, 0)}
            </span>
          </div>
        ))}
        <div className="mt-3 flex items-center gap-3 border-t border-[var(--panel2)] pt-3">
          <span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-[var(--accent)]">
            CTA Clicks
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel2)]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${Math.max(2, engagement.cta_click_rate * 100)}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-xs font-semibold text-[var(--text)]">
            {formatPercent(engagement.cta_click_rate, 0)}
          </span>
        </div>
      </div>
    </GlowPanel>
  );
}
