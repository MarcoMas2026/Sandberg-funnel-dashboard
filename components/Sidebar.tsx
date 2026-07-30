"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { Logo } from "./Logo";
import { Sidebar as SidebarShell, DesktopSidebar, SidebarLink, useSidebar } from "./ui/sidebar";
import { NAV_ITEMS } from "@/lib/nav";
import { formatDate } from "@/lib/format";
import { motion } from "framer-motion";
import SettingsPanel from "./SettingsPanel";

// Mirrors the aceternity sidebar demo's shape/colors exactly: bg-neutral-100
// (dark:neutral-800) body, rounded-md, neutral-200 border, gap-10, plain
// neutral-700/200 link text — same box the shared component ships with.
// Desktop (md+) only — mobile uses MobileTopNav instead (see app/layout.tsx).
export default function Sidebar() {
  const pathname = usePathname();
  const { data } = useDashboard();
  const firstCampaignId = data?.campaigns?.[0]?.campaign_id;

  return (
    <div className="hidden shrink-0 md:sticky md:top-3 md:block md:h-[calc(100vh-1.5rem)]">
      <SidebarShell>
        <DesktopSidebar className="justify-between gap-10 rounded-md border border-neutral-200 dark:border-neutral-700 md:h-full">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <BrandLogo />
            <div className="mt-8 flex flex-col gap-2">
              {NAV_ITEMS.map((item) => {
                const href = item.href === "/campaign" ? (firstCampaignId ? `/campaign/${firstCampaignId}` : "/") : item.href;
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <SidebarLink
                    key={item.href}
                    link={{
                      label: item.label,
                      href,
                      icon: <Icon className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
                    }}
                    className={active ? "font-semibold" : undefined}
                  />
                );
              })}
            </div>
          </div>

          <SidebarFooter />
        </DesktopSidebar>
      </SidebarShell>
    </div>
  );
}

function BrandLogo() {
  const { open } = useSidebar();
  return (
    <Link href="/" className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal">
      <span className="flex h-5 w-6 shrink-0 items-center justify-center rounded-br-lg rounded-tl-lg rounded-tr-sm rounded-bl-sm bg-black dark:bg-white">
        <Logo className="h-3 w-3 text-white dark:text-black" />
      </span>
      {open && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="whitespace-pre font-medium text-black dark:text-white"
        >
          Sandberg Estates
        </motion.span>
      )}
    </Link>
  );
}

function SidebarFooter() {
  const { open } = useSidebar();
  const { data, updating, triggerUpdate } = useDashboard();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setSettingsOpen(true)}
        aria-label="Settings"
        className="group/sidebar flex items-center gap-2 py-2"
      >
        <Settings className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
        <motion.span
          animate={{ display: open ? "inline-block" : "none", opacity: open ? 1 : 0 }}
          className="whitespace-pre text-sm text-neutral-700 transition duration-150 group-hover/sidebar:translate-x-1 dark:text-neutral-200"
        >
          Settings
        </motion.span>
      </button>
      <button
        onClick={triggerUpdate}
        disabled={updating}
        aria-label="Update data"
        className="group/sidebar flex items-center gap-2 py-2 disabled:opacity-60"
      >
        {updating ? (
          <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700 dark:border-neutral-600 dark:border-t-neutral-200" />
        ) : (
          <SyncIcon className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
        )}
        <motion.span
          animate={{ display: open ? "inline-block" : "none", opacity: open ? 1 : 0 }}
          className="whitespace-pre text-sm text-neutral-700 transition duration-150 group-hover/sidebar:translate-x-1 dark:text-neutral-200"
        >
          {updating ? "Syncing…" : "Update Data"}
        </motion.span>
      </button>
      <div className="flex items-center gap-2 py-2">
        <span className="pulse-dot h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
        <motion.span
          animate={{ display: open ? "inline-block" : "none", opacity: open ? 1 : 0 }}
          className="whitespace-pre text-sm text-neutral-700 dark:text-neutral-200"
        >
          {data?.last_updated ? `Synced ${formatDate(data.last_updated)}` : "Pipeline operational"}
        </motion.span>
      </div>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function SyncIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
    </svg>
  );
}
