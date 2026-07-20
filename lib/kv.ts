import { FunnelData, HistoricalCampaign, KanbanBoard, PendingSelection } from "./types";
import { todayISOMadrid } from "./format";

const FUNNEL_KEY = "funnel:merged";
const HISTORICAL_KEY = "historical:campaigns";
const OKR_BOARD_KEY = "okr:board";
const PENDING_SELECTION_KEY = "okr:pendingSelection";

function kvHeaders() {
  return { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` };
}

export async function getFunnelData(): Promise<FunnelData> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${FUNNEL_KEY}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  const { result } = await res.json();

  if (!result) {
    return { campaigns: [], last_updated: null, status: "stale" };
  }

  return JSON.parse(result) as FunnelData;
}

export async function setFunnelData(data: FunnelData): Promise<void> {
  await fetch(`${process.env.KV_REST_API_URL}/set/${FUNNEL_KEY}`, {
    method: "POST",
    headers: { ...kvHeaders(), "Content-Type": "text/plain" },
    body: JSON.stringify(data),
    cache: "no-store",
  });
}

// Pool of past (inactive) campaigns with verified Typeform attribution, used
// as performance benchmarks in Compare. Populated by a manual backfill, not
// the regular Update pipeline — see CONTEXT.md for how/when to refresh it.
export async function getHistoricalCampaigns(): Promise<HistoricalCampaign[]> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${HISTORICAL_KEY}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  const { result } = await res.json();

  if (!result) return [];

  return JSON.parse(result) as HistoricalCampaign[];
}

// The daily OKR-driven Kanban board (see lib/okr-tasks.ts). Single key, same
// pattern as funnel:merged — no per-day key history, since the Google Sheet
// itself is the durable OKR record; this only needs "today's board" plus
// whatever it carries forward.
export async function getKanbanBoard(): Promise<KanbanBoard> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${OKR_BOARD_KEY}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  const { result } = await res.json();

  if (!result) {
    return { date: todayISOMadrid(), tasks: [], checkinDue: false, lastGeneratedAt: null, lastCheckinAt: null };
  }

  return JSON.parse(result) as KanbanBoard;
}

export async function setKanbanBoard(board: KanbanBoard): Promise<void> {
  await fetch(`${process.env.KV_REST_API_URL}/set/${OKR_BOARD_KEY}`, {
    method: "POST",
    headers: { ...kvHeaders(), "Content-Type": "text/plain" },
    body: JSON.stringify(board),
    cache: "no-store",
  });
}

// The evening check-in's "tomorrow" task selection, consumed once by the
// morning cron (see activateNextBoard in lib/okr-tasks.ts) then cleared.
export async function getPendingSelection(): Promise<PendingSelection | null> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${PENDING_SELECTION_KEY}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  const { result } = await res.json();
  if (!result) return null;
  return JSON.parse(result) as PendingSelection;
}

export async function setPendingSelection(selection: PendingSelection): Promise<void> {
  await fetch(`${process.env.KV_REST_API_URL}/set/${PENDING_SELECTION_KEY}`, {
    method: "POST",
    headers: { ...kvHeaders(), "Content-Type": "text/plain" },
    body: JSON.stringify(selection),
    cache: "no-store",
  });
}

export async function clearPendingSelection(): Promise<void> {
  await fetch(`${process.env.KV_REST_API_URL}/del/${PENDING_SELECTION_KEY}`, {
    method: "POST",
    headers: kvHeaders(),
    cache: "no-store",
  });
}
