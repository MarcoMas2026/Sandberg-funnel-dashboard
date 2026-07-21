"use client";

import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";

// Wraps any panel/card in the mouse-tracked glowing border, replacing the
// old static colored side-bars (accent-bar, severity bars) used across the
// app. `className` is applied to the inner visible card exactly as it was
// before wrapping (e.g. "panel p-5") — only the thin outer frame is new.
export function GlowPanel({
  className,
  wrapperClassName,
  style,
  children,
  spread = 40,
  borderWidth = 2,
  as: Component = "div",
}: {
  className?: string;
  wrapperClassName?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  spread?: number;
  borderWidth?: number;
  as?: "div" | "article";
}) {
  return (
    <div className={cn("relative rounded-[var(--radius-lg)] p-1", wrapperClassName)} style={style}>
      <GlowingEffect spread={spread} glow proximity={64} inactiveZone={0.01} borderWidth={borderWidth} disabled={false} />
      <Component className={className}>{children}</Component>
    </div>
  );
}
