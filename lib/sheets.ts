import { google, sheets_v4 } from "googleapis";
import { computeKrActualFromTasks } from "./okr-pace";
import { KeyResult, KrTask, Objective, OkrData, OkrDepartment, SheetCellRef } from "./types";

const TABS = ["Marketing Dept", "Paid Media", "Organic Content"] as const;

// Header labels for the per-tab stat block (Cycle / Start Date / End Date /
// Days Left / Time Progress / Overall Progress). Verified live against the
// sheet: value is the first non-empty cell scanning rightward from the label,
// which naturally skips decorative cells (e.g. a `=sparkline(...)` cell reads
// as empty via the API since it renders a chart, not text).
const STAT_LABELS = [
  "Cycle",
  "Start Date",
  "End Date",
  "Days Left",
  "Time Progress",
  "Overall Progress",
] as const;

// Column headers of the Key-Result table. Column letters drift between tabs
// (confirmed live: Marketing Dept and Paid Media use different columns), so
// this header row is located dynamically once per tab, never hardcoded.
const KR_HEADERS = ["Metric", "Initial Percentage", "Objective", "Actual Percentage", "Progress"] as const;
const ALIGNED_HEADER = "Aligned Tasks";
const KEY_RESULT_LABEL_RE = /^key result\s*\d+\s*:?$/;

const MONTH_NAMES_FULL = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function tabSlug(tab: string): string {
  return tab.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

export function parsePercent(raw: unknown): number {
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  const n = parseFloat(s.replace("%", ""));
  return isNaN(n) ? 0 : n / 100;
}

// 1-indexed column number -> A1 letter(s). 1->A, 26->Z, 27->AA.
export function colToA1(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const rem = (x - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

// One task per line inside the single Aligned Tasks cell (Sheets cells
// support \n). Parsed by stripping fixed-shape suffixes right-to-left, so
// arbitrary punctuation in a task name never causes ambiguity — e.g.
// "Edit final cut w/ b-roll (2nd pass) (due 2026-07-25) {t3}" parses fine
// since only the LAST "(due ...)"/"{tN}" tokens are treated as structural.
// Lines that don't start with a checkbox (legacy free-text notes some KRs
// already had, e.g. "32242, 32254, 31740") are skipped, not force-parsed —
// confirmed acceptable to overwrite on first real task add to that KR.
export function parseAlignedTasksCell(raw: string, krId: string): KrTask[] {
  const lines = String(raw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const tasks: KrTask[] = [];
  let autoN = 0;

  for (const line of lines) {
    const checkboxMatch = line.match(/^\[( |x|X)\]\s*(.*)$/);
    if (!checkboxMatch) continue;
    const done = checkboxMatch[1].toLowerCase() === "x";
    let rest = checkboxMatch[2];

    let n: number | null = null;
    const idMatch = rest.match(/\{t(\d+)\}\s*$/);
    if (idMatch) {
      n = parseInt(idMatch[1], 10);
      rest = rest.slice(0, idMatch.index).trim();
    }

    let dueDate = "";
    const dueMatch = rest.match(/\(due\s+(\d{4}-\d{2}-\d{2})\)\s*$/);
    if (dueMatch) {
      dueDate = dueMatch[1];
      rest = rest.slice(0, dueMatch.index).trim();
    }

    if (n === null) {
      autoN += 1;
      n = autoN;
    } else {
      autoN = Math.max(autoN, n);
    }

    tasks.push({ id: `${krId}::t${n}`, name: rest, done, dueDate });
  }

  return tasks;
}

export function serializeAlignedTasksCell(tasks: KrTask[]): string {
  return tasks
    .map((t) => {
      const n = t.id.split("::t")[1] ?? "0";
      const checkbox = t.done ? "[x]" : "[ ]";
      const due = t.dueDate ? ` (due ${t.dueDate})` : "";
      return `${checkbox} ${t.name}${due} {t${n}}`;
    })
    .join("\n");
}

function getAuth(): sheets_v4.Sheets | null {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!email || !key || !spreadsheetId) return null;

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// Finds the first non-empty cell in `row` scanning rightward from (and
// excluding) `fromCol`, up to `maxCol`. Returns "" if none found.
function scanRight(row: string[], fromCol: number, maxCol: number): string {
  for (let c = fromCol + 1; c <= maxCol && c < row.length; c++) {
    const v = row[c];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function parseTab(tab: string, rows: string[][]): OkrDepartment {
  const maxCol = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const stats: Record<string, string> = {};

  const headRows = rows.slice(0, 12);
  for (let r = 0; r < headRows.length; r++) {
    const row = headRows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const cell = norm(row[c]).replace(/:$/, "");
      const match = STAT_LABELS.find((label) => norm(label) === cell);
      if (match) stats[match] = scanRight(row, c, maxCol);
    }
  }

  // Locate the Key-Result header row: one row containing all of KR_HEADERS.
  let headerRowIdx = -1;
  const cols: Partial<Record<(typeof KR_HEADERS)[number] | "Aligned Tasks", number>> = {};
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const normed = row.map(norm);
    const hasAll = KR_HEADERS.every((h) => normed.some((c) => c.startsWith(norm(h))));
    if (hasAll) {
      headerRowIdx = r;
      for (const h of KR_HEADERS) {
        cols[h] = normed.findIndex((c) => c.startsWith(norm(h)));
      }
      const alignedIdx = normed.findIndex((c) => c.startsWith(norm(ALIGNED_HEADER)));
      if (alignedIdx >= 0) cols[ALIGNED_HEADER] = alignedIdx;
      break;
    }
  }

  const objectives: Objective[] = [];
  if (headerRowIdx >= 0) {
    const metricCol = cols["Metric"]!;
    const initialCol = cols["Initial Percentage"]!;
    const targetCol = cols["Objective"]!;
    const actualCol = cols["Actual Percentage"]!;
    const progressCol = cols["Progress"]!;
    const alignedCol = cols[ALIGNED_HEADER];

    let current: Objective | null = null;
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      // `||`, not `??` — column A is an empty string ("") in almost every row
      // here, not undefined, so `??` would never fall through to column B.
      const firstCell = String(row[0] || row[1] || "").trim();
      const objMatch = firstCell.match(/^Objective\s+(\d+)/i);

      if (objMatch) {
        // Left empty (not falling back to the "Objective N:" label) when the
        // sheet hasn't filled this objective in yet — lib/okr-tasks.ts uses
        // an empty title to skip generating tasks for still-blank templates.
        current = {
          id: `${tabSlug(tab)}-o${objMatch[1]}`,
          index: parseInt(objMatch[1], 10),
          title: firstCell.replace(/^Objective\s+\d+:?\s*/i, "").trim(),
          keyResults: [],
        };
        objectives.push(current);
        continue;
      }

      const metricVal = row[metricCol];
      if (current && metricVal !== undefined && String(metricVal).trim() !== "") {
        const krIndex = current.keyResults.length + 1;
        const krId = `${current.id}-kr${krIndex}`;

        // The real KR description sits in the cell immediately after
        // whichever cell in this row matches "Key Result N :" — located
        // dynamically per-row (not a hardcoded column) for the same reason
        // the metric-table columns are, since column drift already exists.
        const labelIdx = row.findIndex((c) => KEY_RESULT_LABEL_RE.test(norm(c)));
        const name = labelIdx >= 0 ? String(row[labelIdx + 1] ?? "").trim() : "";

        const tasks = alignedCol !== undefined ? parseAlignedTasksCell(String(row[alignedCol] ?? ""), krId) : [];

        const kr: KeyResult = {
          id: krId,
          name,
          metric: String(metricVal).trim(),
          initial: parsePercent(row[initialCol]),
          target: parsePercent(row[targetCol]),
          actual: computeKrActualFromTasks(tasks),
          progress: parsePercent(row[progressCol]),
          tasks,
          actualCell: { tab, row: r + 1, col: actualCol + 1 }, // 1-indexed for the Sheets API
          alignedTasksCell: { tab, row: r + 1, col: (alignedCol ?? actualCol) + 1 },
        };
        current.keyResults.push(kr);
      }
    }
  }

  const rawStart = stats["Start Date"];
  const rawEnd = stats["End Date"];
  const toISO = (s: string | undefined) => {
    if (!s) return null;
    // Parse "July 1, 2026" directly rather than through `new Date(...)` +
    // toISOString(), which parses as local midnight then converts to UTC —
    // shifting the date back a day in any timezone behind UTC.
    const match = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
    if (match) {
      const monthIdx = MONTH_NAMES_FULL.findIndex((m) => m === match[1].toLowerCase());
      if (monthIdx >= 0) {
        const mm = String(monthIdx + 1).padStart(2, "0");
        const dd = String(parseInt(match[2], 10)).padStart(2, "0");
        return `${match[3]}-${mm}-${dd}`;
      }
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  };

  return {
    tab,
    cycleLabel: stats["Cycle"] ?? "",
    startDate: toISO(rawStart),
    endDate: toISO(rawEnd),
    daysLeft: stats["Days Left"] ?? "",
    timeProgress: parsePercent(stats["Time Progress"]),
    overallProgress: parsePercent(stats["Overall Progress"]),
    objectives,
  };
}

export async function getOkrData(): Promise<OkrData> {
  const fetchedAt = new Date().toISOString();
  const sheets = getAuth();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!sheets || !spreadsheetId) {
    return {
      departments: [],
      fetchedAt,
      connected: false,
      error: "Google Sheets is not configured — missing service account credentials or spreadsheet ID.",
    };
  }

  try {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: TABS.map((t) => `'${t}'!A1:Z200`),
      valueRenderOption: "FORMATTED_VALUE",
    });

    const valueRanges = res.data.valueRanges ?? [];
    const departments = TABS.map((tab, i) => parseTab(tab, (valueRanges[i]?.values as string[][]) ?? []));

    return { departments, fetchedAt, connected: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error reading the sheet";
    return { departments: [], fetchedAt, connected: false, error: message };
  }
}

// The only sheet write path for a Key Result: updates its task checklist and
// its (computed) Actual Percentage in one atomic batchUpdate, so a mark-done
// action never leaves the sheet with the list updated but the percentage
// stale (or vice versa). The sheet's own "Progress" column is a live formula
// off Actual/Initial/Objective, so nothing else needs writing.
export async function writeKeyResultTasks(kr: KeyResult, tasks: KrTask[]): Promise<void> {
  const sheets = getAuth();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!sheets || !spreadsheetId) throw new Error("Google Sheets is not configured");

  const newActual = computeKrActualFromTasks(tasks);
  const alignedRange = `'${kr.alignedTasksCell.tab}'!${colToA1(kr.alignedTasksCell.col)}${kr.alignedTasksCell.row}`;
  const actualRange = `'${kr.actualCell.tab}'!${colToA1(kr.actualCell.col)}${kr.actualCell.row}`;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: alignedRange, values: [[serializeAlignedTasksCell(tasks)]] },
        { range: actualRange, values: [[`${Math.round(newActual * 1000) / 10}%`]] },
      ],
    },
  });
}
