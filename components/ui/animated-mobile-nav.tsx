"use client";

// Adapted from a Framer Motion "collapse on scroll" pill nav: same spring
// physics and staggered item reveal, restyled to this app's panel/border/text
// CSS vars, icon-only (no labels/logo), fed a generic `items` list instead of
// hardcoded links. Expanded only while at the very top of the page; any
// scroll away from the top collapses it to a circle that tracks the scroll
// position (fixed), and it re-expands the instant you're back at the top.
// Tapping the collapsed circle re-opens it temporarily so items stay reachable
// mid-scroll.
import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export type AnimatedNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
};

const AT_TOP_THRESHOLD = 8;

const containerVariants = {
  expanded: {
    y: 0,
    opacity: 1,
    width: "auto",
    transition: {
      y: { type: "spring" as const, damping: 18, stiffness: 250 },
      opacity: { duration: 0.3 },
      type: "spring" as const,
      damping: 20,
      stiffness: 300,
      staggerChildren: 0.045,
      delayChildren: 0.1,
    },
  },
  collapsed: {
    y: 0,
    opacity: 1,
    width: "3rem",
    transition: {
      type: "spring" as const,
      damping: 20,
      stiffness: 300,
      when: "afterChildren",
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  expanded: { opacity: 1, x: 0, scale: 1, transition: { type: "spring" as const, damping: 15 } },
  collapsed: { opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.2 } },
};

const collapsedIconVariants = {
  expanded: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
  collapsed: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring" as const, damping: 15, stiffness: 300, delay: 0.15 },
  },
};

export function AnimatedMobileNav({ items }: { items: AnimatedNavItem[] }) {
  const [atTop, setAtTop] = React.useState(true);
  const [tapOpen, setTapOpen] = React.useState(false);
  const isExpanded = atTop || tapOpen;

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const nowAtTop = latest <= AT_TOP_THRESHOLD;
    setAtTop(nowAtTop);
    if (!nowAtTop) setTapOpen(false);
  });

  const handleNavClick = (e: React.MouseEvent) => {
    if (!isExpanded) {
      e.preventDefault();
      setTapOpen(true);
    }
  };

  return (
    <div className="fixed left-1/2 top-3 z-50 -translate-x-1/2 md:hidden">
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={isExpanded ? "expanded" : "collapsed"}
        variants={containerVariants}
        whileTap={!isExpanded ? { scale: 0.95 } : {}}
        onClick={handleNavClick}
        className={cn(
          "relative flex h-12 max-w-[92vw] items-center justify-center overflow-hidden rounded-full border shadow-lg backdrop-blur-md",
          !isExpanded && "cursor-pointer"
        )}
        style={{
          background: "var(--panel)",
          borderColor: "var(--border-strong)",
        }}
      >
        <motion.div
          className={cn("flex items-center gap-0.5 overflow-x-auto px-2 no-scrollbar", !isExpanded && "pointer-events-none")}
        >
          {items.map((item) => (
            <motion.div key={item.label} variants={itemVariants} onClick={(e) => e.stopPropagation()}>
              <Link
                href={item.href}
                aria-label={item.label}
                className="flex shrink-0 items-center justify-center rounded-full p-2.5 transition-colors"
                style={{
                  color: item.active ? "var(--text)" : "var(--text-faint)",
                  background: item.active ? "var(--panel3)" : "transparent",
                }}
              >
                <span className="[&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <motion.div variants={collapsedIconVariants} animate={isExpanded ? "expanded" : "collapsed"} style={{ color: "var(--text)" }}>
            <Menu className="h-5 w-5" />
          </motion.div>
        </div>
      </motion.nav>
    </div>
  );
}
