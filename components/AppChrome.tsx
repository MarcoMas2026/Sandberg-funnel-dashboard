"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MobileTopNav from "@/components/MobileTopNav";
import CommandPalette from "@/components/CommandPalette";
import GestureNav from "@/components/GestureNav";
import PublicViewDock from "@/components/PublicViewDock";
import { DashboardProvider } from "@/lib/dashboard-context";
import { PublicViewProvider } from "@/lib/public-view-context";

// /view/[slug] is the public, client-facing Public View landing page. It must
// render full-bleed with no admin sidebar/topbar/command palette, AND it must
// never mount DashboardProvider — that provider eagerly fetches the FULL live
// portfolio via /api/funnel on mount, which would hand a client's browser the
// entire company's campaign data regardless of what's actually shown on
// screen. /view/[slug] fetches only its own scoped data server-side instead.
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicView = pathname?.startsWith("/view/") ?? false;
  // Mission Control's canvas is meant to fill the space next to the
  // sidebar edge-to-edge (see CLAUDE.md's Vantage redesign) — every other
  // page keeps the centered, width-capped reading layout.
  const isMissionControl = pathname === "/";

  if (isPublicView) {
    return <>{children}</>;
  }

  return (
    <DashboardProvider>
      <PublicViewProvider>
        <MobileTopNav />
        <div className="shell-grid flex min-h-screen gap-3 pb-3 pr-3">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <main className="py-1 pt-20 md:pt-3">
              {isMissionControl ? (
                children
              ) : (
                <div className="vantage-canvas min-h-[calc(100vh-1.5rem)] p-4 sm:p-6">
                  <div className="mx-auto max-w-[1440px]">{children}</div>
                </div>
              )}
            </main>
          </div>
        </div>
        <CommandPalette />
        <GestureNav />
        <PublicViewDock />
      </PublicViewProvider>
    </DashboardProvider>
  );
}
