"use client";

import { useEffect, useState } from "react";
import { GlowPanel } from "@/components/ui/glow-panel";
import { WhatsAppIcon } from "@/components/icons";
import { CountUp } from "@/components/viz";
import { formatNumber, formatPercent } from "@/lib/format";
import { WhatsAppAgentStats } from "@/lib/kv";

export default function WhatsAppPage() {
  const [agents, setAgents] = useState<WhatsAppAgentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/whatsapp-clicks", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setAgents(json.agents ?? []))
      .finally(() => setLoading(false));
  }, []);

  const totalViews = agents.reduce((sum, a) => sum + a.page_views, 0);
  const totalClicks = agents.reduce((sum, a) => sum + a.whatsapp_clicks, 0);

  return (
    <div className="space-y-6">
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-faint)]">Thank-You Pages</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">WhatsApp</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Clicks on the WhatsApp button, per agent thank-you page — no GTM, sourced from the same
            landing-engagement beacon as property page CTAs
          </p>
        </div>
        <span className="rounded-full bg-[var(--panel2)] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
          {loading ? "Loading…" : `Live · ${agents.length} agent${agents.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total Page Views" value={totalViews} />
        <StatTile label="Total WhatsApp Clicks" value={totalClicks} />
        <StatTile
          label="Overall Click Rate"
          value={null}
          display={formatPercent(totalViews ? totalClicks / totalViews : 0)}
        />
      </div>

      <GlowPanel className="panel fade-up overflow-hidden" style={{ animationDelay: "0.05s" }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                <th className="px-5 py-3 font-medium">Agent</th>
                <th className="px-5 py-3 font-medium">Page Views</th>
                <th className="px-5 py-3 font-medium">WhatsApp Clicks</th>
                <th className="px-5 py-3 font-medium">Click Rate</th>
              </tr>
            </thead>
            <tbody>
              {!loading && agents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                    No WhatsApp clicks recorded yet. Events sync from n8n every ~30 minutes.
                  </td>
                </tr>
              )}
              {agents.map((a) => (
                <tr key={a.slug} className="border-b border-[var(--border)] last:border-0">
                  <td className="flex items-center gap-2 px-5 py-3 font-medium text-[var(--text)]">
                    <WhatsAppIcon className="h-4 w-4 text-[#25d366]" />
                    {a.agent}
                  </td>
                  <td className="px-5 py-3 text-[var(--text-muted)]">{formatNumber(a.page_views)}</td>
                  <td className="px-5 py-3 text-[var(--text)]">{formatNumber(a.whatsapp_clicks)}</td>
                  <td className="px-5 py-3 text-[var(--text-muted)]">{formatPercent(a.click_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlowPanel>
    </div>
  );
}

function StatTile({ label, value, display }: { label: string; value: number | null; display?: string }) {
  return (
    <GlowPanel className="panel fade-up p-5">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        {display ?? (value !== null ? <CountUp value={value} format={(v) => formatNumber(Math.round(v))} /> : "—")}
      </p>
    </GlowPanel>
  );
}
