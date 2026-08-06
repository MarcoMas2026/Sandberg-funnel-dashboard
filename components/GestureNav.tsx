"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";
import { compileTemplates, recognize, type GesturePoint } from "@/lib/gesture-recognizer";
import { GESTURE_TEMPLATES, LAYER_GESTURE_TEMPLATES } from "@/lib/gesture-templates";
import { effectiveTemplates, effectiveLayerTemplates, GESTURE_TEMPLATES_UPDATED_EVENT } from "@/lib/gesture-settings";

const TRAIL_LIFETIME_MS = 700;
const MATCH_THRESHOLD = 0.72;
const MIN_POINTS = 6;

type StrokePoint = GesturePoint & { t: number };
type Result = { label: string; href: string } | "no-match" | null;

// Shift + left-click-drag draws a short-lived pen trail anywhere on the app;
// releasing the mouse recognizes the stroke as a letter/symbol (via the $1
// unistroke recognizer in lib/gesture-recognizer.ts) and jumps straight to
// the matching top-level section — a gestural alternative to clicking
// through the sidebar for a page buried a few levels deep. Drawing a digit
// (1-6) instead jumps to that funnel layer within whichever campaign is
// currently open (lib/gesture-templates.ts's LAYER_GESTURE_TEMPLATES).
//
// Desktop only, by design: there's no Shift key on touch, and the settings
// entry point for it (Sidebar) is already desktop-only (see MobileTopNav for
// the mobile equivalent) — this component mirrors that with its own guard so
// it doesn't attach listeners or render its overlay canvas on mobile at all.
export default function GestureNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useDashboard();
  const firstCampaignId = data?.campaigns?.[0]?.campaign_id;
  const firstCampaignIdRef = useRef(firstCampaignId);
  firstCampaignIdRef.current = firstCampaignId;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<StrokePoint[]>([]);
  const drawingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [resultBanner, setResultBanner] = useState<Result>(null);
  const [bannerPos, setBannerPos] = useState<{ x: number; y: number } | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const [rawTemplates, setRawTemplates] = useState(() => [...effectiveTemplates(), ...effectiveLayerTemplates()]);
  useEffect(() => {
    // Settings panel writes overrides to localStorage and fires this event
    // (same tab) so a redrawn shape takes effect without a reload.
    function recompute() {
      setRawTemplates([...effectiveTemplates(), ...effectiveLayerTemplates()]);
    }
    window.addEventListener(GESTURE_TEMPLATES_UPDATED_EVENT, recompute);
    window.addEventListener("storage", recompute);
    return () => {
      window.removeEventListener(GESTURE_TEMPLATES_UPDATED_EVENT, recompute);
      window.removeEventListener("storage", recompute);
    };
  }, []);
  const templates = useMemo(() => compileTemplates(rawTemplates), [rawTemplates]);

  useEffect(() => {
    if (!isDesktop) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!ctx || !canvas) return;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = performance.now();
      const pts = pointsRef.current;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 1; i < pts.length; i++) {
        const age = now - pts[i].t;
        if (age > TRAIL_LIFETIME_MS) continue;
        const alpha = 1 - age / TRAIL_LIFETIME_MS;
        ctx.strokeStyle = `rgba(245, 179, 61, ${alpha})`;
        ctx.lineWidth = 3 + alpha * 2;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    function onMouseDown(e: MouseEvent) {
      if (!e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      drawingRef.current = true;
      pointsRef.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      setResultBanner(null);
    }
    function onMouseMove(e: MouseEvent) {
      if (!drawingRef.current) return;
      pointsRef.current.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    }
    function onMouseUp(e: MouseEvent) {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const stroke = pointsRef.current;
      setBannerPos({ x: e.clientX, y: e.clientY });
      if (stroke.length < MIN_POINTS) {
        setResultBanner("no-match");
      } else {
        const match = recognize(stroke, templates);
        const tpl = match && match.score >= MATCH_THRESHOLD ? GESTURE_TEMPLATES.find((t) => t.name === match.name) : null;
        const layerTpl = !tpl && match && match.score >= MATCH_THRESHOLD ? LAYER_GESTURE_TEMPLATES.find((t) => t.name === match.name) : null;
        if (tpl) {
          // "/campaign" has no index page — resolve to the first live
          // campaign, same fallback the sidebar link uses.
          const href =
            tpl.href === "/campaign" ? (firstCampaignIdRef.current ? `/campaign/${firstCampaignIdRef.current}` : "/") : tpl.href;
          setResultBanner({ label: tpl.label, href });
          window.setTimeout(() => router.push(href), 260);
        } else if (layerTpl) {
          // Digit gestures jump to a layer within whatever campaign is
          // currently in view — falls back to the first live campaign when
          // drawn from outside a campaign page (e.g. Mission Control).
          const currentCampaignId = pathnameRef.current.match(/^\/campaign\/([^/]+)/)?.[1];
          const campaignId = currentCampaignId ?? firstCampaignIdRef.current;
          if (campaignId) {
            const href = `/campaign/${campaignId}/layer/${layerTpl.layerId}`;
            setResultBanner({ label: layerTpl.label, href });
            window.setTimeout(() => router.push(href), 260);
          } else {
            setResultBanner("no-match");
          }
        } else {
          setResultBanner("no-match");
        }
      }
      window.setTimeout(() => setResultBanner(null), 900);
    }
    // Prevent the browser's shift-click text-selection behavior from firing
    // alongside the gesture.
    function onSelectStart(e: Event) {
      if (drawingRef.current) e.preventDefault();
    }

    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("selectstart", onSelectStart);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      document.removeEventListener("selectstart", onSelectStart);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [router, templates, isDesktop]);

  if (!isDesktop) return null;

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[999]" />
      {resultBanner && bannerPos && (
        <div
          className="pointer-events-none fixed z-[1000] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-[#1b2540] px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: bannerPos.x, top: bannerPos.y - 10 }}
        >
          {resultBanner === "no-match" ? "No match — try again" : `→ ${resultBanner.label}`}
        </div>
      )}
    </>
  );
}
