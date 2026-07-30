"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { LeadRecord, LeadTag } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { LeadIcon } from "@/components/icons";
import { GlowPanel } from "@/components/ui/glow-panel";
import { Pill } from "@/components/viz";
import { LeadTagSheet } from "@/components/ui/lead-tag-sheet";

const TIMEFRAMES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: null },
] as const;

const TAG_COLORS: Record<Exclude<LeadTag, null>, string> = {
  red: "#ef4444",
  orange: "#f59e0b",
  blue: "#3b82f6",
};

export default function LeadsPage() {
  const { data } = useDashboard();
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [timeframeDays, setTimeframeDays] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [pickerId, setPickerId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leads", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setLeads(json.leads ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const campaigns = useMemo(() => {
    const byId = new Map<string, string>();
    for (const c of data?.campaigns ?? []) byId.set(c.campaign_id, c.campaign_name);
    for (const l of leads) if (!byId.has(l.campaign_id)) byId.set(l.campaign_id, l.campaign_name);
    return Array.from(byId, ([campaign_id, campaign_name]) => ({ campaign_id, campaign_name }));
  }, [data?.campaigns, leads]);

  const filtered = useMemo(() => {
    const cutoff = timeframeDays ? Date.now() - timeframeDays * 24 * 60 * 60 * 1000 : null;
    return leads
      .filter((l) => !campaignFilter || l.campaign_id === campaignFilter)
      .filter((l) => {
        if (!cutoff) return true;
        if (!l.submitted_at) return false;
        return new Date(l.submitted_at).getTime() >= cutoff;
      })
      .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
  }, [leads, campaignFilter, timeframeDays]);

  async function setTag(responseId: string, tag: LeadTag) {
    setLeads((prev) => prev.map((l) => (l.response_id === responseId ? { ...l, tag } : l)));
    await fetch("/api/leads/tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_id: responseId, tag }),
    });
  }

  return (
    <div className="space-y-5 pt-2">
      <GlowPanel className="panel flex flex-col items-stretch gap-3 p-5 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent)]">
            <LeadIcon className="h-4 w-4" />
          </span>
          <h1 className="text-sm font-semibold text-[var(--text)]">Leads</h1>
          <span className="text-xs text-[var(--text-faint)]">
            {loading ? (
              "Loading…"
            ) : (
              <>
                <span className="md:hidden">
                  {filtered.length === leads.length ? `${leads.length} leads` : `${filtered.length} of ${leads.length}`}
                </span>
                <span className="hidden md:inline">{`${filtered.length} of ${leads.length}`}</span>
              </>
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
          {TIMEFRAMES.map((t) => (
            <Pill
              key={t.label}
              label={t.label}
              active={timeframeDays === t.days}
              onClick={() => setTimeframeDays(t.days)}
              className="w-full justify-center md:w-auto"
            />
          ))}
        </div>
      </GlowPanel>

      <GlowPanel className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Pill label="All campaigns" active={campaignFilter === null} onClick={() => setCampaignFilter(null)} />
          {campaigns.map((c) => (
            <Pill
              key={c.campaign_id}
              label={c.campaign_name}
              active={campaignFilter === c.campaign_id}
              onClick={() => setCampaignFilter(c.campaign_id)}
            />
          ))}
        </div>

        {/* Mobile: one card per lead, all fields visible without horizontal
            scroll. Desktop (md+): unchanged wide table. */}
        <div className="space-y-3 md:hidden">
          {filtered.map((lead) => (
            <button
              key={lead.response_id}
              type="button"
              onClick={() => setPickerId(lead.response_id)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-[var(--text)]">{lead.first_name || "—"}</p>
                <div className="flex shrink-0 gap-1.5 pt-1">
                  {(["red", "orange", "blue"] as const).map((color) => (
                    <span
                      key={color}
                      aria-hidden
                      className="h-4 w-4 rounded-full"
                      style={{
                        background: TAG_COLORS[color],
                        opacity: lead.tag === color ? 1 : 0.25,
                        boxShadow: lead.tag === color ? `0 0 8px ${TAG_COLORS[color]}` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <LeadField label="Language" value={lead.language} />
                <LeadField label="Budget" value={lead.budget} />
                <LeadField label="Stage" value={lead.stage} />
                <LeadField label="Campaign" value={lead.campaign_name} />
              </div>
              <p className="mt-3 border-t border-[var(--border)] pt-2 text-[10px] text-[var(--text-faint)]">
                {formatDate(lead.submitted_at)}
              </p>
            </button>
          ))}
          {!loading && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--text-faint)]">No leads in this range.</p>
          )}
        </div>

        {isMobile &&
          pickerId &&
          (() => {
            const pickerLead = filtered.find((l) => l.response_id === pickerId);
            if (!pickerLead) return null;
            return <LeadTagSheet lead={pickerLead} onSelect={setTag} onClose={() => setPickerId(null)} />;
          })()}

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                <th className="pb-2 pl-1">First name</th>
                <th className="pb-2">Language</th>
                <th className="pb-2">Budget</th>
                <th className="pb-2">Stage</th>
                <th className="pb-2">Campaign</th>
                <th className="pb-2">Submitted</th>
                <th className="pb-2 pr-1 text-right">Tag</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.response_id} className="border-t border-[var(--border)]">
                  <td className="py-3 pl-1 font-medium text-[var(--text)]">{lead.first_name || "—"}</td>
                  <td className="py-3 text-[var(--text)]">{lead.language || "—"}</td>
                  <td className="py-3 text-[var(--text)]">{lead.budget || "—"}</td>
                  <td className="py-3 text-[var(--text)]">{lead.stage || "—"}</td>
                  <td className="py-3 text-[var(--text-faint)]">{lead.campaign_name || "—"}</td>
                  <td className="py-3 text-[var(--text-faint)]">{formatDate(lead.submitted_at)}</td>
                  <td className="py-3 pr-1">
                    <div className="flex justify-end gap-1.5">
                      {(["red", "orange", "blue"] as const).map((color) => (
                        <button
                          key={color}
                          aria-label={`Tag ${lead.first_name || "lead"} ${color}`}
                          onClick={() => setTag(lead.response_id, lead.tag === color ? null : color)}
                          className="h-4 w-4 rounded-full transition"
                          style={{
                            background: TAG_COLORS[color],
                            opacity: lead.tag === color ? 1 : 0.25,
                            boxShadow: lead.tag === color ? `0 0 8px ${TAG_COLORS[color]}` : "none",
                          }}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--text-faint)]">
                    No leads in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlowPanel>
    </div>
  );
}

function LeadField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
      <p className="text-[var(--text)]">{value || "—"}</p>
    </div>
  );
}
