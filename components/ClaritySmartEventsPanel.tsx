import { LandingEngagement } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { GlowPanel } from "@/components/ui/glow-panel";
import { DotsIcon } from "@/components/icons";

// Mirrors Clarity's "Smart events" panel, but sourced from OUR OWN landing:funnel pipeline
// rather than Clarity's API — custom event data isn't exposed by Clarity's Data Export API
// at all (only its built-in traffic/scroll/friction metrics are). The event names match
// exactly what property-landing-template's tracker fires into Clarity via clarity('event', …),
// so this is functionally equivalent, just read from our own KV instead.
export default function ClaritySmartEventsPanel({ engagement }: { engagement: LandingEngagement }) {
  return (
    <GlowPanel className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Smart Events</h2>
        <button className="icon-btn" aria-label="Options" disabled>
          <DotsIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {engagement.events.map((e) => (
          <div
            key={e.name}
            className="flex items-center justify-between gap-2 rounded-lg bg-[var(--panel2)] px-3 py-2 text-xs"
          >
            <span className="min-w-0 truncate font-mono text-[var(--text)]">{e.name}</span>
            <span className="shrink-0 whitespace-nowrap text-[var(--text-muted)]">
              {formatNumber(e.sessions)} session{e.sessions === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--text-faint)]">
        Sourced from this site&apos;s own tracker, not Clarity&apos;s API — custom events aren&apos;t exportable via
        Clarity.
      </p>
    </GlowPanel>
  );
}
