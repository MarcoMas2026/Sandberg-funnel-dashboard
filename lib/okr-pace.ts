// Pure pacing math, kept client-safe (no lib/kv.ts or lib/sheets.ts imports,
// which pull in googleapis / Node core modules unavailable in the browser
// bundle) so app/(okr)/okrs/page.tsx can use it directly.
import { KeyResult, KrTask } from "./types";

// A Key Result's progress is always the fraction of its own tasks that are
// done — 0 if it has no tasks yet defined. This is the sole source for
// kr.actual/.progress; the sheet's Actual Percentage cell is write-only.
export function computeKrActualFromTasks(tasks: KrTask[]): number {
  return tasks.length ? tasks.filter((t) => t.done).length / tasks.length : 0;
}

// Linear pacing model: where a Key Result's actual % "should" be today, given
// how much of its cycle's time has elapsed.
export function computeExpectedPace(kr: KeyResult, timeProgress: number): number {
  return kr.initial + (kr.target - kr.initial) * timeProgress;
}
