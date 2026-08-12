"use client";

import { LeadRecord, LeadTag } from "@/lib/types";

const TAG_LABEL: Record<"red" | "orange" | "blue" | "none", string> = {
  red: "Red — hot",
  orange: "Orange — warm",
  blue: "Blue — cold",
  none: "No tag",
};

// Mobile-only bottom sheet for setting a lead's qualification tag: replaces
// tapping a tiny inline swatch (easy to fat-finger the wrong option) with one
// deliberate choice from a full-width list.
export function LeadTagSheet({
  lead,
  onSelect,
  onClose,
}: {
  lead: LeadRecord;
  onSelect: (responseId: string, tag: LeadTag) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-2xl bg-[#1b2540] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3">
          <div className="text-sm font-semibold">{`${lead.first_name} ${lead.last_name}`.trim() || "Lead"}</div>
          <div className="text-xs text-white/70">
            {lead.language || "—"} · {lead.budget || "—"} · {lead.stage || "—"} · {lead.buying_timeline || "—"}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {(["red", "orange", "blue", "none"] as const).map((option) => {
            const tagValue: LeadTag = option === "none" ? null : option;
            const active = lead.tag === tagValue;
            return (
              <button
                key={option}
                type="button"
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm ${
                  active ? "border-white bg-white/10" : "border-white/20"
                }`}
                onClick={() => {
                  onSelect(lead.response_id, tagValue);
                  onClose();
                }}
              >
                <span>{TAG_LABEL[option]}</span>
                {active && <span>✓</span>}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-white/20 px-3 py-2 text-center text-sm text-white/70"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
