"use client";

import { useRef } from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { LeadRecord, LeadTag } from "@/lib/types";
import { PropertyInfo } from "@/lib/properties";
import { formatDate } from "@/lib/format";

const TAG_COLORS: Record<Exclude<LeadTag, null>, string> = {
  red: "#ef4444",
  orange: "#f59e0b",
  blue: "#3b82f6",
};

// Drag distance (px) past which a release commits red/blue instead of
// springing back. Velocity contributes too, same "distance OR a fast flick"
// feel as the carousel this pattern is adapted from.
const COMMIT_DISTANCE = 120;
const COMMIT_VELOCITY = 500;

// Multi-tap window for the "2-3 taps = orange" gesture — deliberately
// requires TAP_THRESHOLD taps within TAP_WINDOW_MS so a single stray click
// (e.g. while scrolling) never silently tags a lead.
const TAP_WINDOW_MS = 600;
const TAP_THRESHOLD = 2;

export interface LeadSwipeCardProps {
  lead: LeadRecord;
  property: PropertyInfo | null;
  propertyName: string;
  stackPosition: 0 | 1 | 2; // 0 = front (interactive), 1/2 = peeking behind
  onCommit: (tag: Exclude<LeadTag, null>) => void;
}

export function LeadSwipeCard({ lead, property, propertyName, stackPosition, onCommit }: LeadSwipeCardProps) {
  const y = useMotionValue(0);
  const x = useMotionValue(0);
  const tapTimestamps = useRef<number[]>([]);

  const rotate = useTransform(y, [-260, 0, 260], [-10, 0, 10]);
  const redOpacity = useTransform(y, [-160, -40, 0], [0.85, 0, 0]);
  const blueOpacity = useTransform(y, [0, 40, 160], [0, 0, 0.85]);
  const contentOpacity = useTransform(y, [-200, 0, 200], [0.3, 1, 0.3]);

  const isFront = stackPosition === 0;

  function flingOffAndCommit(tag: Exclude<LeadTag, null>, direction: -1 | 1) {
    onCommit(tag);
    animate(y, direction * 900, { type: "spring", stiffness: 260, damping: 30, mass: 0.9 });
  }

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const distance = info.offset.y;
    const velocity = info.velocity.y;

    if (distance < -COMMIT_DISTANCE || velocity < -COMMIT_VELOCITY) {
      flingOffAndCommit("red", -1);
      return;
    }
    if (distance > COMMIT_DISTANCE || velocity > COMMIT_VELOCITY) {
      flingOffAndCommit("blue", 1);
      return;
    }
    animate(y, 0, { type: "spring", stiffness: 300, damping: 26 });
    animate(x, 0, { type: "spring", stiffness: 300, damping: 26 });
  }

  function handleTap() {
    const now = Date.now();
    tapTimestamps.current = [...tapTimestamps.current, now].filter((t) => now - t < TAP_WINDOW_MS);
    if (tapTimestamps.current.length >= TAP_THRESHOLD) {
      tapTimestamps.current = [];
      onCommit("orange");
      animate(y, -30, { type: "tween", duration: 0.12 }).then(() => {
        animate(y, 0, { type: "spring", stiffness: 300, damping: 24 });
      });
    }
  }

  const stackStyle =
    stackPosition === 1
      ? { scale: 0.96, y: 14, opacity: 0.7 }
      : stackPosition === 2
        ? { scale: 0.92, y: 26, opacity: 0.4 }
        : { scale: 1, y: 0, opacity: 1 };

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - stackPosition }}
      animate={isFront ? undefined : stackStyle}
      initial={false}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <motion.div
        drag={isFront ? "y" : false}
        dragElastic={0.7}
        dragMomentum={false}
        onDragEnd={isFront ? handleDragEnd : undefined}
        onTap={isFront ? handleTap : undefined}
        style={isFront ? { y, x, rotate } : undefined}
        className="relative h-full w-full cursor-grab overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel2)] shadow-[var(--shadow-card)] active:cursor-grabbing"
      >
        {property?.image && (
          <img
            src={property.image}
            alt={propertyName}
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-black/25" />

        {isFront && (
          <>
            <motion.div style={{ opacity: redOpacity }} className="pointer-events-none absolute inset-0 bg-red-500" />
            <motion.div style={{ opacity: blueOpacity }} className="pointer-events-none absolute inset-0 bg-blue-500" />
          </>
        )}

        <motion.div style={isFront ? { opacity: contentOpacity } : undefined} className="relative flex h-full flex-col justify-between p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold leading-tight drop-shadow-md">{propertyName}</p>
              {property?.price && <p className="text-sm text-white/85 drop-shadow-md">{property.price}</p>}
            </div>
            {lead.tag && (
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white/70"
                style={{ background: TAG_COLORS[lead.tag] }}
              />
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl bg-white/70 p-3.5 text-black backdrop-blur-sm">
              <p className="text-base font-semibold">
                {lead.first_name || lead.last_name ? `${lead.first_name} ${lead.last_name}`.trim() : "—"}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <Field label="Search stage" value={lead.stage} />
                <Field label="Investment budget" value={lead.budget} />
                <Field label="Buying timeline" value={lead.buying_timeline} />
                <Field label="Submitted" value={formatDate(lead.submitted_at)} />
              </dl>
            </div>
            {property?.agent && (
              <p className="inline-block rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-medium text-black backdrop-blur-sm">
                Listing agent: {property.agent}
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wide text-black/50">{label}</dt>
      <dd className="text-black/90">{value || "—"}</dd>
    </div>
  );
}
