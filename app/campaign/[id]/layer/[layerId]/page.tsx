"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboard } from "@/lib/dashboard-context";
import { GlowPanel } from "@/components/ui/glow-panel";
import { Sparkline, Pill } from "@/components/viz";
import { formatCurrency, formatNumber, formatPercent, shortDay } from "@/lib/format";
import { FunnelCampaign, LeadRecord, LeadTag, MetaBreakdownRow } from "@/lib/types";
import { StaticLayerGrid, EngagementDotsGrid, LeadsLayerGrid } from "@/components/LayerVisual";
import ClarityKpiRow from "@/components/ClarityKpiRow";
import ClarityUsersOverviewPanel from "@/components/ClarityUsersOverviewPanel";
import ClarityInsightsPanel from "@/components/ClarityInsightsPanel";
import ClaritySmartEventsPanel from "@/components/ClaritySmartEventsPanel";
import LandingFunnelGrid from "@/components/LandingFunnelGrid";
import { DotsIcon, FunnelIcon, InsightIcon } from "@/components/icons";

// Capitalizes a raw Meta breakdown value ("mobile_app" -> "Mobile app").
function humanize(s: string): string {
  const spaced = s.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Most common non-empty value of a lead field, with its share of leads that
// actually have that field set (blank answers excluded from the denominator).
function topSegment(leads: LeadRecord[], field: "language" | "budget" | "stage"): { value: string; pct: number } | null {
  const counts = new Map<string, number>();
  let withValue = 0;
  for (const l of leads) {
    const v = l[field];
    if (!v) continue;
    withValue++;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  if (!withValue) return null;
  const [value, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { value, pct: n / withValue };
}

// Honest, real-data-only one-liners rendered as a badge over the grid box —
// null when there isn't enough real data to say anything (never fabricated).
function gridConclusion(layerNum: number, campaign: FunnelCampaign, leads: LeadRecord[]): string | null {
  const { meta, typeform, derived } = campaign;

  if (layerNum === 1) {
    const rows = meta.by_platform.filter((r) => r.impressions > 0);
    const total = rows.reduce((s, r) => s + r.impressions, 0);
    if (!rows.length || total <= 0) return null;
    const top = [...rows].sort((a, b) => b.impressions - a.impressions)[0];
    return `${humanize(top.platform ?? "unknown")} drives ${formatPercent(top.impressions / total, 0)} of impressions (€${top.spend.toFixed(2)} spent there)`;
  }
  if (layerNum === 2) {
    const rows = meta.by_platform.filter((r) => r.impressions > 0);
    if (!rows.length) return null;
    const totalImpr = rows.reduce((s, r) => s + r.impressions, 0);
    const best = [...rows].sort((a, b) => b.engagement / b.impressions - a.engagement / a.impressions)[0];
    const rate = best.engagement / best.impressions;
    const share = totalImpr > 0 ? best.impressions / totalImpr : 0;
    return `${humanize(best.platform ?? "unknown")} has the highest engagement rate (${formatPercent(rate, 1)}) on just ${formatPercent(share, 0)} of impressions`;
  }
  if (layerNum === 3) {
    const rows = meta.by_device.filter((r) => r.impressions > 0);
    if (rows.length < 2) return null;
    const sorted = [...rows].sort((a, b) => b.outbound_ctr - a.outbound_ctr);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.device === worst.device) return null;
    return `${humanize(best.device ?? "unknown")} converts to clicks at ${formatPercent(best.outbound_ctr, 1)} vs ${humanize(worst.device ?? "unknown")} at ${formatPercent(worst.outbound_ctr, 1)}`;
  }
  if (layerNum === 4) {
    if (typeform.views <= 0 || typeform.starts <= 0) return null;
    const dropViewsToStarts = 1 - typeform.starts / typeform.views;
    const dropStartsToCompletions = typeform.starts > 0 ? 1 - typeform.completions / typeform.starts : 0;
    return dropViewsToStarts >= dropStartsToCompletions
      ? `Biggest drop-off is Views → Starts: ${formatPercent(dropViewsToStarts, 0)} view the form but never start it`
      : `Biggest drop-off is Starts → Completions: ${formatPercent(dropStartsToCompletions, 0)} start the form but never finish it`;
  }
  if (layerNum === 5) {
    const top = topSegment(leads, "language");
    if (!top) return null;
    return `${formatPercent(top.pct, 0)} of submissions with a language answer are in ${top.value}`;
  }
  if (layerNum === 6) {
    const tagged = leads.filter((l) => l.tag);
    if (!leads.length) return null;
    const redShare = leads.filter((l) => l.tag === "red").length / leads.length;
    return `${formatPercent(redShare, 0)} of submissions are tagged high (red) — cost per qualified lead is ${formatCurrency(derived.cost_per_qualified_lead, 2)}${
      tagged.length < leads.length ? `, ${leads.length - tagged.length} still untagged` : ""
    }`;
  }
  return null;
}

function ConclusionBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-[var(--panel2)] px-3 py-1.5 text-center text-[11px] text-[var(--text)]">
      <span className="shrink-0 text-[var(--accent)]">
        <InsightIcon className="h-3.5 w-3.5" />
      </span>
      {text}
    </div>
  );
}

type LayerKind = "static" | "engagement" | "leads" | "qualified";

const LAYER_META: Record<number, { name: string; sub: string; kind: LayerKind; asset?: string }> = {
  1: { name: "Ad Appears", sub: "impressions", kind: "static", asset: "/funnel/vertical/layer1.png" },
  2: { name: "Engagement", sub: "post engagements", kind: "engagement" },
  3: { name: "Enters Landing Page", sub: "link clicks", kind: "static", asset: "/funnel/vertical/layer3.png" },
  4: { name: "Enters Typeform", sub: "form starts", kind: "static", asset: "/funnel/vertical/layer4.png" },
  5: { name: "Fills Typeform", sub: "submissions", kind: "leads" },
  6: { name: "Qualified Lead", sub: "red / orange / blue", kind: "qualified" },
};

export default function LayerPage({ params }: { params: { id: string; layerId: string } }) {
  const { data, loading } = useDashboard();
  const campaign = data?.campaigns.find((c) => c.campaign_id === params.id);
  const layerNum = Number(params.layerId);
  const meta = LAYER_META[layerNum];

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  useEffect(() => {
    if (!campaign) return;
    fetch(`/api/leads?campaign_id=${encodeURIComponent(campaign.campaign_id)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setLeads(json.leads ?? []));
  }, [campaign?.campaign_id, data?.last_updated]);

  async function setTag(responseId: string, tag: LeadTag) {
    setLeads((prev) => prev.map((l) => (l.response_id === responseId ? { ...l, tag } : l)));
    await fetch("/api/leads/tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_id: responseId, tag }),
    });
  }

  if (loading) {
    return <p className="pt-2 text-sm text-[var(--text-muted)]">Loading…</p>;
  }

  if (!campaign || !meta) {
    return (
      <div className="pt-2">
        <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          ← Back to overview
        </Link>
        <p className="mt-6 text-sm text-[var(--text-muted)]">Layer not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2">
      <GlowPanel className="panel flex items-center justify-between px-6 py-4">
        <div>
          <Link
            href={`/campaign/${campaign.campaign_id}`}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            ← {campaign.property}
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[var(--accent)]">
              <FunnelIcon className="h-4 w-4" />
            </span>
            <h1 className="text-lg font-semibold text-[var(--text)]">{meta.name}</h1>
          </div>
        </div>
        <span className="text-xs uppercase tracking-wide text-[var(--text-faint)]">{meta.sub}</span>
      </GlowPanel>

      {layerNum === 3 && <ClarityKpiRow clarity={campaign.clarity} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[27fr_46fr_27fr]">
        <div className="space-y-5">
          <LeftPanel layerNum={layerNum} campaign={campaign} leads={leads} />
        </div>

        <GlowPanel className="panel flex flex-col items-center gap-3 p-6">
          {(() => {
            const c = gridConclusion(layerNum, campaign, leads);
            return c ? <ConclusionBadge text={c} /> : null;
          })()}
          {layerNum === 3 && <LandingFunnelGrid engagement={campaign.landing_engagement} />}
          {layerNum !== 3 && meta.kind === "static" && <StaticLayerGrid src={meta.asset!} alt={meta.name} />}
          {meta.kind === "engagement" && <EngagementDotsGrid total={campaign.meta.engagement} />}
          {meta.kind === "leads" && <LeadsLayerGrid leads={leads} colorByTag={false} />}
          {meta.kind === "qualified" && <LeadsLayerGrid leads={leads} colorByTag onTagChange={setTag} />}
        </GlowPanel>

        <div className="space-y-5">
          <RightPanel layerNum={layerNum} campaign={campaign} leads={leads} />
        </div>
      </div>
    </div>
  );
}

// Daily/aggregate trend panel, left of the grid box.
function LeftPanel({
  layerNum,
  campaign,
  leads,
}: {
  layerNum: number;
  campaign: FunnelCampaign;
  leads: LeadRecord[];
}) {
  const { meta, typeform, derived } = campaign;

  if (layerNum === 1) {
    return (
      <StatPanel title="Daily impressions">
        <Sparkline data={meta.daily.map((d) => d.impressions)} width={280} height={70} markers />
        <StatRow label="Total impressions" value={formatNumber(meta.impressions)} accent />
        <StatRow label="Overall CTR" value={formatPercent(meta.ctr, 2)} />
        <DailyList rows={meta.daily.map((d) => ({ label: shortDay(d.date), value: formatNumber(d.impressions) }))} />
      </StatPanel>
    );
  }

  if (layerNum === 2) {
    const days = meta.daily.filter((d) => d.impressions > 0);
    const avgHookRate = days.length
      ? days.reduce((sum, d) => sum + d.engagement / d.impressions, 0) / days.length
      : 0;
    return (
      <StatPanel title="Daily engagement">
        <Sparkline data={meta.daily.map((d) => d.engagement)} width={280} height={70} markers />
        <StatRow label="Total post engagements" value={formatNumber(meta.engagement)} accent />
        <StatRow label="Avg. engagement rate" value={formatPercent(avgHookRate, 2)} />
        <DailyList rows={meta.daily.map((d) => ({ label: shortDay(d.date), value: formatNumber(d.engagement) }))} />
      </StatPanel>
    );
  }

  if (layerNum === 3) {
    return <ClarityUsersOverviewPanel clarity={campaign.clarity} />;
  }

  if (layerNum === 4) {
    const stages = [
      { label: "Views", value: typeform.views },
      { label: "Starts", value: typeform.starts },
      { label: "Completions", value: typeform.completions },
    ];
    const max = Math.max(1, ...stages.map((s) => s.value));
    return (
      <StatPanel title="Form drop-off">
        <div className="space-y-2">
          {stages.map((s) => (
            <div key={s.label}>
              <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>{s.label}</span>
                <span className="font-semibold text-[var(--text)]">{formatNumber(s.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--panel2)]">
                <div
                  className="h-2 rounded-full bg-[var(--accent)]"
                  style={{ width: `${(s.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </StatPanel>
    );
  }

  if (layerNum === 5) {
    const recent = [...leads]
      .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""))
      .slice(0, 8);
    return (
      <StatPanel title="Submissions">
        <StatRow label="Total submissions" value={formatNumber(typeform.completions)} accent />
        <StatRow label="Form completion rate" value={formatPercent(derived.form_completion_rate, 1)} />
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Most recent</p>
          {recent.map((lead) => (
            <div
              key={lead.response_id}
              className="flex items-center justify-between rounded-lg bg-[var(--panel2)] px-3 py-2 text-xs"
            >
              <span className="font-medium text-[var(--text)]">{lead.first_name || "—"}</span>
              <span className="text-[var(--text-muted)]">{lead.language || "—"}</span>
              <span className="text-[var(--text-faint)]">{formatDateShort(lead.submitted_at)}</span>
            </div>
          ))}
          {recent.length === 0 && <p className="text-xs text-[var(--text-faint)]">No submissions yet.</p>}
        </div>
      </StatPanel>
    );
  }

  // layerNum === 6
  const counts = { red: 0, orange: 0, blue: 0, none: 0 };
  for (const l of leads) {
    if (l.tag === "red") counts.red++;
    else if (l.tag === "orange") counts.orange++;
    else if (l.tag === "blue") counts.blue++;
    else counts.none++;
  }
  return (
    <StatPanel title="Qualification breakdown">
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="High (red)" value={formatNumber(counts.red)} dot="#ef4444" />
        <Kpi label="Mid (orange)" value={formatNumber(counts.orange)} dot="#f59e0b" />
        <Kpi label="Low (blue)" value={formatNumber(counts.blue)} dot="#3b82f6" />
        <Kpi label="Untagged" value={formatNumber(counts.none)} />
      </div>
      <Note>Click a square in the grid to cycle its tag — same tagging used on the Leads page.</Note>
    </StatPanel>
  );
}

// Platform/device breakdown (1-3), or segment/rate detail (4-6), right of the
// grid box.
function RightPanel({
  layerNum,
  campaign,
  leads,
}: {
  layerNum: number;
  campaign: FunnelCampaign;
  leads: LeadRecord[];
}) {
  const { meta, typeform, derived } = campaign;

  if (layerNum === 1) {
    return (
      <BreakdownPanel
        title="Where impressions land"
        platform={meta.by_platform}
        device={meta.by_device}
        metric="impressions"
        formatValue={formatNumber}
        secondary={(r) => `€${r.spend.toFixed(2)}`}
        note="Colored by impressions per platform/device, each its own real Meta Insights breakdown call — shows where budget is actually landing eyeballs, not just that it was spent."
      />
    );
  }

  if (layerNum === 2) {
    return (
      <BreakdownPanel
        title="Engagement by platform / device"
        platform={meta.by_platform}
        device={meta.by_device}
        metric="engagement"
        formatValue={formatNumber}
        secondary={(r) => (r.impressions > 0 ? formatPercent(r.engagement / r.impressions, 1) + " rate" : "—")}
        note="Watch for a platform with a small share of impressions but a much higher engagement rate — that's the case for shifting creative testing there."
      />
    );
  }

  if (layerNum === 3) {
    return (
      <>
        <ClarityInsightsPanel clarity={campaign.clarity} />
        <ClaritySmartEventsPanel engagement={campaign.landing_engagement} />
      </>
    );
  }

  if (layerNum === 4) {
    return (
      <StatPanel title="Form rates">
        <StatRow label="Completion rate" value={formatPercent(typeform.completion_rate, 1)} accent />
        <StatRow label="Click → form start" value={formatPercent(derived.click_to_form_start_rate, 1)} />
        <StatRow label="Views" value={formatNumber(typeform.views)} />
        <StatRow label="Starts" value={formatNumber(typeform.starts)} />
        <StatRow label="Completions" value={formatNumber(typeform.completions)} />
        <Note>
          Per-question drop-off (e.g. which question loses the most starters) needs a Typeform Sync workflow
          change to capture question-level data — not populated today, so it isn&apos;t shown here.
        </Note>
      </StatPanel>
    );
  }

  if (layerNum === 5) {
    const language = topSegment(leads, "language");
    const budget = topSegment(leads, "budget");
    const stage = topSegment(leads, "stage");
    return (
      <StatPanel title="Submission segments">
        <SegmentRow label="Top language" segment={language} />
        <SegmentRow label="Top budget bracket" segment={budget} />
        <SegmentRow label="Top search stage" segment={stage} />
        <Note>Computed directly from each submission&apos;s captured language/budget/stage answers — blanks excluded.</Note>
      </StatPanel>
    );
  }

  // layerNum === 6
  const redLeads = leads.filter((l) => l.tag === "red");
  const topRedBudget = topSegment(redLeads, "budget");
  return (
    <StatPanel title="Qualification value">
      <StatRow label="Cost per qualified lead" value={formatCurrency(derived.cost_per_qualified_lead, 2)} accent />
      <SegmentRow label="Top budget among high (red) leads" segment={topRedBudget} />
    </StatPanel>
  );
}

function SegmentRow({ label, segment }: { label: string; segment: { value: string; pct: number } | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--text)]">
        {segment ? `${segment.value} (${formatPercent(segment.pct, 0)})` : "—"}
      </span>
    </div>
  );
}

// Platform and device are rendered as two separate toggleable views (never
// merged into one cross-tab) — combining both breakdown dimensions in a
// single Meta Insights call risks small-cell thresholding (rows withheld),
// so the pipeline fetches them as two independent date_preset(maximum)
// calls and this just presents whichever rows actually came back.
function BreakdownPanel({
  title,
  platform,
  device,
  metric,
  formatValue,
  secondary,
  note,
  defaultView = "platform",
}: {
  title: string;
  platform: MetaBreakdownRow[];
  device: MetaBreakdownRow[];
  metric: keyof MetaBreakdownRow;
  formatValue: (v: number) => string;
  secondary?: (r: MetaBreakdownRow) => string;
  note?: string;
  defaultView?: "platform" | "device";
}) {
  const [view, setView] = useState<"platform" | "device">(defaultView);
  const rows = [...(view === "platform" ? platform : device)].sort(
    (a, b) => (Number(b[metric]) || 0) - (Number(a[metric]) || 0)
  );
  const max = Math.max(1, ...rows.map((r) => Number(r[metric]) || 0));
  return (
    <StatPanel title={title}>
      <div className="flex gap-2">
        <Pill label="Platform" active={view === "platform"} onClick={() => setView("platform")} />
        <Pill label="Device" active={view === "device"} onClick={() => setView("device")} />
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const label = (view === "platform" ? r.platform : r.device) ?? "unknown";
          const value = Number(r[metric]) || 0;
          return (
            <div key={`${label}-${i}`}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="capitalize text-[var(--text-muted)]">{label.replace(/_/g, " ")}</span>
                <span className="font-semibold text-[var(--text)]">
                  {formatValue(value)}
                  {secondary && <span className="ml-1.5 font-normal text-[var(--text-faint)]">{secondary(r)}</span>}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--panel2)]">
                <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${(value / max) * 100}%` }} />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-xs text-[var(--text-faint)]">No breakdown rows for this campaign.</p>}
      </div>
      {note && <Note>{note}</Note>}
    </StatPanel>
  );
}

function StatPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlowPanel className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
        <button className="icon-btn" aria-label="Options" disabled>
          <DotsIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </GlowPanel>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className={`text-sm font-semibold ${accent ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
        {value}
      </span>
    </div>
  );
}

function Kpi({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="rounded-xl bg-[var(--panel2)] p-3">
      <div className="flex items-center gap-1.5">
        {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        <p className="text-lg font-semibold text-[var(--text)]">{value}</p>
      </div>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function DailyList({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
      {rows
        .slice()
        .reverse()
        .map((r) => (
          <div key={r.label} className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-faint)]">{r.label}</span>
            <span className="text-[var(--text)]">{r.value}</span>
          </div>
        ))}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-[var(--border)] pt-2 text-[11px] text-[var(--text-faint)]">{children}</p>;
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
