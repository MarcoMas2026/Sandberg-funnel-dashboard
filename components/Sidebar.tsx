"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";
import { Logo } from "./Logo";
import {
  GlobeIcon,
  BarIcon,
  CompareIcon,
  PatternsIcon,
  InsightIcon,
  MapIcon,
  TargetIcon,
  LeadIcon,
} from "./icons";
import { formatDate } from "@/lib/format";
import { MOCK_INSIGHTS } from "@/lib/mock";

const ITEMS = [
  { href: "/", label: "Mission Control", icon: GlobeIcon, exact: true },
  { href: "/campaign", label: "Campaigns", icon: BarIcon },
  { href: "/leads", label: "Leads", icon: LeadIcon },
  { href: "/insights", label: "Insights", icon: InsightIcon, badge: true },
  { href: "/compare", label: "Compare", icon: CompareIcon },
  { href: "/demand", label: "Demand Map", icon: MapIcon },
  { href: "/patterns", label: "Patterns", icon: PatternsIcon },
  { href: "/okrs", label: "OKRs", icon: TargetIcon },
];

// Icon-only rail; label appears as a floating tooltip on hover. The active
// item's icon sits in a white chip that bleeds past the rail's right edge
// (negative margin + higher z-index) into the gap before the page content,
// reading as the section "opening up" out of the rail.
function RailTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-[#0c0c10] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
      {label}
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data, updating, triggerUpdate } = useDashboard();
  const firstCampaignId = data?.campaigns?.[0]?.campaign_id;
  const criticalCount = MOCK_INSIGHTS.filter((i) => i.severity === "critical" || i.severity === "warning").length;

  return (
    <aside
      className="sticky top-3 z-30 flex h-[calc(100vh-1.5rem)] w-[76px] shrink-0 flex-col items-center rounded-[36px] bg-[#0c0c10] py-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* brand */}
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--accent)]">
        <Logo className="h-6 w-6" />
      </span>

      {/* nav */}
      <nav className="mt-8 flex flex-1 flex-col items-center gap-3">
        {ITEMS.map((item) => {
          const href = item.href === "/campaign" ? (firstCampaignId ? `/campaign/${firstCampaignId}` : "/") : item.href;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          const showBadge = item.badge && criticalCount > 0;
          return (
            <Link
              key={item.href}
              href={href}
              aria-label={item.label}
              className="group relative flex h-11 w-11 shrink-0 items-center justify-center"
            >
              {active && (
                <>
                  {/* notches: blend the bar's straight edge into the active
                      chip's rounded corner, so the chip reads as cut into
                      the bar rather than floating on top of it */}
                  <span
                    className="pointer-events-none absolute -right-5 -top-[13px] h-[13px] w-[13px]"
                    style={{ background: "radial-gradient(circle at bottom right, transparent 13px, #0c0c10 13px)" }}
                  />
                  <span
                    className="pointer-events-none absolute -right-5 -bottom-[13px] h-[13px] w-[13px]"
                    style={{ background: "radial-gradient(circle at top right, transparent 13px, #0c0c10 13px)" }}
                  />
                </>
              )}
              <span
                className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 ${
                  active ? "-mr-5 bg-[var(--bg)] text-[var(--accent)]" : "text-white/50 group-hover:bg-white/10 group-hover:text-white/85"
                }`}
              >
                <Icon className="h-[19px] w-[19px]" />
                {showBadge && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#0c0c10]" />
                )}
              </span>
              <RailTooltip label={item.label} />
            </Link>
          );
        })}
      </nav>

      {/* pipeline status + update */}
      <div className="flex flex-col items-center gap-3">
        <span className="group relative flex h-11 w-11 items-center justify-center">
          <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <RailTooltip label={data?.last_updated ? `Pipeline operational · synced ${formatDate(data.last_updated)}` : "Pipeline operational"} />
        </span>
        <button
          onClick={triggerUpdate}
          disabled={updating}
          aria-label="Update data"
          className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-60"
        >
          {updating ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <SyncIcon />
          )}
          <RailTooltip label={updating ? "Syncing…" : "Update Data"} />
        </button>
      </div>
    </aside>
  );
}

function SyncIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
    </svg>
  );
}
