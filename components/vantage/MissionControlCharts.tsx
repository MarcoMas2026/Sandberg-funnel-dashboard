"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarBlank, ChartDonut } from "@phosphor-icons/react";

// Per-campaign chart palette, shared between the bar chart and the donut so
// the same campaign always reads as the same color. Plain, standard
// categorical colors — distinct enough to tell stacked segments apart at a
// glance, rather than the brand's near-identical teal shades. "Other" always
// uses the neutral gray below, kept out of this list so it never collides.
const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
const TREND_COLOR = "#22d3ee";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function ChartPanelHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-2.5">
      <div className="flex items-center gap-2.5">
        <span className="vantage-icon-box h-11 w-11">{icon}</span>
        <h3 className="text-lg font-semibold text-[var(--vantage-text)]">{title}</h3>
      </div>
      {right}
    </div>
  );
}


interface DailyPoint {
  date: string;
  label: string;
  leads: number;
}

// Total portfolio leads per day, day 1 through the last day of the current
// calendar month (28–31 days depending on the month), across every campaign
// — active AND inactive (see /api/history/daily-leads). One smooth line
// instead of a stacked-by-campaign bar: easier to read the trend at a
// glance, and doesn't need a color per campaign. Days with no rows yet
// (including the rest of the month still ahead of today) are zero-filled so
// every day of the month gets a point on the x-axis.
export function DailyLeadsTrendChart() {
  const [rows, setRows] = useState<DailyPoint[] | null>(null);

  useEffect(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    fetch(`/api/history/daily-leads?start=${ymd(monthStart)}&end=${ymd(monthEnd)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const points: { date: string; leads: number }[] = json.rows ?? [];
        const leadsByDate = new Map(points.map((p) => [p.date, p.leads]));
        const days = monthEnd.getDate();
        const filled: DailyPoint[] = Array.from({ length: days }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
          const date = ymd(d);
          return { date, label: String(i + 1), leads: leadsByDate.get(date) ?? 0 };
        });
        setRows(filled);
      })
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="vantage-card flex h-full flex-col p-6">
      <ChartPanelHeader icon={<CalendarBlank className="h-5 w-5" />} title="Daily leads trend" />
      {rows === null ? (
        <div className="h-80 animate-pulse rounded-xl bg-[var(--vantage-icon-box)]/40" />
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--vantage-text-muted)]">No historical data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="dailyLeadsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TREND_COLOR} stopOpacity={0.28} />
                <stop offset="100%" stopColor={TREND_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#848484" strokeOpacity={0.25} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#848484", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval={Math.max(0, Math.ceil(rows.length / 8) - 1)}
            />
            <YAxis tick={{ fill: "#848484", fontSize: 13 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#f5f4f7", border: "none", borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: "#213436", fontWeight: 600 }}
              formatter={(value: number) => [value, "Leads"]}
              labelFormatter={(label: string) => `Day ${label}`}
            />
            <Area type="monotone" dataKey="leads" stroke={TREND_COLOR} strokeWidth={2.5} fill="url(#dailyLeadsFill)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

type LeadRange = "7" | "15" | "30";

const RANGE_OPTIONS: { key: LeadRange; label: string }[] = [
  { key: "7", label: "7d" },
  { key: "15", label: "15d" },
  { key: "30", label: "30d" },
];

// Start date for each toggle option, end is always today:
// - 30d: the 1st of this month (month-to-date)
// - 15d: the 15th of this month
// - 7d: Monday of the current week
function rangeStart(range: LeadRange, today: Date): Date {
  if (range === "30") return new Date(today.getFullYear(), today.getMonth(), 1);
  if (range === "15") return new Date(today.getFullYear(), today.getMonth(), 15);
  const dow = today.getDay(); // 0=Sun..6=Sat
  const sinceMonday = (dow + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - sinceMonday);
  return monday;
}

interface CampaignLeadRow {
  campaign_id: string;
  property: string;
  leads: number;
}

// Live per-campaign lead totals for the selected window (7/15/30 days),
// across every campaign that had leads in that window — active AND
// inactive, not just the currently-live set (see /api/history/leads-by-campaign).
export function LeadCountByCampaignDonut() {
  const [range, setRange] = useState<LeadRange>("30");
  const [rows, setRows] = useState<CampaignLeadRow[] | null>(null);

  useEffect(() => {
    const today = new Date();
    const start = ymd(rangeStart(range, today));
    const end = ymd(today);
    setRows(null);
    fetch(`/api/history/leads-by-campaign?start=${start}&end=${end}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setRows(json.rows ?? []))
      .catch(() => setRows([]));
  }, [range]);

  const { data, total } = useMemo(() => {
    const sorted = [...(rows ?? [])].filter((r) => r.leads > 0).sort((a, b) => b.leads - a.leads);
    const data = sorted.map((r, i) => ({ name: r.property, value: r.leads, color: PALETTE[i % PALETTE.length] }));
    return { data, total: sorted.reduce((s, r) => s + r.leads, 0) };
  }, [rows]);

  const toggle = (
    <div className="vantage-icon-box flex items-center gap-0.5 p-1">
      {RANGE_OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => setRange(o.key)}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            range === o.key ? "bg-[var(--vantage-accent)] text-[#f0f0f0]" : "text-[var(--vantage-text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="vantage-card flex h-full flex-col p-6">
      <ChartPanelHeader icon={<ChartDonut className="h-5 w-5" />} title="Lead count by campaign" right={toggle} />
      {rows === null ? (
        <div className="h-64 animate-pulse rounded-xl bg-[var(--vantage-icon-box)]/40" />
      ) : total === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--vantage-text-muted)]">No leads in this window</p>
      ) : (
        <div className="flex flex-1 items-center gap-8">
          <div className="flex max-h-[280px] flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-sm text-[var(--vantage-text)]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="truncate">{d.name}</span>
              </div>
            ))}
          </div>
          <div className="relative shrink-0">
            <ResponsiveContainer width={260} height={260}>
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={78} outerRadius={122} startAngle={90} endAngle={-270} stroke="none">
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold text-[var(--vantage-text)]">{total}</p>
              <p className="text-xs text-[var(--vantage-text-muted)]">Total</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
