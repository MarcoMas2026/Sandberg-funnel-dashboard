// Campaign names follow "SP - REF - PROPERTY NAME" (e.g. "SP - 32606 - CAN VILA").
export function parseCampaignName(name: string): { ref: string; property: string } {
  const parts = String(name).split(" - ");
  if (parts.length >= 3) {
    return { ref: parts[1].trim(), property: parts.slice(2).join(" - ").trim() };
  }
  return { ref: "", property: name };
}

export function formatDate(iso: string | null): string {
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

export function formatCurrency(n: number, decimals = 0): string {
  return `€${n.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

export function formatPercent(fraction: number, decimals = 1): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

// "Today" as YYYY-MM-DD in Europe/Madrid — the timezone the rest of this repo
// already uses for day-boundary logic (see Typeform submission grouping in
// CONTEXT.md). Used to keep OKR board generation, cron firing, and the sheet's
// own date cells reasoning about "today" consistently.
export function todayISOMadrid(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}
