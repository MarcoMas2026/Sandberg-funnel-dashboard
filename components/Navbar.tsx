"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";
import {
  GlobeIcon,
  BarIcon,
  CompareIcon,
  PatternsIcon,
} from "./icons";

export default function Navbar() {
  const pathname = usePathname();
  const { data, updating, triggerUpdate } = useDashboard();

  const onOverview = pathname === "/";
  const onCampaign = pathname.startsWith("/campaign");
  const onCompare = pathname.startsWith("/compare");
  const firstCampaignId = data?.campaigns?.[0]?.campaign_id;

  return (
    <header className="sticky top-0 z-20 flex justify-center px-6 pt-5 pb-3">
      <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel)]/90 p-1.5 backdrop-blur">
        <Tab href="/" active={onOverview} icon={<GlobeIcon />} label="Overview" />
        <Tab
          href={firstCampaignId ? `/campaign/${firstCampaignId}` : "/"}
          active={onCampaign}
          icon={<BarIcon />}
          label="Campaign"
        />
        <Tab href="/compare" active={onCompare} icon={<CompareIcon />} label="Compare" />
        <DisabledTab icon={<PatternsIcon />} label="Patterns" />

        <button
          onClick={triggerUpdate}
          disabled={updating}
          className="accent-gradient ml-1 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {updating ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Updating
            </>
          ) : (
            "Update"
          )}
        </button>
      </div>
    </header>
  );
}

function Tab({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--panel2)] text-white"
          : "text-[var(--text-muted)] hover:text-white"
      }`}
    >
      <span className={active ? "text-white" : "text-[var(--text-muted)]"}>{icon}</span>
      {label}
    </Link>
  );
}

function DisabledTab({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      aria-disabled
      title="Coming soon"
      className="inline-flex cursor-not-allowed items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--text-faint)]/60"
    >
      <span className="opacity-50">{icon}</span>
      {label}
    </span>
  );
}
