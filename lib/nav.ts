import type { ComponentType } from "react";
import { LayoutDashboard } from "lucide-react";
import {
  BarIcon,
  CurveIcon,
  PatternsIcon,
  InsightIcon,
  MapIcon,
  TargetIcon,
  LeadIcon,
  SocialIcon,
} from "@/components/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

// Single source of truth for section nav — shared by the desktop Sidebar and
// the mobile top nav so both stay aligned with the same set of sections.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Mission Control", icon: LayoutDashboard, exact: true },
  { href: "/campaign", label: "Campaigns", icon: BarIcon },
  { href: "/leads", label: "Leads", icon: LeadIcon },
  { href: "/curve", label: "Curve", icon: CurveIcon },
  { href: "/insights", label: "Insights", icon: InsightIcon },
  { href: "/demand", label: "Demand Map", icon: MapIcon },
  { href: "/patterns", label: "Patterns", icon: PatternsIcon },
  { href: "/social", label: "Social", icon: SocialIcon },
  { href: "/okrs", label: "OKRs", icon: TargetIcon },
];
