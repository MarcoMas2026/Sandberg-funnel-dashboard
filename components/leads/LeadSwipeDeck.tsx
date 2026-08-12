"use client";

import { useMemo, useState } from "react";
import { LeadRecord, LeadTag } from "@/lib/types";
import { propertyInfoForCampaign, propertyNameFromCampaign } from "@/lib/property-lookup";
import { LeadSwipeCard } from "./LeadSwipeCard";

// Card-stack UI for classifying leads by drag/tap instead of the table's
// inline swatches: swipe up = red (high), swipe down = blue (low), 2-3 quick
// taps = orange (medium). Delegates persistence to the same setTag the table
// view uses, so a tag set here shows up immediately in the table and vice
// versa. Gesture-only by design — no button fallback.
export function LeadSwipeDeck({
  leads,
  onSetTag,
}: {
  leads: LeadRecord[];
  onSetTag: (responseId: string, tag: LeadTag) => void;
}) {
  // Only untagged leads belong in this view. A lead that just got tagged by
  // THIS deck stays visible for one beat via pendingExitIds so its fling/pop
  // animation can finish; a lead tagged some other way (e.g. the table, while
  // this view happens to be open) has no animation to wait for and drops out
  // on the next render, straight from the tag !== null check below.
  const [pendingExitIds, setPendingExitIds] = useState<string[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const queue = useMemo(
    () =>
      leads.filter(
        (l) => !removedIds.includes(l.response_id) && (l.tag === null || pendingExitIds.includes(l.response_id)),
      ),
    [leads, removedIds, pendingExitIds],
  );

  const visible = queue.slice(0, 3);

  function commit(lead: LeadRecord, tag: Exclude<LeadTag, null>) {
    setPendingExitIds((ids) => [...ids, lead.response_id]);
    onSetTag(lead.response_id, tag);
    // Give the fling/pop animation a beat before the next card takes over —
    // matches LeadSwipeCard's own spring/tween durations.
    window.setTimeout(() => {
      setRemovedIds((ids) => [...ids, lead.response_id]);
      setPendingExitIds((ids) => ids.filter((id) => id !== lead.response_id));
    }, 220);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-[420px] w-full max-w-sm sm:h-[460px]">
        {visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--border-strong)] text-center">
            <p className="text-sm font-medium text-[var(--text)]">All caught up</p>
            <p className="mt-1 text-xs text-[var(--text-faint)]">No more leads to classify in this view.</p>
          </div>
        ) : (
          visible.map((lead, i) => (
            <LeadSwipeCard
              key={lead.response_id}
              lead={lead}
              property={propertyInfoForCampaign(lead.campaign_id, lead.campaign_name)}
              propertyName={propertyNameFromCampaign(lead.campaign_id, lead.campaign_name)}
              stackPosition={i as 0 | 1 | 2}
              onCommit={(tag) => commit(lead, tag)}
            />
          ))
        )}
      </div>
      <p className="text-center text-[11px] text-[var(--text-faint)]">
        Swipe up = red · swipe down = blue · double-tap the card = orange
      </p>
    </div>
  );
}
