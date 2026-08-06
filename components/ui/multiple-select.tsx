"use client";

import { HTMLAttributes, PropsWithChildren, ReactNode, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type TTag = {
  key: string;
  name: string;
};

type MultipleSelectProps = {
  tags: TTag[];
  customTag?: (item: TTag) => ReactNode | string;
  onChange?: (value: TTag[]) => void;
  defaultValue?: TTag[];
  // Optional label above the selected tray — the upstream component hardcoded
  // "TAGS"; this app reuses the component for different selectors (e.g.
  // campaigns), each needing its own label or none at all.
  label?: string;
  // Optional per-tag accent (e.g. the chart-line color a campaign is
  // assigned once selected) — rendered as a small dot before the tag name,
  // in both the selected tray and the picklist, when no customTag is given.
  colorFor?: (item: TTag) => string | undefined;
  className?: string;
};

export const MultipleSelect = ({
  tags,
  customTag,
  onChange,
  defaultValue,
  label,
  colorFor,
  className,
}: MultipleSelectProps) => {
  const [selected, setSelected] = useState<TTag[]>(defaultValue ?? []);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef?.current) {
      containerRef.current.scrollBy({
        left: containerRef.current?.scrollWidth,
        behavior: "smooth",
      });
    }
    onValueChange(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const onValueChange = (value: TTag[]) => {
    onChange?.(value);
  };

  const onSelect = (item: TTag) => {
    setSelected((prev) => [...prev, item]);
  };

  const onDeselect = (item: TTag) => {
    setSelected((prev) => prev.filter((i) => i !== item));
  };

  return (
    <AnimatePresence mode={"popLayout"}>
      <div className={cn("flex w-full flex-col gap-2", className)}>
        {label && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">{label}</span>
        )}
        <motion.div
          layout
          ref={containerRef}
          className="no-scrollbar flex h-12 w-full items-center overflow-x-scroll scroll-smooth rounded-md border border-[var(--border)] bg-[var(--panel2)] p-2"
        >
          <motion.div layout className="flex items-center gap-2">
            {selected?.map((item) => (
              <Tag name={item?.key} key={item?.key} className="bg-[var(--panel)] shadow-sm">
                <div className="flex items-center gap-2">
                  {colorFor && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colorFor(item) }} />
                  )}
                  <motion.span layout className="text-nowrap">
                    {item?.name}
                  </motion.span>
                  <button onClick={() => onDeselect(item)} aria-label={`Remove ${item.name}`}>
                    <X size={14} />
                  </button>
                </div>
              </Tag>
            ))}
            {selected.length === 0 && (
              <span className="px-1 text-sm text-[var(--text-faint)]">Nothing selected</span>
            )}
          </motion.div>
        </motion.div>
        {tags?.length > selected?.length && (
          <div className="flex w-full flex-wrap gap-2 rounded-md border border-[var(--border)] p-2">
            {tags
              ?.filter((item) => !selected?.some((i) => i.key === item.key))
              .map((item) => (
                <Tag name={item?.key} onClick={() => onSelect(item)} key={item?.key}>
                  {customTag ? (
                    customTag(item)
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {colorFor && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: colorFor(item) }}
                        />
                      )}
                      <motion.span layout className="text-nowrap">
                        {item?.name}
                      </motion.span>
                    </div>
                  )}
                </Tag>
              ))}
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};

type TagProps = PropsWithChildren &
  Pick<HTMLAttributes<HTMLDivElement>, "onClick"> & {
    name?: string;
    className?: string;
  };

export const Tag = ({ children, className, name, onClick }: TagProps) => {
  return (
    <motion.div
      layout
      layoutId={name}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-md bg-[var(--panel2)] px-2 py-1 text-sm text-[var(--text)]",
        className
      )}
    >
      {children}
    </motion.div>
  );
};
