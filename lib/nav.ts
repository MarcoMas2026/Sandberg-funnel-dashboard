import type { ComponentType } from "react";
import { FileText, Handshake, LayoutDashboard, LineChart, Users } from "lucide-react";
import {
  BarIcon,
  CurveIcon,
  PatternsIcon,
  InsightIcon,
  TargetIcon,
  LeadIcon,
  SocialIcon,
  WhatsAppIcon,
} from "@/components/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  // Not ready to show yet, but the route/page stays fully intact — just
  // filtered out of the visible nav lists below.
  hidden?: boolean;
};

// Single source of truth for section nav — shared by the desktop Sidebar and
// the mobile top nav so both stay aligned with the same set of sections.
// Routes/pages are unchanged; NAV_GROUPS below only changes how the desktop
// Sidebar visually clusters these same items (mobile nav still uses the flat
// list, so this array must stay exactly as every existing consumer expects).
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Mission Control", icon: LayoutDashboard, exact: true },
  { href: "/campaign", label: "Campaigns", icon: BarIcon },
  { href: "/leads", label: "Leads", icon: LeadIcon },
  { href: "/whatsapp", label: "WhatsApp", icon: WhatsAppIcon },
  { href: "/outcomes", label: "Outcomes", icon: Handshake },
  { href: "/curve", label: "Curve", icon: CurveIcon },
  { href: "/insights", label: "Insights", icon: InsightIcon },
  { href: "/report", label: "Meta Ads Report", icon: FileText },
  { href: "/patterns", label: "Patterns", icon: PatternsIcon },
  { href: "/social", label: "Social", icon: SocialIcon },
  // Parked — building this out later (see CLAUDE.md OKR section). Route and
  // page stay in the codebase; only the nav entry is hidden.
  { href: "/okrs", label: "OKRs", icon: TargetIcon, hidden: true },
];

// Nav items actually shown in the UI — same list, minus anything parked via
// `hidden`. Both the desktop Sidebar and MobileTopNav should read from this,
// not NAV_ITEMS directly, so a hidden section disappears everywhere at once.
export const VISIBLE_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => !item.hidden);

// Desktop-sidebar-only grouping: clusters related NAV_ITEMS under a
// collapsible header so fewer rows show at once. Purely presentational —
// every href above still resolves to its existing page, nothing moved.
export type NavGroup =
  | { kind: "item"; href: string }
  | { kind: "group"; label: string; icon: ComponentType<{ className?: string }>; hrefs: string[] };

const ALL_NAV_GROUPS: NavGroup[] = [
  { kind: "item", href: "/" },
  { kind: "item", href: "/campaign" },
  { kind: "group", label: "Analytics", icon: LineChart, hrefs: ["/curve", "/patterns", "/report"] },
  { kind: "group", label: "CRM", icon: Users, hrefs: ["/leads", "/outcomes", "/whatsapp"] },
  { kind: "item", href: "/insights" },
  { kind: "item", href: "/social" },
  { kind: "item", href: "/okrs" },
];

export const NAV_GROUPS: NavGroup[] = ALL_NAV_GROUPS.filter((entry) =>
  entry.kind === "item" ? !NAV_ITEMS.find((i) => i.href === entry.href)?.hidden : true
);
