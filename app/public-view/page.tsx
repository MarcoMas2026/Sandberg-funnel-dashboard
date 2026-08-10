"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useEffect, useMemo, useState } from "react";
import GridLayout, { Layout, WidthProvider } from "react-grid-layout";
import { useDashboard } from "@/lib/dashboard-context";
import { usePublicView } from "@/lib/public-view-context";
import { Pinnable } from "@/components/Pinnable";
import { PublicViewTile } from "@/lib/public-view-registry";
import { PublicViewTheme, PublicViewWidgetType } from "@/lib/types";

const ResponsiveGridLayout = WidthProvider(GridLayout);

export default function PublicViewPage() {
  return <PublicViewBuilder />;
}

function PublicViewBuilder() {
  const { data, loading } = useDashboard();
  const {
    views,
    activeViewSlug,
    activeConfig,
    loadingViews,
    saving,
    error,
    selectView,
    createView,
    deleteView,
    pinWidget,
    updateWidgetLayout,
    removeWidget,
    setTheme,
    setPublished,
    toggleFreeze,
  } = usePublicView();

  // The dock persists which Public View is "active" across every page — on
  // arriving here directly (fresh load, or nav from elsewhere), load that
  // same one into the canvas instead of showing an empty "pick a view" state.
  useEffect(() => {
    if (activeViewSlug && activeConfig?.slug !== activeViewSlug) {
      selectView(activeViewSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeViewSlug]);

  const [dragOver, setDragOver] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newLabel, setNewLabel] = useState("");

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData("application/x-public-view-widget");
    if (!raw) return;
    const { type, campaignId } = JSON.parse(raw) as { type: PublicViewWidgetType; campaignId?: string };
    pinWidget(type, campaignId);
  }

  const gridLayout: Layout[] = useMemo(
    () =>
      (activeConfig?.widgets ?? []).map((w) => ({
        i: w.id,
        x: w.layout.x,
        y: w.layout.y,
        w: w.layout.w,
        h: w.layout.h,
      })),
    [activeConfig?.widgets]
  );

  const safeData = data ?? { campaigns: [], last_updated: null, status: "stale" as const };

  return (
    <div className="space-y-6">
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-faint)]">Client-Facing</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Public View</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Hold <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px]">Option</kbd> and
            drag a box from the left into the report on the right to pin it.
          </p>
        </div>
      </div>

      {/* view switcher */}
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        {loadingViews ? (
          <span className="text-sm text-[var(--text-muted)]">Loading…</span>
        ) : (
          views.map((v) => (
            <button
              key={v.slug}
              onClick={() => selectView(v.slug)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                activeConfig?.slug === v.slug
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--panel2)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {v.propertyLabel}
              {v.published && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </button>
          ))
        )}
        {!showNewForm ? (
          <button
            onClick={() => setShowNewForm(true)}
            className="rounded-full border border-dashed border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            + New Public View
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newSlug.trim() || !newLabel.trim()) return;
              createView(newSlug.trim(), newLabel.trim());
              setNewSlug("");
              setNewLabel("");
              setShowNewForm(false);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Property label"
              className="rounded-md border border-[var(--border)] bg-[var(--panel2)] px-2 py-1 text-xs text-[var(--text)]"
            />
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="slug"
              className="rounded-md border border-[var(--border)] bg-[var(--panel2)] px-2 py-1 text-xs text-[var(--text)]"
            />
            <button type="submit" className="rounded-md bg-[var(--accent)] px-2 py-1 text-xs text-white">
              Create
            </button>
          </form>
        )}
      </div>

      {error && <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}

      {!activeConfig ? (
        <div className="panel p-8 text-center text-sm text-[var(--text-muted)]">
          Select a Public View above, or create a new one, to start pinning boxes.
        </div>
      ) : (
        <>
          <div className="panel flex flex-wrap items-center gap-3 p-3">
            <span className="text-xs uppercase tracking-wide text-[var(--text-faint)]">/view/{activeConfig.slug}</span>
            <select
              value={activeConfig.theme}
              onChange={(e) => setTheme(e.target.value as PublicViewTheme)}
              className="rounded-md border border-[var(--border)] bg-[var(--panel2)] px-2 py-1 text-xs text-[var(--text)]"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="estate">Estate</option>
            </select>
            <button
              onClick={toggleFreeze}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                activeConfig.frozen ? "bg-sky-500/20 text-sky-300" : "bg-[var(--panel2)] text-[var(--text-muted)]"
              }`}
            >
              {activeConfig.frozen ? "Frozen — Unfreeze" : "Freeze"}
            </button>
            <button
              onClick={() => setPublished(!activeConfig.published)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                activeConfig.published ? "bg-emerald-500/20 text-emerald-300" : "bg-[var(--accent)] text-white"
              }`}
            >
              {activeConfig.published ? "Published — Unpublish" : "Publish"}
            </button>
            {activeConfig.published && (
              <a
                href={`/view/${activeConfig.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--accent)] underline"
              >
                Open link ↗
              </a>
            )}
            <button
              onClick={() => deleteView(activeConfig.slug)}
              className="ml-auto text-xs text-[var(--text-faint)] hover:text-red-400"
            >
              Delete
            </button>
            {saving && <span className="text-xs text-[var(--text-faint)]">Saving…</span>}
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="panel max-h-[70vh] space-y-4 overflow-y-auto p-4">
              <SourceGroup title="Portfolio">
                <Pinnable type="portfolio-spend">
                  <MiniTile label="Total Spend" />
                </Pinnable>
                <Pinnable type="portfolio-leads">
                  <MiniTile label="Total Leads" />
                </Pinnable>
                <Pinnable type="portfolio-cpl">
                  <MiniTile label="Blended CPL" />
                </Pinnable>
              </SourceGroup>

              {safeData.campaigns.map((c) => (
                <SourceGroup key={c.campaign_id} title={c.property}>
                  <Pinnable type="campaign-spend" campaignId={c.campaign_id}>
                    <MiniTile label="Spend" />
                  </Pinnable>
                  <Pinnable type="campaign-leads" campaignId={c.campaign_id}>
                    <MiniTile label="Leads" />
                  </Pinnable>
                  <Pinnable type="campaign-cpl" campaignId={c.campaign_id}>
                    <MiniTile label="Cost / Lead" />
                  </Pinnable>
                  <Pinnable type="campaign-outbound-ctr" campaignId={c.campaign_id}>
                    <MiniTile label="Outbound CTR" />
                  </Pinnable>
                  <Pinnable type="campaign-spend-trend" campaignId={c.campaign_id}>
                    <MiniTile label="Spend Trend" />
                  </Pinnable>
                </SourceGroup>
              ))}
              {loading && <p className="text-xs text-[var(--text-faint)]">Loading campaigns…</p>}
            </div>

            <div
              data-pv-theme={activeConfig.theme}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`pv-canvas pv-drop-zone min-h-[70vh] p-4 ${dragOver ? "pv-drop-zone--over" : ""}`}
            >
              {activeConfig.widgets.length === 0 ? (
                <div
                  className="flex h-full min-h-[60vh] items-center justify-center text-sm"
                  style={{ color: "var(--pv-muted)" }}
                >
                  Hold Option and drag a box here
                </div>
              ) : (
                <ResponsiveGridLayout
                  className="layout"
                  layout={gridLayout}
                  cols={12}
                  rowHeight={90}
                  margin={[16, 16]}
                  draggableCancel=".pv-remove-btn"
                  onLayoutChange={(layout: Layout[]) => {
                    layout.forEach((l) => {
                      const widget = activeConfig.widgets.find((w) => w.id === l.i);
                      if (
                        widget &&
                        (widget.layout.x !== l.x ||
                          widget.layout.y !== l.y ||
                          widget.layout.w !== l.w ||
                          widget.layout.h !== l.h)
                      ) {
                        updateWidgetLayout(widget.id, { x: l.x, y: l.y, w: l.w, h: l.h });
                      }
                    });
                  }}
                >
                  {activeConfig.widgets.map((widget) => (
                    <div key={widget.id} className="group relative">
                      <button
                        onClick={() => removeWidget(widget.id)}
                        className="pv-remove-btn absolute right-1 top-1 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white group-hover:flex"
                      >
                        ×
                      </button>
                      <PublicViewTile widget={widget} data={safeData} />
                    </div>
                  ))}
                </ResponsiveGridLayout>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SourceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MiniTile({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-xs font-medium text-[var(--text)]">
      {label}
    </div>
  );
}
