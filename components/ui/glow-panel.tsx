import { cn } from "@/lib/utils";

// Plain panel/card wrapper. Used to be a mouse-tracked animated glow border
// (GlowingEffect) — removed per the monochrome restyle; kept as a thin
// pass-through so none of its call sites need touching.
export function GlowPanel({
  className,
  wrapperClassName,
  style,
  children,
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
    <div className={cn(wrapperClassName)} style={style}>
      <Component className={className}>{children}</Component>
    </div>
  );
}
