"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  PublicViewConfig,
  PublicViewIndexEntry,
  PublicViewTheme,
  PublicViewWidget,
  PublicViewWidgetType,
} from "./types";

const ACTIVE_SLUG_STORAGE_KEY = "publicview:activeSlug";

interface PublicViewState {
  // True while Option/Alt is held anywhere in the app — the signal that gates
  // both the builder's source-panel drag and the global "push a real
  // dashboard box left" gesture available on every other page.
  pinModeActive: boolean;
  views: PublicViewIndexEntry[];
  // The single Public View that a global Option+drag (from any page) pins
  // into. Persisted to localStorage so it survives navigation/reload.
  // Selecting or creating a view in the /public-view builder also sets this,
  // so "the view you're editing" and "the view global drags land in" are
  // always the same one.
  activeViewSlug: string | null;
  setActiveViewSlug: (slug: string | null) => void;
  activeConfig: PublicViewConfig | null;
  loadingViews: boolean;
  loadingConfig: boolean;
  saving: boolean;
  error: string | null;
  refreshViews: () => Promise<void>;
  selectView: (slug: string) => Promise<void>;
  createView: (slug: string, propertyLabel: string) => Promise<void>;
  deleteView: (slug: string) => Promise<void>;
  pinWidget: (type: PublicViewWidgetType, campaignId?: string) => Promise<void>;
  updateWidgetLayout: (id: string, layout: PublicViewWidget["layout"]) => void;
  removeWidget: (id: string) => void;
  setTheme: (theme: PublicViewTheme) => void;
  setPublished: (published: boolean) => Promise<void>;
  toggleFreeze: () => Promise<void>;
}

const PublicViewContext = createContext<PublicViewState | null>(null);

export function PublicViewProvider({ children }: { children: React.ReactNode }) {
  const [pinModeActive, setPinModeActive] = useState(false);
  const [views, setViews] = useState<PublicViewIndexEntry[]>([]);
  const [activeViewSlug, setActiveViewSlugState] = useState<string | null>(null);
  const [activeConfig, setActiveConfig] = useState<PublicViewConfig | null>(null);
  const [loadingViews, setLoadingViews] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(ACTIVE_SLUG_STORAGE_KEY);
    if (stored) setActiveViewSlugState(stored);
  }, []);

  const setActiveViewSlug = useCallback((slug: string | null) => {
    setActiveViewSlugState(slug);
    if (slug) window.localStorage.setItem(ACTIVE_SLUG_STORAGE_KEY, slug);
    else window.localStorage.removeItem(ACTIVE_SLUG_STORAGE_KEY);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Alt") setPinModeActive(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Alt") setPinModeActive(false);
    }
    function onBlur() {
      setPinModeActive(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const refreshViews = useCallback(async () => {
    try {
      const res = await fetch("/api/public-view", { cache: "no-store" });
      const json = await res.json();
      setViews(json.views ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Public Views");
    } finally {
      setLoadingViews(false);
    }
  }, []);

  useEffect(() => {
    refreshViews();
  }, [refreshViews]);

  const selectView = useCallback(
    async (slug: string) => {
      setLoadingConfig(true);
      setError(null);
      try {
        const res = await fetch(`/api/public-view/${slug}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Failed to load Public View");
          return;
        }
        setActiveConfig(json.config);
        setActiveViewSlug(slug);
      } finally {
        setLoadingConfig(false);
      }
    },
    [setActiveViewSlug]
  );

  const createView = useCallback(
    async (slug: string, propertyLabel: string) => {
      setError(null);
      const res = await fetch("/api/public-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, propertyLabel }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to create Public View");
        return;
      }
      await refreshViews();
      setActiveConfig(json.config);
      setActiveViewSlug(json.config.slug);
    },
    [refreshViews, setActiveViewSlug]
  );

  const deleteView = useCallback(
    async (slug: string) => {
      await fetch(`/api/public-view/${slug}`, { method: "DELETE" });
      if (activeConfig?.slug === slug) setActiveConfig(null);
      if (activeViewSlug === slug) setActiveViewSlug(null);
      await refreshViews();
    },
    [activeConfig, activeViewSlug, refreshViews, setActiveViewSlug]
  );

  // Every mutation below persists immediately (PUT) — there is no separate
  // draft/save step before Publish. Freeze/unfreeze go through the dedicated
  // route since they also resolve+snapshot live FunnelData. New-widget pins
  // go through pinWidget below instead, which hits the append-only endpoint
  // so a global pin (fired from a page with no config loaded) can't clobber
  // edits made concurrently in the builder.
  const persist = useCallback(
    async (next: PublicViewConfig) => {
      setActiveConfig(next);
      setSaving(true);
      try {
        const res = await fetch(`/api/public-view/${next.slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widgets: next.widgets, theme: next.theme, published: next.published }),
        });
        const json = await res.json();
        if (!res.ok) setError(json.error ?? "Failed to save Public View");
        await refreshViews();
      } finally {
        setSaving(false);
      }
    },
    [refreshViews]
  );

  const pinWidget = useCallback(
    async (type: PublicViewWidgetType, campaignId?: string) => {
      if (!activeViewSlug) {
        setError("No active Public View selected — pick or create one first.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/public-view/${activeViewSlug}/widgets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, campaignId }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Failed to pin widget");
          return;
        }
        setActiveConfig((prev) => (prev && prev.slug === activeViewSlug ? json.config : prev));
        await refreshViews();
      } finally {
        setSaving(false);
      }
    },
    [activeViewSlug, refreshViews]
  );

  const updateWidgetLayout = useCallback(
    (id: string, layout: PublicViewWidget["layout"]) => {
      if (!activeConfig) return;
      persist({
        ...activeConfig,
        widgets: activeConfig.widgets.map((w) => (w.id === id ? { ...w, layout } : w)),
      });
    },
    [activeConfig, persist]
  );

  const removeWidget = useCallback(
    (id: string) => {
      if (!activeConfig) return;
      persist({ ...activeConfig, widgets: activeConfig.widgets.filter((w) => w.id !== id) });
    },
    [activeConfig, persist]
  );

  const setTheme = useCallback(
    (theme: PublicViewTheme) => {
      if (!activeConfig) return;
      persist({ ...activeConfig, theme });
    },
    [activeConfig, persist]
  );

  const setPublished = useCallback(
    async (published: boolean) => {
      if (!activeConfig) return;
      await persist({ ...activeConfig, published });
    },
    [activeConfig, persist]
  );

  const toggleFreeze = useCallback(async () => {
    if (!activeConfig) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/public-view/${activeConfig.slug}/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: activeConfig.frozen ? "unfreeze" : "freeze" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to update freeze state");
        return;
      }
      setActiveConfig(json.config);
      await refreshViews();
    } finally {
      setSaving(false);
    }
  }, [activeConfig, refreshViews]);

  return (
    <PublicViewContext.Provider
      value={{
        pinModeActive,
        views,
        activeViewSlug,
        setActiveViewSlug,
        activeConfig,
        loadingViews,
        loadingConfig,
        saving,
        error,
        refreshViews,
        selectView,
        createView,
        deleteView,
        pinWidget,
        updateWidgetLayout,
        removeWidget,
        setTheme,
        setPublished,
        toggleFreeze,
      }}
    >
      {children}
    </PublicViewContext.Provider>
  );
}

export function usePublicView(): PublicViewState {
  const ctx = useContext(PublicViewContext);
  if (!ctx) throw new Error("usePublicView must be used within PublicViewProvider");
  return ctx;
}
