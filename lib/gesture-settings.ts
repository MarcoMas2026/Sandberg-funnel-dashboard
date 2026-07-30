"use client";

import type { GesturePoint } from "./gesture-recognizer";
import { GESTURE_TEMPLATES, LAYER_GESTURE_TEMPLATES } from "./gesture-templates";

const STORAGE_KEY = "gestureNav.customTemplates";
export const GESTURE_TEMPLATES_UPDATED_EVENT = "gesture-templates-updated";

export function getCustomTemplates(): Record<string, GesturePoint[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCustomTemplate(href: string, points: GesturePoint[]) {
  const all = getCustomTemplates();
  all[href] = points;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(GESTURE_TEMPLATES_UPDATED_EVENT));
}

export function resetCustomTemplate(href: string) {
  const all = getCustomTemplates();
  delete all[href];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(GESTURE_TEMPLATES_UPDATED_EVENT));
}

// Merges saved overrides (from the settings panel) on top of the built-in
// shapes — only the stroke points change, name/href/label stay put so
// GestureNav's route lookup keeps working untouched.
export function effectiveTemplates() {
  const custom = getCustomTemplates();
  return GESTURE_TEMPLATES.map((t) => (custom[t.href] ? { ...t, points: custom[t.href] } : t));
}

// Same idea for the 6 per-layer digit shortcuts, keyed by `id` (e.g.
// "layer-3") instead of `href` since they don't have a fixed destination.
export function effectiveLayerTemplates() {
  const custom = getCustomTemplates();
  return LAYER_GESTURE_TEMPLATES.map((t) => (custom[t.id] ? { ...t, points: custom[t.id] } : t));
}
