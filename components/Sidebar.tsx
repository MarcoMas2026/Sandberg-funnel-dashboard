"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { GearSix, CaretDown, House, ArrowsClockwise } from "@phosphor-icons/react";
import { useDashboard } from "@/lib/dashboard-context";
import { Sidebar as SidebarShell, DesktopSidebar } from "./ui/sidebar";
import { NAV_ITEMS, NAV_GROUPS } from "@/lib/nav";
import { formatDate } from "@/lib/format";
import SettingsPanel from "./SettingsPanel";

// Sidebar is always expanded (see CLAUDE.md / user request) — no
// hover-to-open collapse. `open` is fixed true and `animate` is off so the
// shared aceternity-style shell never tries to shrink to the 60px rail.
export default function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { data } = useDashboard();
  const activeCampaigns = (data?.campaigns ?? []).filter((c) => c.status === "ACTIVE" && c.campaign_type === "property");

  const isActive = (item: { href: string; exact?: boolean }) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));
  const itemByHref = (href: string) => NAV_ITEMS.find((i) => i.href === href)!;

  return (
    <div className={`hidden shrink-0 md:sticky md:top-0 md:block md:h-screen${className ? ` ${className}` : ""}`}>
      <SidebarShell open={true} setOpen={() => {}} animate={false}>
        <DesktopSidebar className="vantage-shell justify-between gap-10 rounded-none md:h-full">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto pl-2">
            <BrandLogo />
            <div className="mt-8 flex flex-col gap-1">
              <NavRow href="/" label={itemByHref("/").label} Icon={itemByHref("/").icon} active={pathname === "/"} />

              <SidebarDivider />

              <SectionLabel label="Campaigns" />
              {activeCampaigns.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-[var(--vantage-text-muted)]">No active campaigns</p>
              ) : (
                activeCampaigns.map((c) => {
                  const href = `/campaign/${c.campaign_id}`;
                  return (
                    <NavRow key={c.campaign_id} href={href} label={c.property} Icon={House} active={pathname === href} />
                  );
                })
              )}

              <SidebarDivider />

              {NAV_GROUPS.filter((e) => e.kind === "group").map((entry, i, arr) => {
                if (entry.kind !== "group") return null;
                return (
                  <div key={entry.label} className="contents">
                    <SectionLabel label={entry.label} />
                    {entry.hrefs.map((href) => {
                      const item = itemByHref(href);
                      return <NavRow key={href} href={href} label={item.label} Icon={item.icon} active={isActive(item)} />;
                    })}
                    {i < arr.length - 1 && <SidebarDivider />}
                  </div>
                );
              })}

              <SidebarDivider />

              {["insights", "social"].map((href, i) => {
                const item = itemByHref(`/${href}`);
                return (
                  <div key={item.href} className="contents">
                    <NavRow href={item.href} label={item.label} Icon={item.icon} active={isActive(item)} />
                    {i === 0 && <SidebarDivider />}
                  </div>
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

function SidebarDivider() {
  return <div className="my-2 h-px bg-[rgba(33,52,54,0.1)]" />;
}

function SectionLabel({ label }: { label: string }) {
  return <p className="mt-3 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--vantage-text-muted)]">{label}</p>;
}

function NavRow({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon?: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`mr-3 flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-[13px] text-[var(--vantage-text)] ${
        active ? "vantage-nav-active font-semibold" : ""
      }`}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : <span className="w-4 shrink-0" />}
      <span className="whitespace-pre">{label}</span>
    </Link>
  );
}

function BrandLogo() {
  return (
    <div className="flex flex-col gap-3 py-1">
      <Link href="/" className="block w-7">
        <Image src="/brand/vantage-logo.svg" alt="Vantage" width={28} height={28} priority />
      </Link>
      <button
        type="button"
        className="flex items-center gap-1.5 self-start text-[13px] font-medium text-[var(--vantage-text)]"
      >
        Sandberg Estates
        <CaretDown className="h-3 w-3" />
      </button>
    </div>
  );
}

function SidebarFooter() {
  const { data, updating, error, triggerUpdate } = useDashboard();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setSettingsOpen(true)}
        aria-label="Settings"
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] text-[var(--vantage-text)]"
      >
        <GearSix className="h-4 w-4 shrink-0" />
        <span className="whitespace-pre">Settings</span>
      </button>
      <button
        onClick={triggerUpdate}
        disabled={updating}
        aria-label="Update data"
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] text-[var(--vantage-text)] disabled:opacity-60"
      >
        {updating ? (
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--vantage-icon-box)] border-t-[var(--vantage-text)]" />
        ) : (
          <ArrowsClockwise className="h-4 w-4 shrink-0" />
        )}
        <span className="whitespace-pre">{updating ? "Syncing…" : "Update Data"}</span>
      </button>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <span className={`h-2 w-2 shrink-0 rounded-full ${error ? "bg-amber-500" : "pulse-dot bg-emerald-500"}`} />
        </span>
        <span className={`whitespace-pre text-[13px] ${error ? "text-amber-600" : "text-[var(--vantage-text)]"}`}>
          {error ? error : data?.last_updated ? `Synced ${formatDate(data.last_updated)}` : "Pipeline operational"}
        </span>
      </div>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
