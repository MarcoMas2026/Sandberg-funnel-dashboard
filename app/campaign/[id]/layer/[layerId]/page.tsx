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
import ClarityInsightsPanel from "@/components/ClarityInsightsPanel";
import ClaritySmartEventsPanel from "@/components/ClaritySmartEventsPanel";
import LandingFunnelGrid from "@/components/LandingFunnelGrid";
import LandingDeviceGrid from "@/components/LandingDeviceGrid";
import VideoRetentionPanel from "@/components/VideoRetentionPanel";
import VideoFunnelPanel from "@/components/VideoFunnelPanel";
import TypeformDropoffPanel from "@/components/TypeformDropoffPanel";
import LeadSegmentationMatrix from "@/components/LeadSegmentationMatrix";
import LeadsDailyPanel from "@/components/LeadsDailyPanel";
import { Skeleton } from "@/components/ui/skeleton";
import LayerMenu from "@/components/LayerMenu";
import { ArrowLeft, DotsThree, Funnel, Lightbulb } from "@phosphor-icons/react";

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
    return `${humanize(top.platform ?? "unknown")} drives ${formatPercent(top.impressions / total, 0)} of impressions (${top.spend.toFixed(2)}€ spent there)`;
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
    return `${formatPercent(redShare, 0)} of submissions are tagged high (red), cost per qualified lead is ${formatCurrency(derived.cost_per_qualified_lead, 2)}${
      tagged.length < leads.length ? `, ${leads.length - tagged.length} still untagged` : ""
    }`;
  }
  return null;
}

function ConclusionBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-[var(--panel2)] px-3 py-1.5 text-center text-[11px] text-[var(--text)]">
      <span className="shrink-0 text-[var(--accent)]">
        <Lightbulb className="h-3.5 w-3.5" />
      </span>
      {text}
    </div>
  );
}

type LayerKind = "static" | "engagement" | "landing-device" | "leads" | "qualified";

const LAYER_META: Record<number, { name: string; sub: string; kind: LayerKind; asset?: string }> = {
  1: { name: "Ad Appears", sub: "impressions", kind: "static", asset: "/funnel/vertical/layer1.png" },
  2: { name: "Engagement", sub: "post engagements", kind: "engagement" },
  3: { name: "Enters Landing Page", sub: "link clicks", kind: "landing-device" },
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
    return (
      <div className="space-y-5 pt-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
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
      <GlowPanel className="panel flex flex-col gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/campaign/${campaign.campaign_id}`}
            aria-label={`Back to ${campaign.property}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--panel2)] text-[var(--text-muted)] transition-colors hover:bg-[var(--panel3)] hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-xs text-[var(--text-muted)]">{campaign.property}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[var(--accent)]">
                <Funnel className="h-4 w-4" />
              </span>
              <h1 className="text-lg font-semibold text-[var(--text)]">{meta.name}</h1>
              <span className="text-xs uppercase tracking-wide text-[var(--text-faint)]">{meta.sub}</span>
            </div>
          </div>
        </div>
        <LayerMenu campaignId={campaign.campaign_id} activeLayer={layerNum} />
      </GlowPanel>

      {layerNum === 3 && <ClarityKpiRow clarity={campaign.clarity} />}

      {/* Mobile: grid box first, then Left/Right stat panels (order-* below).
          Desktop (lg+): unchanged 3-column layout via order-none, reverting
          to source order = Left | Grid | Right columns. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[27fr_46fr_27fr]">
        <div className="order-2 space-y-5 lg:order-none">
          <LeftPanel layerNum={layerNum} campaign={campaign} leads={leads} />
        </div>

        <GlowPanel className="order-1 panel flex flex-col items-center gap-3 p-6 lg:order-none">
          {(() => {
            const c = gridConclusion(layerNum, campaign, leads);
            return c ? <ConclusionBadge text={c} /> : null;
          })()}
          {meta.kind === "static" && <StaticLayerGrid src={meta.asset!} alt={meta.name} />}
          {meta.kind === "landing-device" && <LandingDeviceGrid byDevice={campaign.meta.by_device} />}
          {meta.kind === "engagement" && <EngagementDotsGrid total={campaign.meta.engagement} />}
          {meta.kind === "leads" && <LeadsLayerGrid leads={leads} colorByTag={false} />}
          {meta.kind === "qualified" && <LeadsLayerGrid leads={leads} colorByTag onTagChange={setTag} />}
        </GlowPanel>

        <div className="order-3 space-y-5 lg:order-none">
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
  const { meta, typeform } = campaign;

  if (layerNum === 1) {
    return (
      <>
        <StatPanel title="Daily impressions">
          <Sparkline data={meta.daily.map((d) => d.impressions)} width={280} height={70} markers />
          <StatRow label="Total impressions" value={formatNumber(meta.impressions)} accent />
          <DailyList rows={meta.daily.map((d) => ({ label: shortDay(d.date), value: formatNumber(d.impressions) }))} />
        </StatPanel>
        <StatPanel title="Overall CTR">
          <Sparkline data={meta.daily.map((d) => d.ctr)} width={280} height={70} markers stroke="#8b5cf6" />
          <StatRow label="Overall CTR" value={formatPercent(meta.ctr, 2)} accent />
          <DailyList rows={meta.daily.map((d) => ({ label: shortDay(d.date), value: formatPercent(d.ctr, 2) }))} />
        </StatPanel>
      </>
    );
  }

  if (layerNum === 2) {
    return <VideoRetentionPanel />;
  }

  if (layerNum === 3) {
    return <LandingFunnelGrid engagement={campaign.landing_engagement} />;
  }

  if (layerNum === 4) {
    return <TypeformDropoffPanel views={typeform.views} starts={typeform.starts} completions={typeform.completions} />;
  }

  // layerNum 5 and 6 share the same segmentation matrix
  return <LeadSegmentationMatrix leads={leads} />;
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
  const { meta, typeform } = campaign;

  if (layerNum === 1) {
    return (
      <>
        <BreakdownPanel
          title="Platform breakdown"
          platform={meta.by_platform}
          device={meta.by_device}
          metric="impressions"
          formatValue={formatNumber}
          secondary={(r) => `${r.spend.toFixed(2)}€`}
          fixedView="platform"
          note="Shown as period totals, a true day-by-day trend per platform needs a Meta Sync workflow change to fetch breakdowns with time_increment, not fetched today."
        />
        <BreakdownPanel
          title="Device breakdown"
          platform={meta.by_platform}
          device={meta.by_device}
          metric="impressions"
          formatValue={formatNumber}
          secondary={(r) => `${r.spend.toFixed(2)}€`}
          fixedView="device"
          note="Shown as period totals, a true day-by-day trend per device needs the same Meta Sync workflow change, not fetched today."
        />
      </>
    );
  }

  if (layerNum === 2) {
    return (
      <VideoFunnelPanel
        impressions={meta.impressions}
        videoPlays={meta.video_plays}
        linkClicks={meta.link_clicks}
        leads={typeform.completions}
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
        <StatRow label="Views" value={formatNumber(typeform.views)} />
        <StatRow label="Starts" value={formatNumber(typeform.starts)} />
        <StatRow label="Submissions" value={formatNumber(typeform.completions)} accent />
        <StatRow label="Completion rate" value={formatPercent(typeform.completion_rate, 1)} accent />
        <StatRow label="Time to complete" value="—" />
        <Note>Time to complete needs a per-response duration field the Typeform Sync workflow doesn&apos;t capture today.</Note>
      </StatPanel>
    );
  }

  // layerNum 5 and 6 share the daily activity panel
  return <LeadsDailyPanel leads={leads} />;
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
  fixedView,
}: {
  title: string;
  platform: MetaBreakdownRow[];
  device: MetaBreakdownRow[];
  metric: keyof MetaBreakdownRow;
  formatValue: (v: number) => string;
  secondary?: (r: MetaBreakdownRow) => string;
  note?: string;
  defaultView?: "platform" | "device";
  fixedView?: "platform" | "device";
}) {
  const [view, setView] = useState<"platform" | "device">(fixedView ?? defaultView);
  const effectiveView = fixedView ?? view;
  const rows = [...(effectiveView === "platform" ? platform : device)].sort(
    (a, b) => (Number(b[metric]) || 0) - (Number(a[metric]) || 0)
  );
  const max = Math.max(1, ...rows.map((r) => Number(r[metric]) || 0));
  return (
    <StatPanel title={title}>
      {!fixedView && (
        <div className="flex gap-2">
          <Pill label="Platform" active={view === "platform"} onClick={() => setView("platform")} />
          <Pill label="Device" active={view === "device"} onClick={() => setView("device")} />
        </div>
      )}
      <div className="space-y-2">
        {rows.map((r, i) => {
          const label = (effectiveView === "platform" ? r.platform : r.device) ?? "unknown";
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
          <DotsThree className="h-4 w-4" />
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

