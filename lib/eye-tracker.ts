// Head-pose ("nose") tracking cursor: click via wink/blink, scroll via edge-hold.
// Ported from the Pipeline Studio prototype (LANDINGS/pipeline-studio.js) - same engine,
// adapted into a framework-agnostic TS module. The overlay UI (gaze cursor, calibration
// screens, camera preview, nudge/zoom panels) is plain DOM, injected into document.body
// independently of React, so it survives client-side route changes in this app the same
// way it survived phase switches in Pipeline Studio - starting it here just keeps running.
//
// Uses MediaPipe FaceLandmarker (Google, open source, Apache 2.0, runs entirely on-device
// via WASM - no server calls, no API key). Tracks the nose tip rather than eye gaze: a
// large, high-contrast point is far more stable on a consumer webcam than eye/pupil
// appearance regression, at the cost of pointing being "turn your head" rather than
// "glance." See LANDINGS session notes for the full precision-tuning history.

export type EyeTrackStatus = "off" | "loading" | "calibrating" | "on";

type Point = { x: number; y: number };
type Calib = { ax: number; ay: number; bx: number; by: number };

const statusListeners = new Set<(s: EyeTrackStatus) => void>();
let status: EyeTrackStatus = "off";
function setStatus(s: EyeTrackStatus) {
  status = s;
  statusListeners.forEach((fn) => fn(s));
}
export function onEyeTrackStatusChange(fn: (s: EyeTrackStatus) => void) {
  statusListeners.add(fn);
  fn(status);
  return () => {
    statusListeners.delete(fn);
  };
}
export function getEyeTrackStatus() {
  return status;
}

const GAZE_EMA_ALPHA = 0.35;
const OFFSET_POSITIONS: [number, number][] = [
  [50, 8],
  [15, 50],
  [85, 50],
  [50, 92],
  [50, 50],
];
const OFFSET_CLICKS_NEEDED = 3;
const DENSE_GRID_COLS = 9;
const DENSE_GRID_ROWS = 6;
const DENSE_ROUNDS = 5;
const DENSE_PRE_WINDOW_MS = 2000;
const DENSE_POST_WINDOW_MS = 2000;
const NUDGE_STEP = 8;
const BLINK_SCORE_THRESHOLD = 0.4;
const WINK_ASYMMETRY_MIN = 0.25;
const WINK_CONFIRM_MS = 90;
const LONG_BLINK_MS = 450;
const CLICK_GESTURE_COOLDOWN_MS = 500;
const SCROLL_EDGE_ZONE_PX = 70;
const SCROLL_EDGE_SPEED = 8;

const state = {
  active: false,
  calibrating: false,
  smoothed: null as Point | null,
  calib: { ax: 1, ay: 1, bx: 0, by: 0 } as Calib,
  calibBase: { ax: 1, ay: 1, bx: 0, by: 0 } as Calib,
  dwellEl: null as HTMLElement | null,
  visualEl: null as HTMLElement | null,
  cooldownUntil: 0,
  offsetIdx: 0,
  offsetClicks: 0,
  offsetPointSamples: [] as Point[],
  offsetSamples: [] as { rawX: number; rawY: number; targetX: number; targetY: number }[],
  loopId: 0,
  denseConfirmed: 0,
  denseUsedDots: new Set<number>(),
  denseSamples: [] as { rawX: number; rawY: number; targetX: number; targetY: number }[],
  denseCapturing: false,
  denseCaptureLoopId: 0,
  gazeHistory: [] as { x: number; y: number; t: number }[],
  winkStartTime: 0,
  bothClosedStartTime: 0,
  clickGestureCooldownUntil: 0,
  zoom: 1,
  watchdogTimer: 0,
  camStream: null as MediaStream | null,
  camVideo: null as HTMLVideoElement | null,
  camCanvas: null as HTMLCanvasElement | null,
  camCtx: null as CanvasRenderingContext2D | null,
  detectLoopId: 0,
  lastGazeAt: 0,
  faceLost: false,
};

const FACE_LOST_MS = 400;

let faceLandmarker: any = null;
let mediapipeLoadPromise: Promise<any> | null = null;
let blinkDiagnosticLogged = false;
let stylesInjected = false;

function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.id = "eye-tracker-styles";
  style.textContent = `
    .et-gaze-cursor {
      position: fixed; width: 18px; height: 18px; border-radius: 50%; background: rgba(197,64,42,0.5);
      border: 2px solid #fff; box-shadow: 0 0 0 2px rgba(197,64,42,0.3); pointer-events: none; z-index: 2147483000;
      transform: translate(-50%, -50%); display: none;
    }
    .et-gaze-cursor.et-blink-flash { animation: et-blink-pulse 0.26s ease-out; }
    .et-gaze-cursor.et-gaze-lost {
      background: rgba(120,120,120,0.35); border-style: dashed; animation: et-gaze-lost-pulse 1.1s ease-in-out infinite;
    }
    @keyframes et-gaze-lost-pulse {
      0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; }
    }
    @keyframes et-blink-pulse {
      0% { transform: translate(-50%, -50%) scale(1); }
      40% { transform: translate(-50%, -50%) scale(2.2); background: rgba(47,138,92,0.95); }
      100% { transform: translate(-50%, -50%) scale(1); }
    }
    .et-gaze-hover { outline: 3px solid #c5402a; outline-offset: 2px; }
    .et-calib-overlay { position: fixed; inset: 0; background: rgba(23,20,15,0.92); z-index: 2147483001; }
    .et-calib-hint {
      position: absolute; top: 7%; left: 50%; transform: translateX(-50%); color: #fff; font-size: 15px;
      text-align: center; max-width: 340px; font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .et-calib-dot {
      position: absolute; width: 34px; height: 34px; border-radius: 50%; background: #c5402a; border: 3px solid #fff;
      transform: translate(-50%, -50%); cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 700; font-size: 13px; box-shadow: 0 0 0 6px rgba(197,64,42,0.2);
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .et-calib-dot.et-offset-dot { background: #3b6ea5; box-shadow: 0 0 0 6px rgba(59,110,165,0.25); font-size: 18px; }
    .et-dense-dot {
      position: absolute; width: 14px; height: 14px; border-radius: 50%; background: rgba(255,255,255,0.45);
      transform: translate(-50%, -50%); cursor: pointer; transition: transform 0.15s ease, background 0.15s ease;
    }
    .et-dense-dot:hover { background: #fff; transform: translate(-50%, -50%) scale(1.3); }
    .et-dense-dot.et-capturing { width: 26px; height: 26px; background: #3b6ea5; cursor: default; animation: et-dense-pulse 1s ease-in-out infinite; }
    .et-dense-dot.et-capturing:hover { transform: translate(-50%, -50%); }
    .et-dense-dot.et-done { width: 14px; height: 14px; background: #2f8a5c; cursor: default; }
    .et-dense-dot.et-done:hover { transform: translate(-50%, -50%); background: #2f8a5c; }
    .et-calib-overlay.et-capturing .et-dense-dot:not(.et-capturing):not(.et-done) { opacity: 0.3; pointer-events: none; }
    @keyframes et-dense-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(59,110,165,0.4); }
      50% { box-shadow: 0 0 0 10px rgba(59,110,165,0); }
    }
    .et-cam-preview {
      position: fixed; bottom: 16px; left: 16px; width: 160px; height: 120px; border-radius: 12px;
      box-shadow: 0 20px 40px -16px rgba(0,0,0,0.3); z-index: 2147483000; opacity: 0.9; background: #000;
      transform: scaleX(-1);
    }
    .et-nudge-panel, .et-zoom-panel {
      position: fixed; z-index: 2147483000; background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 1rem;
      box-shadow: 0 20px 40px -16px rgba(0,0,0,0.25); padding: 8px; display: none;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .et-nudge-panel { bottom: 16px; left: 190px; }
    .et-zoom-panel { bottom: 146px; left: 16px; width: 160px; padding: 8px 10px; }
    .et-nudge-label { font-size: 10px; color: #6b7076; text-align: center; margin-bottom: 4px; }
    .et-nudge-grid { display: grid; grid-template-columns: repeat(3, 28px); grid-template-rows: repeat(3, 28px); gap: 2px; }
    .et-nudge-grid button { border: 1px solid rgba(0,0,0,0.12); background: #f0f0f0; border-radius: 6px; cursor: pointer; font-size: 12px; padding: 0; }
    .et-nudge-grid button:hover { background: #e5e5e5; }
    .et-zoom-panel input[type=range] { width: 100%; }
    .et-gaze-warning {
      position: fixed; top: 60px; right: 20px; z-index: 2147483000; background: #f7ead9; color: #b5732a;
      border: 1px solid rgba(181,115,42,0.3); border-radius: 1.25rem; padding: 10px 14px; font-size: 12.5px;
      box-shadow: 0 20px 40px -16px rgba(0,0,0,0.25); max-width: 260px; line-height: 1.4;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .et-gaze-warning button {
      margin-top: 6px; font-size: 11px; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(0,0,0,0.12);
      background: #fff; color: #171717; cursor: pointer; display: block;
    }
    .et-scroll-edge-indicator {
      position: fixed; left: 0; right: 0; height: 6px; background: rgba(47,138,92,0.15); z-index: 2147482999;
      pointer-events: none; opacity: 0; transition: opacity 0.15s ease;
    }
    .et-scroll-edge-indicator.et-top { top: 0; }
    .et-scroll-edge-indicator.et-bottom { bottom: 0; }
    .et-scroll-edge-indicator.et-active { opacity: 1; background: rgba(47,138,92,0.4); }
  `;
  document.head.appendChild(style);
}

function contentRect() {
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

async function loadFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;
  if (mediapipeLoadPromise) return mediapipeLoadPromise;
  mediapipeLoadPromise = (async () => {
    // @ts-ignore - external CDN module, no local type declarations
    const vision = await import(/* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
    const filesetResolver = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    );
    faceLandmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
    return faceLandmarker;
  })();
  return mediapipeLoadPromise;
}

export function isEyeTrackClickable(el: Element | null): HTMLElement | null {
  let node = el as HTMLElement | null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.tagName === "BUTTON" || node.tagName === "A" || (node as any).onclick) return node;
    if (getComputedStyle(node).cursor === "pointer") return node;
    node = node.parentElement;
  }
  return null;
}

export async function startEyeTracking() {
  if (state.active || state.calibrating) return;
  ensureStyles();
  setStatus("loading");
  try {
    await loadFaceLandmarker();
  } catch (err: any) {
    alert("Could not load face tracking library: " + (err?.message ?? err));
    setStatus("off");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    await setupCamera(stream);
  } catch (err: any) {
    alert("Camera access failed: " + (err?.message ?? err));
    setStatus("off");
    return;
  }
  ensureZoomPanel();
  startDetectLoop();
  startCalibration();
  state.watchdogTimer = window.setTimeout(() => {
    if (state.active && !state.smoothed) showTrackingWarning();
  }, 4000);
}

export function stopEyeTracking() {
  state.active = false;
  state.calibrating = false;
  state.calib = { ax: 1, ay: 1, bx: 0, by: 0 };
  state.calibBase = { ax: 1, ay: 1, bx: 0, by: 0 };
  if (state.loopId) cancelAnimationFrame(state.loopId);
  state.loopId = 0;
  if (state.denseCaptureLoopId) cancelAnimationFrame(state.denseCaptureLoopId);
  state.denseCaptureLoopId = 0;
  state.denseCapturing = false;
  state.gazeHistory = [];
  state.winkStartTime = 0;
  state.bothClosedStartTime = 0;
  state.clickGestureCooldownUntil = 0;
  if (state.watchdogTimer) { clearTimeout(state.watchdogTimer); state.watchdogTimer = 0; }
  clearDwellVisual();
  state.dwellEl = null;
  state.smoothed = null;
  state.lastGazeAt = 0;
  state.faceLost = false;
  const cursor = document.getElementById("etGazeCursor");
  if (cursor) cursor.style.display = "none";
  document.getElementById("etCalibOverlay")?.remove();
  const nudge = document.getElementById("etNudgePanel");
  if (nudge) nudge.style.display = "none";
  const zoomPanel = document.getElementById("etZoomPanel");
  if (zoomPanel) zoomPanel.style.display = "none";
  document.getElementById("etGazeWarning")?.remove();
  document.getElementById("etScrollEdgeTop")?.classList.remove("et-active");
  document.getElementById("etScrollEdgeBottom")?.classList.remove("et-active");
  teardownCamera();
  setStatus("off");
}

function setupCamera(stream: MediaStream) {
  state.camStream = stream;
  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  video.style.position = "fixed";
  video.style.left = "-9999px";
  video.style.top = "-9999px";
  document.body.appendChild(video);
  state.camVideo = video;
  return new Promise<void>((resolve) => {
    video.onloadedmetadata = () => {
      video.play().catch(() => {});
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      const canvas = document.createElement("canvas");
      canvas.id = "etCamPreview";
      canvas.width = w;
      canvas.height = h;
      canvas.className = "et-cam-preview";
      document.body.appendChild(canvas);
      state.camCanvas = canvas;
      state.camCtx = canvas.getContext("2d");
      resolve();
    };
  });
}

function startDetectLoop() {
  function tick() {
    if (!state.camVideo || !state.camCanvas || !state.camCtx) return;
    const video = state.camVideo, canvas = state.camCanvas, ctx = state.camCtx;
    const w = canvas.width, h = canvas.height;
    const z = Math.max(1, state.zoom);
    const cw = w / z, ch = h / z;
    const sx = (w - cw) / 2, sy = (h - ch) / 2;
    if (video.videoWidth) ctx.drawImage(video, sx, sy, cw, ch, 0, 0, w, h);
    if (faceLandmarker && video.videoWidth) {
      const now = performance.now();
      const result = faceLandmarker.detectForVideo(canvas, now);
      if (result?.faceLandmarks?.length) {
        const nose = result.faceLandmarks[0][1];
        onGaze(nose.x * w, nose.y * h);
        ctx.beginPath();
        ctx.arc(nose.x * w, nose.y * h, 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#2f8a5c";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      checkBlinkClick(result?.faceBlendshapes, now);
    }
    state.detectLoopId = requestAnimationFrame(tick);
  }
  state.detectLoopId = requestAnimationFrame(tick);
}

function teardownCamera() {
  if (state.detectLoopId) cancelAnimationFrame(state.detectLoopId);
  state.detectLoopId = 0;
  if (state.camStream) { state.camStream.getTracks().forEach((t) => t.stop()); state.camStream = null; }
  if (state.camVideo) { state.camVideo.pause(); state.camVideo.remove(); state.camVideo = null; }
  if (state.camCanvas) { state.camCanvas.remove(); state.camCanvas = null; state.camCtx = null; }
}

function ensureZoomPanel() {
  let panel = document.getElementById("etZoomPanel");
  if (panel) { panel.style.display = "block"; return; }
  panel = document.createElement("div");
  panel.id = "etZoomPanel";
  panel.className = "et-zoom-panel";
  panel.innerHTML =
    `<div class="et-nudge-label">Camera zoom <span id="etZoomVal">${state.zoom.toFixed(1)}x</span></div>` +
    `<input type="range" id="etZoomSlider" min="1" max="3" step="0.1" value="${state.zoom}">`;
  document.body.appendChild(panel);
  panel.style.display = "block";
  (document.getElementById("etZoomSlider") as HTMLInputElement).oninput = (e) => {
    state.zoom = parseFloat((e.target as HTMLInputElement).value);
    document.getElementById("etZoomVal")!.textContent = state.zoom.toFixed(1) + "x";
  };
}

function showTrackingWarning() {
  if (document.getElementById("etGazeWarning")) return;
  const warn = document.createElement("div");
  warn.id = "etGazeWarning";
  warn.className = "et-gaze-warning";
  warn.innerHTML =
    "No gaze data received yet. Make sure your face is well-lit and centered in the preview, " +
    'then try resetting zoom. <button id="etGazeWarnRetry">Reset zoom to 1x</button>';
  document.body.appendChild(warn);
  document.getElementById("etGazeWarnRetry")!.onclick = () => {
    state.zoom = 1;
    const slider = document.getElementById("etZoomSlider") as HTMLInputElement | null;
    if (slider) slider.value = "1";
    const val = document.getElementById("etZoomVal");
    if (val) val.textContent = "1.0x";
    warn.remove();
  };
}

function startCalibration() {
  state.calibrating = true;
  setStatus("calibrating");
  startOffsetCalibration();
}

function ensureCalibOverlay() {
  let overlay = document.getElementById("etCalibOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "etCalibOverlay";
    overlay.className = "et-calib-overlay";
    document.body.appendChild(overlay);
  }
  return overlay;
}

function startOffsetCalibration() {
  state.offsetIdx = 0;
  state.offsetClicks = 0;
  state.offsetPointSamples = [];
  state.offsetSamples = [];
  renderOffsetDot();
}
function renderOffsetDot() {
  const overlay = ensureCalibOverlay();
  const rect = contentRect();
  const p = OFFSET_POSITIONS[state.offsetIdx];
  const x = rect.left + (rect.width * p[0]) / 100;
  const y = rect.top + (rect.height * p[1]) / 100;
  const remaining = OFFSET_CLICKS_NEEDED - state.offsetClicks;
  overlay.innerHTML =
    `<div class="et-calib-hint">Look directly at the crosshair, then click it ${OFFSET_CLICKS_NEEDED} times. (${
      state.offsetIdx + 1
    } / ${OFFSET_POSITIONS.length})</div>` +
    `<div class="et-calib-dot et-offset-dot" id="etOffsetDot" style="left:${x}px; top:${y}px;">${remaining}</div>`;
  document.getElementById("etOffsetDot")!.onclick = () => {
    if (state.smoothed) state.offsetPointSamples.push({ x: state.smoothed.x, y: state.smoothed.y });
    state.offsetClicks++;
    if (state.offsetClicks < OFFSET_CLICKS_NEEDED) { renderOffsetDot(); return; }
    if (state.offsetPointSamples.length) {
      const rawX = state.offsetPointSamples.reduce((s, v) => s + v.x, 0) / state.offsetPointSamples.length;
      const rawY = state.offsetPointSamples.reduce((s, v) => s + v.y, 0) / state.offsetPointSamples.length;
      state.offsetSamples.push({ rawX, rawY, targetX: x, targetY: y });
    }
    state.offsetClicks = 0;
    state.offsetPointSamples = [];
    state.offsetIdx++;
    if (state.offsetIdx < OFFSET_POSITIONS.length) renderOffsetDot();
    else finishOffsetCalibration();
  };
}

function linearFit(pairs: { raw: number; target: number }[]) {
  const n = pairs.length;
  const meanRaw = pairs.reduce((s, p) => s + p.raw, 0) / n;
  const meanTarget = pairs.reduce((s, p) => s + p.target, 0) / n;
  let num = 0, den = 0;
  for (const p of pairs) { num += (p.raw - meanRaw) * (p.target - meanTarget); den += (p.raw - meanRaw) ** 2; }
  const a = den > 1e-6 ? num / den : 1;
  const b = meanTarget - a * meanRaw;
  return { a, b };
}
function computeCalibFromSamples(
  samples: { rawX: number; rawY: number; targetX: number; targetY: number }[],
): Calib | null {
  if (samples.length >= 2) {
    const pairsX = samples.map((s) => ({ raw: s.rawX, target: s.targetX }));
    const pairsY = samples.map((s) => ({ raw: s.rawY, target: s.targetY }));
    const spread = (pairs: { raw: number; target: number }[]) => {
      const mean = pairs.reduce((s, p) => s + p.raw, 0) / pairs.length;
      return Math.sqrt(pairs.reduce((s, p) => s + (p.raw - mean) ** 2, 0) / pairs.length);
    };
    if (spread(pairsX) < 3 || spread(pairsY) < 3) return null;
    const fitX = linearFit(pairsX);
    const fitY = linearFit(pairsY);
    return { ax: fitX.a, ay: fitY.a, bx: fitX.b, by: fitY.b };
  }
  if (samples.length === 1) {
    const s = samples[0];
    return { ax: 1, ay: 1, bx: s.targetX - s.rawX, by: s.targetY - s.rawY };
  }
  return null;
}
function finishOffsetCalibration() {
  const fit = computeCalibFromSamples(state.offsetSamples);
  if (fit) { state.calib = fit; state.calibBase = { ...fit }; }
  startDenseCalibration();
}

function denseGridPositions(): [number, number][] {
  const positions: [number, number][] = [];
  for (let r = 0; r < DENSE_GRID_ROWS; r++) {
    for (let c = 0; c < DENSE_GRID_COLS; c++) {
      positions.push([4 + (92 * c) / (DENSE_GRID_COLS - 1), 6 + (88 * r) / (DENSE_GRID_ROWS - 1)]);
    }
  }
  return positions;
}
function startDenseCalibration() {
  state.denseConfirmed = 0;
  state.denseUsedDots = new Set();
  state.denseSamples = [];
  state.denseCapturing = false;
  renderDenseGrid();
}
function renderDenseGrid() {
  const overlay = ensureCalibOverlay();
  overlay.classList.remove("et-capturing");
  const rect = contentRect();
  const positions = denseGridPositions();
  const dotsHtml = positions
    .map((p, i) => {
      const x = rect.left + (rect.width * p[0]) / 100;
      const y = rect.top + (rect.height * p[1]) / 100;
      const done = state.denseUsedDots.has(i);
      return `<div class="et-dense-dot${done ? " et-done" : ""}" data-idx="${i}" style="left:${x}px; top:${y}px;"></div>`;
    })
    .join("");
  overlay.innerHTML =
    `<div class="et-calib-hint">Look at any dot, click it, then keep looking at it for a couple seconds. (${state.denseConfirmed} / ${DENSE_ROUNDS} done)</div>` +
    dotsHtml;
  overlay.querySelectorAll(".et-dense-dot:not(.et-done)").forEach((el) => {
    (el as HTMLElement).onclick = () => denseDotClicked(parseInt((el as HTMLElement).dataset.idx!, 10), el as HTMLElement);
  });
}
function denseDotClicked(idx: number, el: HTMLElement) {
  if (state.denseCapturing || state.denseUsedDots.has(idx)) return;
  state.denseCapturing = true;
  ensureCalibOverlay().classList.add("et-capturing");
  el.classList.add("et-capturing");
  const rect = el.getBoundingClientRect();
  const targetX = rect.left + rect.width / 2, targetY = rect.top + rect.height / 2;
  const clickTime = performance.now();
  const preSamples = state.gazeHistory
    .filter((s) => clickTime - s.t <= DENSE_PRE_WINDOW_MS)
    .map((s) => ({ x: s.x, y: s.y }));
  const postSamples: Point[] = [];
  function postTick() {
    if (!state.calibrating) return;
    const now = performance.now();
    if (state.smoothed) postSamples.push({ x: state.smoothed.x, y: state.smoothed.y });
    if (now - clickTime >= DENSE_POST_WINDOW_MS) {
      finalizeDenseDot(idx, targetX, targetY, preSamples.concat(postSamples));
      return;
    }
    state.denseCaptureLoopId = requestAnimationFrame(postTick);
  }
  state.denseCaptureLoopId = requestAnimationFrame(postTick);
}
function finalizeDenseDot(idx: number, targetX: number, targetY: number, samples: Point[]) {
  if (samples.length) {
    const rawX = samples.reduce((s, v) => s + v.x, 0) / samples.length;
    const rawY = samples.reduce((s, v) => s + v.y, 0) / samples.length;
    state.denseSamples.push({ rawX, rawY, targetX, targetY });
  }
  state.denseUsedDots.add(idx);
  state.denseConfirmed++;
  state.denseCapturing = false;
  if (state.denseConfirmed >= DENSE_ROUNDS) finishDenseCalibration();
  else renderDenseGrid();
}
function finishDenseCalibration() {
  const combined = state.offsetSamples.concat(state.denseSamples);
  const fit = computeCalibFromSamples(combined);
  if (fit) { state.calib = fit; state.calibBase = { ...fit }; }
  activateTracking();
}

function activateTracking() {
  state.calibrating = false;
  document.getElementById("etCalibOverlay")?.remove();
  state.active = true;
  let cursor = document.getElementById("etGazeCursor") as HTMLElement | null;
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.id = "etGazeCursor";
    cursor.className = "et-gaze-cursor";
    document.body.appendChild(cursor);
  }
  cursor.style.display = "block";
  ensureNudgePanel();
  setStatus("on");
  startDwellLoop();
}

function ensureNudgePanel() {
  let panel = document.getElementById("etNudgePanel");
  if (panel) { panel.style.display = "block"; return; }
  panel = document.createElement("div");
  panel.id = "etNudgePanel";
  panel.className = "et-nudge-panel";
  panel.innerHTML =
    `<div class="et-nudge-label">Aim correction</div>` +
    `<div class="et-nudge-grid">` +
    `<span></span><button data-dx="0" data-dy="-${NUDGE_STEP}">▲</button><span></span>` +
    `<button data-dx="-${NUDGE_STEP}" data-dy="0">◀</button><button id="etNudgeReset">↺</button><button data-dx="${NUDGE_STEP}" data-dy="0">▶</button>` +
    `<span></span><button data-dx="0" data-dy="${NUDGE_STEP}">▼</button><span></span>` +
    `</div>`;
  document.body.appendChild(panel);
  panel.style.display = "block";
  panel.querySelectorAll("button[data-dx]").forEach((btn) => {
    (btn as HTMLElement).onclick = () => {
      state.calib.bx += parseFloat((btn as HTMLElement).dataset.dx!);
      state.calib.by += parseFloat((btn as HTMLElement).dataset.dy!);
    };
  });
  document.getElementById("etNudgeReset")!.onclick = () => { state.calib = { ...state.calibBase }; };
}

function applyCalib(x: number, y: number) {
  const c = state.calib;
  return { x: c.ax * x + c.bx, y: c.ay * y + c.by };
}

function onGaze(x: number, y: number) {
  if (state.watchdogTimer) { clearTimeout(state.watchdogTimer); state.watchdogTimer = 0; }
  document.getElementById("etGazeWarning")?.remove();
  state.lastGazeAt = performance.now();
  state.faceLost = false;
  if (!state.smoothed) { state.smoothed = { x, y }; return; }
  state.smoothed = {
    x: state.smoothed.x + GAZE_EMA_ALPHA * (x - state.smoothed.x),
    y: state.smoothed.y + GAZE_EMA_ALPHA * (y - state.smoothed.y),
  };
  const now = performance.now();
  state.gazeHistory.push({ x: state.smoothed.x, y: state.smoothed.y, t: now });
  const cutoff = now - DENSE_PRE_WINDOW_MS;
  while (state.gazeHistory.length && state.gazeHistory[0].t < cutoff) state.gazeHistory.shift();
}

function startDwellLoop() {
  function tick() {
    if (!state.active) return;
    const cursor = document.getElementById("etGazeCursor");
    const lostNow = performance.now() - state.lastGazeAt > FACE_LOST_MS;
    if (lostNow !== state.faceLost) {
      state.faceLost = lostNow;
      cursor?.classList.toggle("et-gaze-lost", lostNow);
      if (lostNow) {
        console.debug("[eye-track] face lost, cursor holding last known position");
        clearDwellVisual();
        state.dwellEl = null;
      }
    }
    if (state.smoothed && cursor) {
      const corrected = applyCalib(state.smoothed.x, state.smoothed.y);
      const gx = Math.max(0, Math.min(window.innerWidth - 1, corrected.x));
      const gy = Math.max(0, Math.min(window.innerHeight - 1, corrected.y));
      cursor.style.left = gx + "px";
      cursor.style.top = gy + "px";
      if (!lostNow) {
        handleEdgeScroll(gy);
        const el = document.elementFromPoint(gx, gy);
        handleDwellTarget(isEyeTrackClickable(el));
      }
    }
    state.loopId = requestAnimationFrame(tick);
  }
  state.loopId = requestAnimationFrame(tick);
}

function clearDwellVisual() {
  if (state.visualEl) {
    state.visualEl.classList.remove("et-gaze-hover");
    state.visualEl = null;
  }
}
function handleDwellTarget(el: HTMLElement | null) {
  if (el === state.dwellEl) return;
  clearDwellVisual();
  state.dwellEl = el;
  if (el && performance.now() >= state.cooldownUntil) { el.classList.add("et-gaze-hover"); state.visualEl = el; }
}

function checkBlinkClick(blendshapes: any, now: number) {
  if (now < state.clickGestureCooldownUntil) return;
  const cats = blendshapes?.[0]?.categories as { categoryName: string; score: number }[] | undefined;
  if (!cats) {
    if (!blinkDiagnosticLogged && blendshapes !== undefined) {
      blinkDiagnosticLogged = true;
      console.warn("[eye-track] no faceBlendshapes in detection result. Got:", blendshapes);
    }
    state.winkStartTime = 0;
    state.bothClosedStartTime = 0;
    return;
  }
  const leftCat = cats.find((c) => c.categoryName === "eyeBlinkLeft");
  const rightCat = cats.find((c) => c.categoryName === "eyeBlinkRight");
  if (!blinkDiagnosticLogged && (!leftCat || !rightCat)) {
    blinkDiagnosticLogged = true;
    console.warn(
      "[eye-track] blendshapes present but eyeBlinkLeft/eyeBlinkRight not found. Available categories:",
      cats.map((c) => c.categoryName),
    );
  }
  const left = leftCat?.score ?? 0;
  const right = rightCat?.score ?? 0;
  const isWink = Math.abs(left - right) > WINK_ASYMMETRY_MIN && Math.max(left, right) > BLINK_SCORE_THRESHOLD;
  const bothClosed = left > BLINK_SCORE_THRESHOLD && right > BLINK_SCORE_THRESHOLD;

  if (isWink) {
    if (!state.winkStartTime) state.winkStartTime = now;
    if (now - state.winkStartTime >= WINK_CONFIRM_MS) { fireClickGesture(now); return; }
  } else {
    state.winkStartTime = 0;
  }
  if (bothClosed) {
    if (!state.bothClosedStartTime) state.bothClosedStartTime = now;
    if (now - state.bothClosedStartTime >= LONG_BLINK_MS) { fireClickGesture(now); return; }
  } else {
    state.bothClosedStartTime = 0;
  }
}
function fireClickGesture(now: number) {
  state.clickGestureCooldownUntil = now + CLICK_GESTURE_COOLDOWN_MS;
  state.winkStartTime = 0;
  state.bothClosedStartTime = 0;
  if (!state.dwellEl) return;
  state.dwellEl.click();
  clearDwellVisual();
  state.dwellEl = null;
  state.cooldownUntil = now + 900;
  const cursor = document.getElementById("etGazeCursor");
  if (cursor) {
    cursor.classList.remove("et-blink-flash");
    void (cursor as HTMLElement).offsetWidth;
    cursor.classList.add("et-blink-flash");
    setTimeout(() => cursor.classList.remove("et-blink-flash"), 260);
  }
}

function handleEdgeScroll(y: number) {
  const nearBottom = y >= window.innerHeight - 1 - SCROLL_EDGE_ZONE_PX;
  const nearTop = y <= SCROLL_EDGE_ZONE_PX;
  if (nearBottom) {
    window.scrollBy(0, SCROLL_EDGE_SPEED);
    showScrollEdgeIndicator("bottom");
  } else if (nearTop) {
    window.scrollBy(0, -SCROLL_EDGE_SPEED);
    showScrollEdgeIndicator("top");
  } else {
    showScrollEdgeIndicator(null);
  }
}
function ensureScrollEdgeIndicators() {
  if (document.getElementById("etScrollEdgeTop")) return;
  const top = document.createElement("div");
  top.id = "etScrollEdgeTop";
  top.className = "et-scroll-edge-indicator et-top";
  const bottom = document.createElement("div");
  bottom.id = "etScrollEdgeBottom";
  bottom.className = "et-scroll-edge-indicator et-bottom";
  document.body.appendChild(top);
  document.body.appendChild(bottom);
}
function showScrollEdgeIndicator(which: "top" | "bottom" | null) {
  ensureScrollEdgeIndicators();
  document.getElementById("etScrollEdgeTop")!.classList.toggle("et-active", which === "top");
  document.getElementById("etScrollEdgeBottom")!.classList.toggle("et-active", which === "bottom");
}
