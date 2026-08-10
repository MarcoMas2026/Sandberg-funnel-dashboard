export interface MetaDailyRow {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  leads: number;
  video_plays: number;
  engagement: number; // post_engagement (reactions/comments/shares/clicks on the ad)
  ctr: number; // 0..1
  outbound_ctr: number; // 0..1
  cpl: number; // cost per lead that day
}

// One row of a single-dimension Meta Insights breakdown call (its own
// date_preset(maximum) request — never derived from daily rows, and never
// combined with a second breakdown dimension in the same call, to avoid
// Meta's small-cell thresholding). `platform`/`device` are whatever Meta
// actually returns for that campaign (e.g. "facebook"/"instagram"/"threads",
// "desktop"/"mobile_app"/"mobile_web") — not a fixed enum, since not every
// campaign serves on every platform/device.
export interface MetaBreakdownRow {
  platform?: string;
  device?: string;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  video_plays: number;
  engagement: number;
  ctr: number; // 0..1
  outbound_ctr: number; // 0..1
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  start_date: string | null; // ISO
  stop_date: string | null; // ISO, null = ongoing
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  leads: number;
  video_plays: number;
  engagement: number; // post_engagement, used in the funnel for community campaigns
  cpm: number;
  ctr: number; // 0..1
  cpl: number; // cost per lead (spend / leads)
  outbound_ctr: number; // 0..1
  daily: MetaDailyRow[];
  by_platform: MetaBreakdownRow[];
  by_device: MetaBreakdownRow[];
}

export interface TypeformField {
  id: string;
  label: string;
  views: number;
  dropoffs: number;
  dropoff_rate: number;
}

export interface TypeformForm {
  form_id: string;
  form_name: string;
  views: number;
  starts: number;
  completions: number;
  completion_rate: number;
  fields: TypeformField[];
}

export type CampaignType = "property" | "community";

// Raw per-slug aggregate written by the "Funnel Dashboard - Landing Engagement Sync" n8n
// workflow into KV key `landing:funnel`. Section names match the `data-fnl-section` values
// in property-landing-template/index.html (hero, intro, specs, gallery, features, location, cta).
export interface LandingEngagementRaw {
  page_views: number;
  section_views: Record<string, number>;
  scroll_depth: Record<string, number>; // keys "25"|"50"|"75"|"100"
  cta_clicks: Record<string, number>; // keys "main_cta"|"sticky_cta"
}

// One funnel step derived from LandingEngagementRaw for display — a section's view
// count plus the percentage of total page_views that reached it, in template order.
export interface LandingEngagementStep {
  section: string;
  views: number;
  pct_of_page_views: number; // 0..1
}

// A single named client event with its session count, mirroring the shape of Clarity's
// own "Smart events" panel — but sourced from OUR tracker/pipeline (landing:funnel), since
// Clarity's Data Export API doesn't expose custom-event data at all, only its built-in
// traffic/scroll/friction metrics (see ClarityMetrics).
export interface LandingEventCount {
  name: string; // e.g. "page_view", "section_view:gallery", "scroll_depth:75", "cta_click:main_cta"
  sessions: number;
}

export interface LandingEngagement {
  page_views: number;
  steps: LandingEngagementStep[];
  cta_clicks: number; // main_cta + sticky_cta combined
  cta_click_rate: number; // 0..1 of page_views
  events: LandingEventCount[];
}

// Per-slug snapshot written by "Funnel Dashboard - Clarity Sync" into KV key `clarity:metrics`,
// sourced from Clarity's Data Export API (dimension1=URL, numOfDays=1 — a rolling last-24h
// snapshot, refreshed every 4h; Clarity caps this API at 10 requests/project/day so it can
// never be more real-time than that). `*_pct` fields are already 0..100 (Clarity's own scale),
// not 0..1 like the rest of this codebase's percentages — keep that distinction when formatting.
export interface ClarityMetrics {
  sessions: number;
  bot_sessions: number;
  distinct_users: number;
  pages_per_session: number;
  scroll_depth_avg: number; // 0..100
  active_time_seconds: number;
  total_time_seconds: number;
  dead_click_pct: number; // 0..100
  rage_click_pct: number; // 0..100
  excessive_scroll_pct: number; // 0..100
  quickback_pct: number; // 0..100
  script_error_pct: number; // 0..100
}

export interface FunnelCampaign {
  campaign_id: string;
  campaign_name: string;
  property: string;
  ref: string;
  campaign_type: CampaignType;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  meta: MetaCampaign;
  typeform: TypeformForm;
  // Section-level landing page drop-off, joined in at read-time (not part of the n8n
  // Merge & Finalize step) from KV key `landing:funnel`. Always present — zero-filled
  // when no events have been collected yet, so the UI can render a stable, always-visible
  // layout rather than an empty/loading state.
  landing_engagement: LandingEngagement;
  // Clarity session/engagement/friction snapshot, joined in at read-time from KV key
  // `clarity:metrics` the same way as landing_engagement. Always present, zero-filled
  // when no sessions have been recorded yet.
  clarity: ClarityMetrics;
  derived: {
    click_to_form_start_rate: number;
    form_completion_rate: number;
    cost_per_qualified_lead: number;
  };
}

export interface FunnelData {
  campaigns: FunnelCampaign[];
  last_updated: string | null;
  status: "fresh" | "stale" | "error";
}

// A single Typeform submission, captured by the Typeform Sync workflow's
// "Build Leads" node (leads:all in KV) and manually qualified in the /leads
// page. Tags live in a SEPARATE KV key (leads:tags, keyed by response_id) so
// they survive the 30-min resync that fully replaces leads:all.
export type LeadTag = "red" | "orange" | "blue" | null;

export interface LeadRecord {
  response_id: string;
  campaign_id: string;
  campaign_name: string;
  form_id: string;
  submitted_at: string | null; // ISO
  first_name: string;
  language: string;
  budget: string;
  stage: string;
  tag: LeadTag;
}

export interface CampaignMapEntry {
  meta_campaign_id: string;
  meta_campaign_name: string;
  typeform_form_id: string;
  typeform_form_name: string;
  property: string;
  ref: string;
  // "property" = a specific-listing campaign (funnel shows video views);
  // "community" = a community waitlist campaign (funnel shows engagement instead).
  campaign_type: CampaignType;
  // Folder name under sandbergestates.es/<slug>/ that the landing-engagement tracker
  // derives from window.location.pathname. Only needed when it differs from `ref`
  // (e.g. community campaigns whose ref is a display label like "Community").
  landing_slug?: string;
}

// ── OKRs (Google Sheet-backed, see lib/sheets.ts) ───────────────────────────

// Opaque sheet coordinates for a single writable cell, carried on KeyResult so
// write-back (updateKeyResultActual) can target the exact cell without the UI
// needing to know column letters. Captured live during parsing — never a
// separate re-scan, so it can't drift out of sync with the value it points to.
export interface SheetCellRef {
  tab: string; // sheet tab name, e.g. "Paid Media"
  row: number; // 1-indexed sheet row
  col: number; // 1-indexed sheet column
}

// A single named, deadline-having task belonging to a Key Result, read from
// the sheet's Aligned Tasks cell — see lib/sheets.ts's parseAlignedTasksCell
// for the exact on-cell format. Read-only: this dashboard never writes here.
export interface KrTask {
  id: string; // `${kr.id}::t${n}`, stable via the embedded {tN} token in the cell
  name: string;
  done: boolean;
  dueDate: string; // YYYY-MM-DD, always user-supplied at creation
}

export interface KeyResult {
  id: string; // stable synthetic id: `${tabSlug}-o${objIndex}-kr${krIndex}`
  name: string; // real KR description text, parsed from the cell after the "Key Result N :" label
  metric: string; // almost always "Percentage", passed through verbatim
  initial: number; // 0..1 fraction
  target: number; // 0..1 fraction (sheet's "Objective" column)
  // Always COMPUTED as tasks.length ? done/tasks.length : 0 — never read from
  // the sheet's Actual Percentage cell, which is write-only from the app's
  // perspective (kept in sync for anyone reading the raw sheet).
  actual: number; // 0..1 fraction
  progress: number; // 0..1 fraction, sheet-computed "Progress" column (a live formula there)
  tasks: KrTask[];
  actualCell: SheetCellRef; // where to write back the computed Actual Percentage
  alignedTasksCell: SheetCellRef; // where to write back the serialized task checklist
  nameCell: SheetCellRef; // the cell holding this KR's name, for rename/clear from the app
}

export interface Objective {
  id: string; // `${tabSlug}-o${objIndex}`
  index: number; // 1-based "Objective N"
  title: string; // display text only, "Objective N:" prefix already stripped
  titleCell: SheetCellRef; // the "Objective N: <title>" row's title cell, for rename/clear
  keyResults: KeyResult[];
}

export interface OkrDepartment {
  tab: string; // exact sheet tab name: "Marketing Dept" | "Paid Media" | "Organic Content"
  cycleLabel: string; // Cycle label cell, verbatim (e.g. "July 2026")
  startDate: string | null; // ISO if parseable, else null
  endDate: string | null;
  daysLeft: string; // verbatim sheet string, e.g. "14/18"
  timeProgress: number; // 0..1 fraction (time elapsed in the cycle)
  overallProgress: number; // 0..1 fraction
  objectives: Objective[];
}

export interface OkrData {
  departments: OkrDepartment[];
  fetchedAt: string; // ISO, when this GET ran
  connected: boolean; // false if Google Sheets creds are missing/invalid
  error?: string; // short message when connected=false due to a real API error
}

// ── Public View (client-facing shareable dashboards) ────────────────────────

export type PublicViewWidgetType =
  | "portfolio-spend"
  | "portfolio-leads"
  | "portfolio-cpl"
  | "campaign-spend"
  | "campaign-leads"
  | "campaign-cpl"
  | "campaign-ctr"
  | "campaign-outbound-ctr"
  | "campaign-spend-trend";

export type PublicViewTheme = "light" | "dark" | "estate";

export interface PublicViewLayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// A single pinned box on the canvas. `campaignId` is required for every
// "campaign-*" type and ignored for "portfolio-*" types (those aggregate
// across every campaign present in the resolved FunnelData).
export interface PublicViewWidget {
  id: string; // uuid, stable across edits/reorders
  type: PublicViewWidgetType;
  campaignId?: string;
  label?: string; // optional override of the widget's default title
  layout: PublicViewLayoutRect;
}

// Stored in KV per-slug. `snapshot`, when present, is a FunnelData already
// filtered down to only the campaigns referenced by `widgets` — see
// freezePublicView in lib/kv.ts. Never store the full unfiltered FunnelData
// here: that would leak every other campaign's numbers to whoever holds the link.
export interface PublicViewConfig {
  slug: string;
  propertyLabel: string;
  theme: PublicViewTheme;
  widgets: PublicViewWidget[];
  published: boolean;
  frozen: boolean;
  frozenAt: string | null; // ISO, when Freeze was last pressed
  snapshot: FunnelData | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// Lightweight per-slug entry kept in the index list so the builder can list
// every Public View without fetching each config (and its potentially large
// frozen snapshot) individually.
export interface PublicViewIndexEntry {
  slug: string;
  propertyLabel: string;
  published: boolean;
  frozen: boolean;
  updatedAt: string;
}
