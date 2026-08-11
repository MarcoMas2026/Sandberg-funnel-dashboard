"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { GlowPanel } from "@/components/ui/glow-panel";
import { formatCurrency } from "@/lib/format";
import { PRIMARY_WIN_EVENT } from "@/lib/crm/events";

interface EventTypeStatus {
  event: string;
  track: string;
  liveAsOf: string | null;
  lastSeenAt: string | null;
}

interface CampaignOutcomes {
  campaign_id: string;
  campaign_name: string;
  counts: Record<string, number>;
}

interface OutcomesResponse {
  connected: boolean;
  campaigns: CampaignOutcomes[];
  eventTypes: EventTypeStatus[];
  unattributed: number;
  error?: string;
}

// Buyer-track milestones a campaign can actually be scored on today, in
// funnel order — ReservationSigned (Arras) is the meaningful "won" event in
// Spain, not DealClosed (notary date, can trail months). See CONTEXT.md.
const SCORECARD_EVENTS = [
  "ViewingBooked",
  "ViewingCompleted",
  "OfferStarted",
  "OfferAccepted",
  PRIMARY_WIN_EVENT,
] as const;

export default function OutcomesPage() {
  const { data } = useDashboard();
  const [outcomes, setOutcomes] = useState<OutcomesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crm/outcomes", { cache: "no-store" })
      .then((res) => res.json())
      .then(setOutcomes)
      .finally(() => setLoading(false));
  }, []);

  const eventStatusByName = new Map((outcomes?.eventTypes ?? []).map((e) => [e.event, e]));
  const spendByCampaign = new Map((data?.campaigns ?? []).map((c) => [c.campaign_id, c.meta.spend]));

  return (
    <div className="space-y-5 pt-2">
      <GlowPanel className="panel p-5">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-[var(--text)]">Outcomes</h1>
          <span className="text-xs text-[var(--text-faint)]">
            What happens to a lead after the funnel — from the Sandberg CRM
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-xs text-[var(--text-faint)]">
          Pulled hourly from the CRM's lead-outcomes feed and joined back to campaigns by Typeform
          response id. Rows only appear once the CRM confirms an event type is actually emitting —
          a badge below reading "not live yet" means the CRM hasn't wired that milestone up, not
          that zero of them have happened.
        </p>
      </GlowPanel>

      <GlowPanel className="panel p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          Event coverage
        </h2>
        <div className="flex flex-wrap gap-2">
          {(outcomes?.eventTypes ?? []).map((e) => (
            <span
              key={e.event}
              className="rounded-full border px-2.5 py-1 text-[11px]"
              style={{
                borderColor: e.liveAsOf ? "var(--border)" : "color-mix(in srgb, var(--text-faint) 40%, transparent)",
                color: e.liveAsOf ? "var(--text)" : "var(--text-faint)",
                opacity: e.liveAsOf ? 1 : 0.6,
              }}
              title={e.track}
            >
              {e.event}
              {!e.liveAsOf && <span className="ml-1 italic">· not live yet</span>}
            </span>
          ))}
          {!loading && (outcomes?.eventTypes?.length ?? 0) === 0 && (
            <span className="text-xs text-[var(--text-faint)]">No event-type data yet.</span>
          )}
        </div>
      </GlowPanel>

      <GlowPanel className="panel p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          By campaign
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--text-faint)]">Loading…</p>
        ) : (outcomes?.campaigns.length ?? 0) === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">
            No CRM outcomes recorded yet — expected until the CRM's endpoint is live and the pull
            workflow has run against it (see n8n/crm-integration.md).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                  <th className="pb-2 pl-1">Campaign</th>
                  {SCORECARD_EVENTS.map((ev) => (
                    <th key={ev} className="pb-2 text-right">
                      {ev === PRIMARY_WIN_EVENT ? "Arras Signed" : ev.replace(/([A-Z])/g, " $1").trim()}
                    </th>
                  ))}
                  <th className="pb-2 pr-1 text-right">€ / Qualified Lead</th>
                </tr>
              </thead>
              <tbody>
                {outcomes!.campaigns.map((c) => {
                  const qualified = c.counts["QualifiedBuyerLead"] ?? 0;
                  const spend = spendByCampaign.get(c.campaign_id);
                  const cpql = qualified > 0 && spend !== undefined ? spend / qualified : null;
                  return (
                    <tr key={c.campaign_id} className="border-t border-[var(--border)]">
                      <td className="py-3 pl-1 font-medium text-[var(--text)]">{c.campaign_name}</td>
                      {SCORECARD_EVENTS.map((ev) => {
                        const status = eventStatusByName.get(ev);
                        const notLive = status && !status.liveAsOf;
                        return (
                          <td key={ev} className="py-3 text-right text-[var(--text)]">
                            {notLive ? <span className="text-[var(--text-faint)]">—</span> : c.counts[ev] ?? 0}
                          </td>
                        );
                      })}
                      <td className="py-3 pr-1 text-right text-[var(--text)]">
                        {cpql !== null ? formatCurrency(cpql) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (outcomes?.unattributed ?? 0) > 0 && (
          <p className="mt-3 text-[11px] text-[var(--text-faint)]">
            {outcomes!.unattributed} outcome{outcomes!.unattributed === 1 ? "" : "s"} couldn't be matched to a
            currently-tracked campaign (its lead has aged out of leads:all).
          </p>
        )}
      </GlowPanel>
    </div>
  );
}
