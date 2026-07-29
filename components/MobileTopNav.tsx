"use client";

import { usePathname } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";
import { NAV_ITEMS } from "@/lib/nav";
import { AnimatedMobileNav } from "./ui/animated-mobile-nav";

// Mobile-only (md:hidden inside AnimatedMobileNav) horizontal top nav —
// replaces the sidebar's built-in hamburger/fullscreen overlay on small
// screens. Same section list as the desktop Sidebar (lib/nav.ts) so every
// item stays aligned with the app's actual routes.
export default function MobileTopNav() {
  const pathname = usePathname();
  const { data } = useDashboard();
  const firstCampaignId = data?.campaigns?.[0]?.campaign_id;

  const items = NAV_ITEMS.map((item) => {
    const href = item.href === "/campaign" ? (firstCampaignId ? `/campaign/${firstCampaignId}` : "/") : item.href;
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    const Icon = item.icon;
    return {
      href,
      label: item.label,
      active,
      icon: <Icon />,
    };
  });

  return <AnimatedMobileNav items={items} />;
}
