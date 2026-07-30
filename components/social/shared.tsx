"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlowPanel } from "@/components/ui/glow-panel";
import { useSocialRange, RangePreset } from "@/lib/social/context";

const TABS: { href: string; label: string }[] = [
  { href: "/social", label: "Overview" },
  { href: "/social/community", label: "Community" },
  { href: "/social/account", label: "Account" },
  { href: "/social/posts", label: "Posts" },
  { href: "/social/reels", label: "Reels" },
  { href: "/social/stories", label: "Stories" },
  { href: "/social/demographics", label: "Demographics" },
  { href: "/social/competitors", label: "Competitors" },
];

export function SocialTabs() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = tab.href === "/social" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-[var(--text)] text-[var(--bg)]"
                : "bg-[var(--panel2)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
];

export function RangePicker() {
  const { preset, setPreset, compare, setCompare } = useSocialRange();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-full bg-[var(--panel2)] p-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              preset === p.key ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
        Compare vs previous period
      </label>
    </div>
  );
}

export function Tile({
  label,
  value,
  deltaPct,
  higherIsBetter = true,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  higherIsBetter?: boolean;
}) {
  const isBetter = deltaPct === null || deltaPct === undefined ? null : higherIsBetter ? deltaPct > 0 : deltaPct < 0;
  return (
    <div className="rounded-xl bg-[var(--panel2)] p-4">
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-[var(--text)]">{value}</p>
      {deltaPct !== null && deltaPct !== undefined && (
        <p className={`mt-1 text-xs font-semibold ${isBetter ? "text-emerald-400" : "text-red-400"}`}>
          {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}% vs prev period
        </p>
      )}
    </div>
  );
}

export function NotConnectedPanel({ title, message, envVars }: { title: string; message: string; envVars: string[] }) {
  return (
    <GlowPanel wrapperClassName="mt-5" className="panel p-6">
      <p className="text-sm font-medium text-[var(--text)]">{title}</p>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{message}</p>
      <p className="mt-4 text-xs text-[var(--text-faint)]">
        Set{" "}
        {envVars.map((v, i) => (
          <span key={v}>
            <code>{v}</code>
            {i < envVars.length - 1 ? ", " : ""}
          </span>
        ))}{" "}
        in <code>.env.local</code> (and in Vercel for production).
      </p>
    </GlowPanel>
  );
}

export function SocialPageHeader({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--text)]">{title}</h1>
        <RangePicker />
      </div>
      <SocialTabs />
    </div>
  );
}
