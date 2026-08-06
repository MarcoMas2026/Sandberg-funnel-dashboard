"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GESTURE_TEMPLATES, LAYER_GESTURE_TEMPLATES } from "@/lib/gesture-templates";
import { getCustomTemplates, saveCustomTemplate, resetCustomTemplate } from "@/lib/gesture-settings";
import type { GesturePoint } from "@/lib/gesture-recognizer";

const EDITOR_SIZE = 120;

export default function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [custom, setCustom] = useState<Record<string, GesturePoint[]>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) setCustom(getCustomTemplates());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // The sidebar's own layout wrapper is `md:sticky`, which establishes a new
  // stacking context — a fixed-position modal nested inside it would be
  // trapped under that context and rendered below the main dashboard content
  // regardless of z-index. Portal to <body> so it truly floats on top.
  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>

        <section>
          <h3 className="text-sm font-semibold text-[var(--text)]">Gesture shortcuts</h3>
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            Hold Shift and drag anywhere in the app to draw a shape that jumps straight to a section. Redraw any
            shape below to remap it to something that feels more natural to you.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {GESTURE_TEMPLATES.map((t) => (
              <GestureEditor
                key={t.href}
                label={t.label}
                symbol={t.name}
                defaultPoints={t.points}
                customPoints={custom[t.href]}
                onSave={(points) => {
                  saveCustomTemplate(t.href, points);
                  setCustom(getCustomTemplates());
                }}
                onReset={() => {
                  resetCustomTemplate(t.href);
                  setCustom(getCustomTemplates());
                }}
              />
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-[var(--text)]">Layer shortcuts</h3>
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            Draw a digit to jump to that funnel layer within whichever campaign is currently open (or the first
            live one, if drawn from Mission Control).
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {LAYER_GESTURE_TEMPLATES.map((t) => (
              <GestureEditor
                key={t.id}
                label={`Layer ${t.layerId}`}
                symbol={t.name}
                defaultPoints={t.points}
                customPoints={custom[t.id]}
                onSave={(points) => {
                  saveCustomTemplate(t.id, points);
                  setCustom(getCustomTemplates());
                }}
                onReset={() => {
                  resetCustomTemplate(t.id);
                  setCustom(getCustomTemplates());
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

function GestureEditor({
  label,
  symbol,
  defaultPoints,
  customPoints,
  onSave,
  onReset,
}: {
  label: string;
  symbol: string;
  defaultPoints: GesturePoint[];
  customPoints: GesturePoint[] | undefined;
  onSave: (points: GesturePoint[]) => void;
  onReset: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef<GesturePoint[]>([]);
  const guideRef = useRef<GesturePoint[]>(customPoints ?? defaultPoints);
  const [savedFlash, setSavedFlash] = useState(false);

  guideRef.current = customPoints ?? defaultPoints;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = EDITOR_SIZE * dpr;
    canvas.height = EDITOR_SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    function guideToCanvas(pts: GesturePoint[]) {
      // Default template anchors are 0..1; custom points are already raw
      // canvas-pixel coordinates from a previous draw in this same-size box.
      const looksNormalized = pts.every((p) => p.x >= -0.05 && p.x <= 1.05 && p.y >= -0.05 && p.y <= 1.05);
      return looksNormalized ? pts.map((p) => ({ x: p.x * EDITOR_SIZE, y: p.y * EDITOR_SIZE })) : pts;
    }

    function redraw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, EDITOR_SIZE, EDITOR_SIZE);
      const guide = guideToCanvas(guideRef.current);
      ctx.strokeStyle = "rgba(140, 140, 160, 0.35)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (guide.length > 1) {
        ctx.beginPath();
        ctx.moveTo(guide[0].x, guide[0].y);
        for (const p of guide.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      const drawn = pointsRef.current;
      if (drawn.length > 1) {
        ctx.strokeStyle = "#f5b33d";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(drawn[0].x, drawn[0].y);
        for (const p of drawn.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }

    function toLocal(e: MouseEvent): GesturePoint {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function onDown(e: MouseEvent) {
      e.preventDefault();
      drawingRef.current = true;
      pointsRef.current = [toLocal(e)];
      redraw();
    }
    function onMove(e: MouseEvent) {
      if (!drawingRef.current) return;
      pointsRef.current.push(toLocal(e));
      redraw();
    }
    function onUp() {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (pointsRef.current.length >= 6) {
        onSave(pointsRef.current);
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 1000);
      }
      pointsRef.current = [];
      redraw();
    }

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    redraw();
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave]);

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--panel2)] p-2.5">
      <div className="text-xs font-medium text-[var(--text)]">{label}</div>
      <canvas
        ref={canvasRef}
        className="cursor-crosshair rounded-lg border border-dashed border-[var(--border)]"
        style={{ width: EDITOR_SIZE, height: EDITOR_SIZE }}
      />
      <div className="flex h-4 items-center gap-2 text-[10px]">
        {savedFlash ? (
          <span className="text-emerald-500">Saved</span>
        ) : customPoints ? (
          <>
            <span className="text-[var(--accent)]">Custom</span>
            <button className="text-[var(--text-faint)] underline" onClick={onReset}>
              Reset
            </button>
          </>
        ) : (
          <span className="text-[var(--text-faint)]">Draw &ldquo;{symbol}&rdquo; to remap</span>
        )}
      </div>
    </div>
  );
}
