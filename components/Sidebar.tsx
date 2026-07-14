"use client";

import { useState } from "react";
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
import { MOCK_INSIGHTS } from "@/lib/mock";

const GROUPS = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Mission Control", icon: GlobeIcon, exact: true }],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/campaign", label: "Campaigns", icon: BarIcon },
      { href: "/insights", label: "Insights", icon: InsightIcon, badge: true },
      { href: "/compare", label: "Compare", icon: CompareIcon },
    ],
  },
  {
    label: "Strategy",
    items: [
      { href: "/demand", label: "Demand Map", icon: MapIcon },
      { href: "/patterns", label: "Patterns", icon: PatternsIcon },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data, updating, triggerUpdate } = useDashboard();
  const firstCampaignId = data?.campaigns?.[0]?.campaign_id;
  const [collapsed, setCollapsed] = useState(false);
  const criticalCount = MOCK_INSIGHTS.filter((i) => i.severity === "critical" || i.severity === "warning").length;

  return (
    <aside
      className={`sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[rgba(16,16,20,0.9)] backdrop-blur transition-[width] duration-200 ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      {/* brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <span className="accent-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white">
          S
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">Sandberg Estates</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Funnel Intelligence</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="icon-btn shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(180deg)" : undefined }}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* nav */}
      <nav className="mt-2 flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-3">
        {GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                {group.label}
              </p>
            )}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const href = item.href === "/campaign" ? (firstCampaignId ? `/campaign/${firstCampaignId}` : "/") : item.href;
                const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                const showBadge = "badge" in item && item.badge && criticalCount > 0;
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
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {!collapsed && showBadge && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {criticalCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* system status + update */}
      <div className="border-t border-[var(--border)] p-3">
        {!collapsed && (
          <div className="mb-3 flex items-center gap-2">
            <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-[var(--text-muted)]">Pipeline operational</span>
          </div>
        )}
        <button
          onClick={triggerUpdate}
          disabled={updating}
          className="accent-gradient flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {updating ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {!collapsed && "Syncing…"}
            </>
          ) : (
            <>
              <SyncIcon />
              {!collapsed && "Update Data"}
            </>
          )}
        </button>
        {!collapsed && (
          <p className="mt-2 text-center text-[10px] text-[var(--text-faint)]">
            {data?.last_updated ? `Synced ${formatDate(data.last_updated)}` : "Never synced"}
          </p>
        )}
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
