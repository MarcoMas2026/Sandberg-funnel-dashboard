"use client";

import Link from "next/link";
import { useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { Settings, ChevronDown } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { Logo } from "./Logo";
import { Sidebar as SidebarShell, DesktopSidebar, SidebarLink, useSidebar } from "./ui/sidebar";
import { NAV_ITEMS, NAV_GROUPS } from "@/lib/nav";
import { formatDate } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import SettingsPanel from "./SettingsPanel";

// Mirrors the aceternity sidebar demo's shape/colors exactly: bg-neutral-100
// (dark:neutral-800) body, rounded-md, neutral-200 border, gap-10, plain
// neutral-700/200 link text — same box the shared component ships with.
// Desktop (md+) only — mobile uses MobileTopNav instead (see app/layout.tsx).
export default function Sidebar() {
  const pathname = usePathname();
  const { data } = useDashboard();
  const firstCampaignId = data?.campaigns?.[0]?.campaign_id;

  const resolveHref = (href: string) => (href === "/campaign" ? (firstCampaignId ? `/campaign/${firstCampaignId}` : "/") : href);
  const isActive = (item: { href: string; exact?: boolean }) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));
  const itemByHref = (href: string) => NAV_ITEMS.find((i) => i.href === href)!;

  return (
    <div className="hidden shrink-0 md:sticky md:top-3 md:block md:h-[calc(100vh-1.5rem)]">
      <SidebarShell>
        <DesktopSidebar className="justify-between gap-10 rounded-md border border-neutral-200 dark:border-neutral-700 md:h-full">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <BrandLogo />
            <div className="mt-8 flex flex-col gap-2">
              {NAV_GROUPS.map((entry) => {
                if (entry.kind === "item") {
                  const item = itemByHref(entry.href);
                  const href = resolveHref(item.href);
                  const active = isActive(item);
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
                }

                const children = entry.hrefs.map((href) => itemByHref(href));
                const groupActive = children.some((c) => isActive(c));
                return (
                  <NavGroupRow
                    key={entry.label}
                    label={entry.label}
                    Icon={entry.icon}
                    active={groupActive}
                    defaultOpen={groupActive}
                  >
                    {children.map((item) => {
                      const href = resolveHref(item.href);
                      const active = isActive(item);
                      const Icon = item.icon;
                      return (
                        <SidebarLink
                          key={item.href}
                          link={{
                            label: item.label,
                            href,
                            icon: <Icon className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />,
                          }}
                          className={active ? "font-semibold" : undefined}
                        />
                      );
                    })}
                  </NavGroupRow>
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

function NavGroupRow({
  label,
  Icon,
  active,
  defaultOpen,
  children,
}: {
  label: string;
  Icon: ComponentType<{ className?: string }>;
  active: boolean;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const { open: sidebarOpen } = useSidebar();
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`group/sidebar flex w-full items-center gap-2 py-2 text-sm ${active ? "font-semibold" : ""} text-neutral-700 dark:text-neutral-200`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <motion.span
          animate={{ display: sidebarOpen ? "inline-block" : "none", opacity: sidebarOpen ? 1 : 0 }}
          className="flex-1 whitespace-pre text-left transition duration-150 group-hover/sidebar:translate-x-1"
        >
          {label}
        </motion.span>
        {sidebarOpen && (
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && sidebarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="ml-4 flex flex-col gap-1 overflow-hidden border-l border-neutral-200 pl-3 dark:border-neutral-700"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
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
  const { data, updating, error, triggerUpdate } = useDashboard();
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
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${error ? "bg-amber-400" : "pulse-dot bg-emerald-400"}`}
          />
        </span>
        <motion.span
          animate={{ display: open ? "inline-block" : "none", opacity: open ? 1 : 0 }}
          className={`whitespace-pre text-sm ${error ? "text-amber-600 dark:text-amber-400" : "text-neutral-700 dark:text-neutral-200"}`}
        >
          {error
            ? error
            : data?.last_updated
              ? `Synced ${formatDate(data.last_updated)}`
              : "Pipeline operational"}
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
