import type { ComponentType } from "react";
import {
  SquaresFour,
  House,
  UserPlus,
  WhatsappLogo,
  Handshake,
  ChartLineUp,
  Lightbulb,
  FileText,
  ShareNetwork,
  InstagramLogo,
  Target,
  ChartLine,
  Users,
  Scales,
} from "@phosphor-icons/react";

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
  { href: "/", label: "Mission Control", icon: SquaresFour, exact: true },
  { href: "/campaign", label: "Campaigns", icon: House },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/whatsapp", label: "WhatsApp", icon: WhatsappLogo },
  { href: "/outcomes", label: "Outcomes", icon: Handshake },
  { href: "/curve", label: "Curve", icon: ChartLineUp },
  { href: "/two-sides", label: "Two Sides", icon: Scales },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/report", label: "Meta Ads Report", icon: FileText },
  { href: "/patterns", label: "Patterns", icon: ShareNetwork },
  { href: "/social", label: "Social", icon: InstagramLogo },
  // Parked — building this out later (see CLAUDE.md OKR section). Route and
  // page stay in the codebase; only the nav entry is hidden.
  { href: "/okrs", label: "OKRs", icon: Target, hidden: true },
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
  { kind: "group", label: "Analytics", icon: ChartLine, hrefs: ["/curve", "/two-sides", "/patterns", "/report"] },
  { kind: "group", label: "CRM", icon: Users, hrefs: ["/leads", "/outcomes", "/whatsapp"] },
  { kind: "item", href: "/insights" },
  { kind: "item", href: "/social" },
  { kind: "item", href: "/okrs" },
];

export const NAV_GROUPS: NavGroup[] = ALL_NAV_GROUPS.filter((entry) =>
  entry.kind === "item" ? !NAV_ITEMS.find((i) => i.href === entry.href)?.hidden : true
);
