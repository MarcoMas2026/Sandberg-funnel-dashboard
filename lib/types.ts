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

export interface FunnelCampaign {
  campaign_id: string;
  campaign_name: string;
  property: string;
  ref: string;
  campaign_type: CampaignType;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  meta: MetaCampaign;
  typeform: TypeformForm;
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

// A resolved past campaign used as a performance benchmark in the Compare view.
// Only campaigns whose Typeform submissions could be verifiably attributed to
// THAT specific campaign (via a hidden field matching its ref, or — for the
// one campaign type with no ref — its own utm_campaign) are included. See
// historical:campaigns in KV / CONTEXT.md for how this pool is populated.
export interface HistoricalCampaign {
  campaign_id: string;
  campaign_name: string;
  property: string;
  ref: string;
  campaign_type: CampaignType;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  leads: number; // Typeform submissions
  starts: number; // Typeform starts (completed + partial)
  ctr: number; // 0..1
  cpl: number; // spend / leads
  click_to_form_start_rate: number; // 0..1
  form_completion_rate: number; // 0..1
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

// A single named, deadline-having task belonging to a Key Result. Authored
// only in the platform (never hand-typed into the sheet) but mirrored into
// the sheet's Aligned Tasks cell as a readable checklist — see
// lib/sheets.ts's parseAlignedTasksCell/serializeAlignedTasksCell for the
// exact on-cell format.
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
}

export interface Objective {
  id: string; // `${tabSlug}-o${objIndex}`
  index: number; // 1-based "Objective N"
  title: string; // full heading text, e.g. "Objective 1: Build funnel visibility & measurement"
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

// ── Kanban / daily task automation ──────────────────────────────────────────

// Candidates not selected for a given day simply don't appear on the board —
// there's no "backlog" status; unselected KrTasks only ever surface in the
// evening check-in's tomorrow-selection screen (see lib/okr-tasks.ts).
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "high" | "medium" | "low";

// A KrTask placed onto a specific day's board. `id`/`title`/`dueDate` mirror
// the underlying KrTask directly (no more auto-synthesized titles) — this is
// a thin projection, not a separate task-authoring concept.
export interface KanbanTask {
  id: string; // same id as the underlying KrTask
  title: string; // the KrTask's own name
  krId: string; // KeyResult.id this task targets
  krLabel: string; // denormalized human label, e.g. "Paid Media · Build funnel visibility & measurement"
  department: string; // tab name, denormalized for display/grouping
  priority: TaskPriority; // recomputed fresh from the parent KR's pace gap every time the board is built
  reasoning: string; // short generated string, e.g. "12% behind expected pace"
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD, the KrTask's own user-set deadline
  createdAt: string; // ISO date this task was first placed on a board
  carriedForwardFrom?: string; // ISO date it first appeared on a board, once carried over
  lastCheckin?: {
    date: string; // ISO
    outcome: "done" | "in_progress" | "blocked";
  };
}

export interface KanbanBoard {
  date: string; // ISO date (YYYY-MM-DD, Europe/Madrid) this board was generated for
  tasks: KanbanTask[];
  checkinDue: boolean; // set by the evening cron, cleared by a check-in submission
  lastGeneratedAt: string | null; // ISO timestamp of the last board-activation run
  lastCheckinAt: string | null; // ISO timestamp of the last check-in submission
}

// Written by the evening check-in's "tomorrow" selection step, consumed once
// by the morning cron (see activateNextBoard in lib/okr-tasks.ts).
export interface PendingSelection {
  date: string; // ISO date this selection is FOR (tomorrow, from the check-in's perspective)
  taskIds: string[]; // chosen KrTask ids
}

// ── Check-in (afternoon) ─────────────────────────────────────────────────────

// Renamed from "partial" — no longer a %-progress concept now that KR
// progress is purely completed/total tasks.
export type CheckinOutcome = "done" | "in_progress" | "blocked";

export interface CheckinAnswer {
  taskId: string;
  outcome: CheckinOutcome; // "done" flips the underlying KrTask.done = true
}

export interface CheckinSubmission {
  date: string; // ISO date of the check-in
  answers: CheckinAnswer[];
  tomorrowSelection: string[]; // KrTask ids chosen from the ranked candidate pool
}
