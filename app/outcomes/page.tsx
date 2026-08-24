"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { GlowPanel } from "@/components/ui/glow-panel";
import { formatCurrency } from "@/lib/format";
import { PRIMARY_WIN_EVENT } from "@/lib/crm/events";
import { AGENT_ROSTER } from "@/lib/agents";

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

interface MonthlyCampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
}

interface MonthlyCampaignsResponse {
  connected: boolean;
  rows: MonthlyCampaignRow[];
}

// Buyer-track milestones a campaign can actually be scored on today, in
// funnel order — ReservationSigned (Arras) is the meaningful "won" event in
// Spain, not DealClosed (notary date, can trail months). See CONTEXT.md.
// LeadCreated/QualifiedBuyerLead lead first: as of 2026-08-24 they're the
// only two event types with real volume — everything from ViewingBooked
// onward is mostly zero today because of a known CRM-side attribution gap,
// not because campaigns aren't producing viewings/offers.
const SCORECARD_EVENTS = [
  "LeadCreated",
  "QualifiedBuyerLead",
  "ViewingBooked",
  "ViewingCompleted",
  "OfferStarted",
  "OfferAccepted",
  PRIMARY_WIN_EVENT,
] as const;

const EVENT_LABEL: Record<string, string> = {
  LeadCreated: "Lead Created",
  QualifiedBuyerLead: "Qualified Buyer",
  ViewingBooked: "Viewing Booked",
  ViewingCompleted: "Viewing Done",
  OfferStarted: "Offer Started",
  OfferAccepted: "Offer Accepted",
  [PRIMARY_WIN_EVENT]: "Arras Signed",
};

// This calendar month, 1st through today, local time (YYYY-MM-DD, matching
// funnel_monthly_totals / funnel_daily_history's date format).
function currentMonthBounds() {
  const now = new Date();
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: ymd(start), end: ymd(end) };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── MOCK — agent assignment/contact-speed data ──────────────────────────────
// The CRM's lead-outcomes feed has no assigned-agent or pipeline-stage field
// yet (checked directly against the raw payload: only response_id/event/
// occurred_at). This section is placeholder data shaped like what we'd get
// once that's added, built to validate the UI before drafting that ask.
interface AgentStat {
  name: string;
  slug: string;
  assigned: number;
  contacted: number;
  avgContactMinutes: number;
}

// Deterministic per-name pseudo-random so numbers don't reshuffle completely
// on every reload — a small live "tick" (below) nudges them after that.
function seedFromName(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function buildMockAgentStats(): AgentStat[] {
  return AGENT_ROSTER.map((name) => {
    const r1 = seedFromName(name);
    const r2 = seedFromName(name + "#2");
    const r3 = seedFromName(name + "#3");
    const assigned = 6 + Math.round(r1 * 30); // 6–36
    const contactedRatio = 0.5 + r2 * 0.48; // 50–98%
    const contacted = Math.min(assigned, Math.round(assigned * contactedRatio));
    const avgContactMinutes = 8 + Math.round(r3 * r3 * 3000); // skewed toward fast, long tail slow
    return { name, slug: slugify(name), assigned, contacted, avgContactMinutes };
  }).sort((a, b) => b.assigned - a.assigned);
}

function formatContactTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function contactTimeColor(minutes: number): string {
  if (minutes < 120) return "#34d399"; // under 2h — fast
  if (minutes < 1440) return "#fbbf24"; // under 24h — ok
  return "#f87171"; // 24h+ — slow
}

function AgentAvatar({ slug, name, size = 28 }: { slug: string; name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const [errored, setErrored] = useState(false);
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--panel2)]"
      style={{ width: size, height: size }}
    >
      {!errored ? (
        <Image
          src={`/team/${slug}.jpg`}
          alt={name}
          fill
          sizes={`${size}px`}
          className="object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[var(--text-faint)]">
          {initials}
        </div>
      )}
    </div>
  );
}

export default function OutcomesPage() {
  const [outcomes, setOutcomes] = useState<OutcomesResponse | null>(null);
  const [monthly, setMonthly] = useState<MonthlyCampaignsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentStats, setAgentStats] = useState<AgentStat[]>(() => buildMockAgentStats());

  useEffect(() => {
    const { start, end } = currentMonthBounds();
    Promise.all([
      fetch("/api/crm/outcomes", { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/history/campaigns?start=${start}&end=${end}`, { cache: "no-store" }).then((res) => res.json()),
    ])
      .then(([outcomesJson, monthlyJson]) => {
        setOutcomes(outcomesJson);
        setMonthly(monthlyJson);
      })
      .finally(() => setLoading(false));
  }, []);

  // Mock "live" movement — nudges one random agent's contacted count up so the
  // table visibly changes over time, standing in for a real polling refresh
  // once this is backed by actual CRM stage data.
  useEffect(() => {
    const id = setInterval(() => {
      setAgentStats((prev) => {
        const withRoom = prev.filter((a) => a.contacted < a.assigned);
        if (withRoom.length === 0) return prev;
        const pick = withRoom[Math.floor(Math.random() * withRoom.length)];
        return prev.map((a) => (a.name === pick.name ? { ...a, contacted: a.contacted + 1 } : a));
      });
    }, 12000);
    return () => clearInterval(id);
  }, []);

  const outcomesByCampaign = new Map((outcomes?.campaigns ?? []).map((c) => [c.campaign_id, c]));
  const totalAssigned = useMemo(() => agentStats.reduce((s, a) => s + a.assigned, 0), [agentStats]);
  const totalContacted = useMemo(() => agentStats.reduce((s, a) => s + a.contacted, 0), [agentStats]);

  return (
    <div className="space-y-5 pt-2">
      <GlowPanel className="panel p-5">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-[var(--text)]">Outcomes</h1>
          <span className="text-xs text-[var(--text-faint)]">
            What happens to a lead after the funnel — from the Sandberg CRM
          </span>
        </div>
      </GlowPanel>

      <GlowPanel className="panel p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          By campaign — this month
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--text-faint)]">Loading…</p>
        ) : (monthly?.rows.length ?? 0) === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">No campaigns recorded yet this month.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {monthly!.rows.map((m) => {
              const c = outcomesByCampaign.get(m.campaign_id);
              const qualified = c?.counts["QualifiedBuyerLead"] ?? 0;
              const cpql = qualified > 0 ? m.spend / qualified : null;
              const baseline = c?.counts["LeadCreated"] ?? 0;
              return (
                <div
                  key={m.campaign_id}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel2)] p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="text-[13px] font-medium leading-tight text-[var(--text)]">{m.campaign_name}</span>
                    <span className="shrink-0 rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text)]">
                      {cpql !== null ? formatCurrency(cpql) : "—"}
                      <span className="ml-1 font-normal text-[var(--text-faint)]">/QL</span>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {SCORECARD_EVENTS.map((ev) => {
                      const count = c?.counts[ev] ?? 0;
                      const pct = baseline > 0 ? Math.max(count > 0 ? 4 : 0, (count / baseline) * 100) : 0;
                      return (
                        <div key={ev} className="flex items-center gap-2">
                          <span className="w-[92px] shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                            {EVENT_LABEL[ev]}
                          </span>
                          <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-[var(--panel3)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent)] transition-all"
                              style={{ width: `${pct}%`, opacity: count === 0 ? 0 : 1 }}
                            />
                          </div>
                          <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-[var(--text)]">
                            {count === 0 ? <span className="text-[var(--text-faint)]">—</span> : count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && (outcomes?.unattributed ?? 0) > 0 && (
          <p className="mt-3 text-[11px] text-[var(--text-faint)]">
            {outcomes!.unattributed} outcome{outcomes!.unattributed === 1 ? "" : "s"} couldn't be matched to a
            campaign (predates when history tracking started, or the CRM's own records).
          </p>
        )}
      </GlowPanel>

      <GlowPanel className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            By agent — this month
          </h2>
          <span className="rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-faint)]">
            mock data — pending CRM agent/stage feed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                <th className="pb-2 pl-1">Agent</th>
                <th className="pb-2 text-right">Assigned</th>
                <th className="pb-2 pl-4" style={{ minWidth: 220 }}>
                  Contacted / Uncontacted
                </th>
                <th className="pb-2 pr-1 text-right">Avg. time to contact</th>
              </tr>
            </thead>
            <tbody>
              {agentStats.map((a) => {
                const uncontacted = a.assigned - a.contacted;
                const contactedPct = a.assigned > 0 ? (a.contacted / a.assigned) * 100 : 0;
                return (
                  <tr key={a.name} className="border-t border-[var(--border)]">
                    <td className="py-2.5 pl-1">
                      <div className="flex items-center gap-2.5">
                        <AgentAvatar slug={a.slug} name={a.name} />
                        <span className="font-medium text-[var(--text)]">{a.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-[var(--text)]">{a.assigned}</td>
                    <td className="py-2.5 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-[8px] flex-1 overflow-hidden rounded-full bg-[var(--panel3)]">
                          <div className="h-full bg-[#34d399]" style={{ width: `${contactedPct}%` }} title={`${a.contacted} contacted`} />
                          <div className="h-full bg-[#f87171]" style={{ width: `${100 - contactedPct}%` }} title={`${uncontacted} uncontacted`} />
                        </div>
                        <span className="w-[92px] shrink-0 text-right text-[11px] tabular-nums text-[var(--text-faint)]">
                          {a.contacted}✓ · {uncontacted} new
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-1 text-right">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                        style={{
                          color: contactTimeColor(a.avgContactMinutes),
                          backgroundColor: `color-mix(in srgb, ${contactTimeColor(a.avgContactMinutes)} 14%, transparent)`,
                        }}
                      >
                        {formatContactTime(a.avgContactMinutes)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--border-strong)] text-[var(--text)]">
                <td className="py-2.5 pl-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  Total
                </td>
                <td className="py-2.5 text-right font-semibold tabular-nums">{totalAssigned}</td>
                <td className="py-2.5 pl-4 text-[11px] tabular-nums text-[var(--text-faint)]">
                  {totalContacted} contacted · {totalAssigned - totalContacted} uncontacted
                </td>
                <td className="py-2.5 pr-1" />
              </tr>
            </tfoot>
          </table>
        </div>
      </GlowPanel>
    </div>
  );
}
