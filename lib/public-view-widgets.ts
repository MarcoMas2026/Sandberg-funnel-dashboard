import { PublicViewWidget, PublicViewWidgetType } from "./types";

export interface WidgetDef {
  type: PublicViewWidgetType;
  label: string;
  scope: "portfolio" | "campaign";
  defaultSize: { w: number; h: number };
}

// The pinnable widget catalogue. Kept dependency-free (no React/recharts) so
// it can be imported from both server-only code (lib/kv.ts, for the
// server-side pin-append endpoint) and client components (Pinnable, the
// builder) without pulling client-only code into the server bundle.
export const WIDGET_DEFS: WidgetDef[] = [
  { type: "portfolio-spend", label: "Total Spend", scope: "portfolio", defaultSize: { w: 3, h: 2 } },
  { type: "portfolio-leads", label: "Total Leads", scope: "portfolio", defaultSize: { w: 3, h: 2 } },
  { type: "portfolio-cpl", label: "Blended Cost / Lead", scope: "portfolio", defaultSize: { w: 3, h: 2 } },
  { type: "campaign-spend", label: "Spend", scope: "campaign", defaultSize: { w: 3, h: 2 } },
  { type: "campaign-leads", label: "Leads", scope: "campaign", defaultSize: { w: 3, h: 2 } },
  { type: "campaign-cpl", label: "Cost / Lead", scope: "campaign", defaultSize: { w: 3, h: 2 } },
  { type: "campaign-ctr", label: "Overall CTR", scope: "campaign", defaultSize: { w: 3, h: 2 } },
  { type: "campaign-outbound-ctr", label: "Outbound CTR", scope: "campaign", defaultSize: { w: 3, h: 2 } },
  { type: "campaign-spend-trend", label: "Spend Trend", scope: "campaign", defaultSize: { w: 6, h: 3 } },
];

export function widgetDef(type: PublicViewWidgetType): WidgetDef {
  const def = WIDGET_DEFS.find((d) => d.type === type);
  if (!def) throw new Error(`Unknown widget type "${type}"`);
  return def;
}

export function createWidget(
  type: PublicViewWidgetType,
  campaignId: string | undefined,
  existing: PublicViewWidget[]
): PublicViewWidget {
  const def = widgetDef(type);
  const y = existing.reduce((max, w) => Math.max(max, w.layout.y + w.layout.h), 0);
  return {
    id: crypto.randomUUID(),
    type,
    campaignId,
    layout: { x: 0, y, w: def.defaultSize.w, h: def.defaultSize.h },
  };
}
