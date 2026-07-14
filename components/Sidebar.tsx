"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";
import {
  GlobeIcon,
  BarIcon,
  CompareIcon,
  PatternsIcon,
  InsightIcon,
  MapIcon,
} from "./icons";
import { formatDate } from "@/lib/format";

const NAV = [
  { href: "/", label: "Mission Control", icon: GlobeIcon, exact: true },
  { href: "/campaign", label: "Campaigns", icon: BarIcon },
  { href: "/insights", label: "Insights", icon: InsightIcon },
  { href: "/compare", label: "Compare", icon: CompareIcon },
  { href: "/demand", label: "Demand Map", icon: MapIcon },
  { href: "/patterns", label: "Patterns", icon: PatternsIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data, updating, triggerUpdate } = useDashboard();
  const firstCampaignId = data?.campaigns?.[0]?.campaign_id;

  return (
    <aside className="sticky top-0 z-30 flex h-screen w-16 shrink-0 flex-col border-r border-[var(--border)] bg-[rgba(13,13,15,0.85)] backdrop-blur lg:w-60">
      {/* brand */}
      <div className="flex items-center gap-3 px-4 py-5 lg:px-5">
        <span className="accent-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white">
          S
        </span>
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm font-semibold text-white">Sandberg Estates</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Funnel Intelligence</p>
        </div>
      </div>

      {/* nav */}
      <nav className="mt-2 flex flex-1 flex-col gap-1 px-2 lg:px-3">
        {NAV.map((item) => {
          const href = item.href === "/campaign" ? (firstCampaignId ? `/campaign/${firstCampaignId}` : "/") : item.href;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={href}
              title={item.label}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-[var(--panel2)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--panel)] hover:text-white"
              }`}
            >
              {active && <span className="accent-gradient absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full" />}
              <span className={active ? "text-[#9a7cff]" : "text-[var(--text-faint)] group-hover:text-[var(--text-muted)]"}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* system status + update */}
      <div className="border-t border-[var(--border)] p-3 lg:p-4">
        <div className="mb-3 hidden items-center gap-2 lg:flex">
          <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-[var(--text-muted)]">Pipeline operational</span>
        </div>
        <button
          onClick={triggerUpdate}
          disabled={updating}
          className="accent-gradient flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {updating ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              <span className="hidden lg:inline">Syncing…</span>
            </>
          ) : (
            <>
              <SyncIcon />
              <span className="hidden lg:inline">Update Data</span>
            </>
          )}
        </button>
        <p className="mt-2 hidden text-center text-[10px] text-[var(--text-faint)] lg:block">
          {data?.last_updated ? `Synced ${formatDate(data.last_updated)}` : "Never synced"} · ⌘K
        </p>
      </div>
    </aside>
  );
}

function SyncIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
    </svg>
  );
}
