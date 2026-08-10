// Campaign names follow "SP - REF - PROPERTY NAME" (e.g. "SP - 32606 - CAN VILA").
export function parseCampaignName(name: string): { ref: string; property: string } {
  const parts = String(name).split(" - ");
  if (parts.length >= 3) {
    return { ref: parts[1].trim(), property: parts.slice(2).join(" - ").trim() };
  }
  return { ref: "", property: name };
}

// Sentinel passed instead of a real ISO string for a date that genuinely
// isn't recoverable (e.g. a historical campaign's start date, when the
// backfill didn't capture it) — distinct from `null`, which means "ongoing".
export const UNAVAILABLE_DATE = "unavailable";

export function formatDate(iso: string | null): string {
  if (iso === UNAVAILABLE_DATE) return "xxx";
  if (!iso) return "Ongoing";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Short axis label for a YYYY-MM-DD daily key, e.g. "15 Jun".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function shortDay(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// NaN is the shared "genuinely not recoverable" sentinel for numeric fields
// (e.g. a historical campaign's landing-page/Clarity metrics) — every
// formatter below renders it as "xxx" instead of "NaN"/"€NaN", and NaN
// propagates naturally through any arithmetic done on it (rate = x / NaN
// stays NaN), so callers don't need to special-case it themselves. `null`/
// `undefined` are treated the same way — JSON.stringify silently turns NaN
// into null (JSON has no NaN literal), so any NaN sentinel that crossed an
// API boundary (e.g. /api/history/campaign-detail) arrives on the client as
// null, not NaN. Without this it would slip past Number.isNaN and crash on
// n.toLocaleString().
function isUnavailable(n: number | null | undefined): n is null | undefined {
  return n === null || n === undefined || Number.isNaN(n);
}

export function formatCurrency(n: number | null | undefined, decimals = 0): string {
  if (isUnavailable(n)) return "xxx";
  return `€${n.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatNumber(n: number | null | undefined): string {
  if (isUnavailable(n)) return "xxx";
  return Math.round(n).toLocaleString("en-GB");
}

export function formatPercent(fraction: number | null | undefined, decimals = 1): string {
  if (isUnavailable(fraction)) return "xxx";
  return `${(fraction * 100).toFixed(decimals)}%`;
}

// "Today" as YYYY-MM-DD in Europe/Madrid — the timezone the rest of this repo
// already uses for day-boundary logic (see Typeform submission grouping in
// CONTEXT.md). Used to keep OKR board generation, cron firing, and the sheet's
// own date cells reasoning about "today" consistently.
// Seconds -> "1.1 min" / "45 sec", matching Clarity's own dashboard formatting.
export function formatDuration(seconds: number | null | undefined): string {
  if (isUnavailable(seconds)) return "xxx";
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  return `${(seconds / 60).toFixed(1)} min`;
}

export function todayISOMadrid(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}
