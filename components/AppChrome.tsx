"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MobileTopNav from "@/components/MobileTopNav";
import Topbar from "@/components/Topbar";
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

  if (isPublicView) {
    return <>{children}</>;
  }

  return (
    <DashboardProvider>
      <PublicViewProvider>
        <MobileTopNav />
        <div className="shell-grid flex min-h-screen gap-3 p-3">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <main className="mx-auto max-w-[1440px] px-2 py-1 pt-20 md:pt-1 lg:px-5">
              <Topbar />
              {children}
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
