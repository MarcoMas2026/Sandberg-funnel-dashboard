"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FunnelData, MetaDailyRow, PublicViewWidget } from "./types";
import { formatCurrency, formatNumber, formatPercent, shortDay } from "./format";
import { WidgetDef, widgetDef } from "./public-view-widgets";

export { WIDGET_DEFS, widgetDef, createWidget } from "./public-view-widgets";
export type { WidgetDef } from "./public-view-widgets";

function findCampaign(data: FunnelData, campaignId?: string) {
  return data.campaigns.find((c) => c.campaign_id === campaignId);
}

// Leads = Typeform submissions per this repo's data-accuracy rule (see
// CLAUDE.md) — never Meta's lead pixel. Cost-per-lead follows the same rule:
// spend / submissions, computed here rather than trusting meta.cpl for the
// blended portfolio figure (meta.cpl is only ever per-campaign).
function sumSpend(data: FunnelData) {
  return data.campaigns.reduce((sum, c) => sum + c.meta.spend, 0);
}
function sumLeads(data: FunnelData) {
  return data.campaigns.reduce((sum, c) => sum + c.typeform.completions, 0);
}

function campaignTileTitle(widget: PublicViewWidget, data: FunnelData, def: WidgetDef) {
  const c = findCampaign(data, widget.campaignId);
  return c ? `${c.property} — ${def.label}` : def.label;
}

export function PublicViewTile({ widget, data }: { widget: PublicViewWidget; data: FunnelData }) {
  const def = widgetDef(widget.type);
  const title =
    widget.label ?? (def.scope === "campaign" ? campaignTileTitle(widget, data, def) : def.label);

  switch (widget.type) {
    case "portfolio-spend":
      return <StatTile title={title} value={formatCurrency(sumSpend(data))} />;
    case "portfolio-leads":
      return <StatTile title={title} value={formatNumber(sumLeads(data))} />;
    case "portfolio-cpl": {
      const spend = sumSpend(data);
      const leads = sumLeads(data);
      return <StatTile title={title} value={formatCurrency(leads ? spend / leads : NaN)} />;
    }
    case "campaign-spend": {
      const c = findCampaign(data, widget.campaignId);
      return <StatTile title={title} value={formatCurrency(c?.meta.spend ?? NaN)} />;
    }
    case "campaign-leads": {
      const c = findCampaign(data, widget.campaignId);
      return <StatTile title={title} value={formatNumber(c?.typeform.completions ?? NaN)} />;
    }
    case "campaign-cpl": {
      const c = findCampaign(data, widget.campaignId);
      return <StatTile title={title} value={formatCurrency(c?.meta.cpl ?? NaN)} />;
    }
    case "campaign-ctr": {
      const c = findCampaign(data, widget.campaignId);
      return <StatTile title={title} value={formatPercent(c?.meta.ctr ?? NaN)} />;
    }
    case "campaign-outbound-ctr": {
      const c = findCampaign(data, widget.campaignId);
      return <StatTile title={title} value={formatPercent(c?.meta.outbound_ctr ?? NaN)} />;
    }
    case "campaign-spend-trend": {
      const c = findCampaign(data, widget.campaignId);
      return <TrendTile title={title} daily={c?.meta.daily ?? []} />;
    }
    default:
      return null;
  }
}

function StatTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="pv-tile">
      <div className="pv-tile-title">{title}</div>
      <div className="pv-tile-value">{value}</div>
    </div>
  );
}

function TrendTile({ title, daily }: { title: string; daily: MetaDailyRow[] }) {
  const chartData = daily.map((d) => ({ label: shortDay(d.date), spend: Number(d.spend.toFixed(2)) }));
  return (
    <div className="pv-tile pv-tile--chart">
      <div className="pv-tile-title">{title}</div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--pv-muted)" }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: "var(--pv-surface)", border: "1px solid var(--pv-border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--pv-text)" }}
          />
          <Area type="monotone" dataKey="spend" stroke="var(--pv-accent)" fill="var(--pv-accent)" fillOpacity={0.18} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
