// $1 Unistroke Recognizer (Wobbrock, Wilson & Li, 2007) — a small, well-known
// single-stroke gesture matcher. Resamples a raw pointer path to a fixed
// point count, normalizes rotation/scale/position, then compares against a
// set of templates using a bounded golden-section angle search (so shapes
// stay orientation-sensitive — a "^" won't match rotated 90° into a ">").

export type GesturePoint = { x: number; y: number };

const RESAMPLE_POINTS = 64;
const SQUARE_SIZE = 250;
const ANGLE_RANGE = (45 * Math.PI) / 180;
const ANGLE_PRECISION = (2 * Math.PI) / 180;
const PHI = 0.5 * (-1 + Math.sqrt(5));

function dist(a: GesturePoint, b: GesturePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLength(points: GesturePoint[]) {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += dist(points[i - 1], points[i]);
  return d;
}

function resample(points: GesturePoint[], n: number): GesturePoint[] {
  const pts = points.map((p) => ({ ...p }));
  const interval = pathLength(pts) / (n - 1);
  if (!isFinite(interval) || interval === 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  let D = 0;
  const newPoints = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (D + d >= interval) {
      const t = (interval - D) / d;
      const q = {
        x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x),
        y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y),
      };
      newPoints.push(q);
      pts.splice(i, 0, q);
      D = 0;
    } else {
      D += d;
    }
  }
  while (newPoints.length < n) newPoints.push({ ...pts[pts.length - 1] });
  return newPoints.slice(0, n);
}

function centroid(points: GesturePoint[]): GesturePoint {
  const n = points.length;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

function indicativeAngle(points: GesturePoint[]) {
  const c = centroid(points);
  return Math.atan2(c.y - points[0].y, c.x - points[0].x);
}

function rotateBy(points: GesturePoint[], angle: number): GesturePoint[] {
  const c = centroid(points);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function scaleToSquare(points: GesturePoint[], size: number): GesturePoint[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return points.map((p) => ({
    x: w === 0 ? p.x : ((p.x - minX) * size) / w,
    y: h === 0 ? p.y : ((p.y - minY) * size) / h,
  }));
}

function translateToOrigin(points: GesturePoint[]): GesturePoint[] {
  const c = centroid(points);
  return points.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
}

function normalize(points: GesturePoint[]): GesturePoint[] {
  const resampled = resample(points, RESAMPLE_POINTS);
  const angle = indicativeAngle(resampled);
  const rotated = rotateBy(resampled, -angle);
  const scaled = scaleToSquare(rotated, SQUARE_SIZE);
  return translateToOrigin(scaled);
}

function pathDistance(a: GesturePoint[], b: GesturePoint[]) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += dist(a[i], b[i]);
  return d / a.length;
}

function distanceAtAngle(points: GesturePoint[], template: GesturePoint[], angle: number) {
  return pathDistance(rotateBy(points, angle), template);
}

function distanceAtBestAngle(points: GesturePoint[], template: GesturePoint[]) {
  let a = -ANGLE_RANGE;
  let b = ANGLE_RANGE;
  let x1 = PHI * a + (1 - PHI) * b;
  let f1 = distanceAtAngle(points, template, x1);
  let x2 = (1 - PHI) * a + PHI * b;
  let f2 = distanceAtAngle(points, template, x2);
  while (Math.abs(b - a) > ANGLE_PRECISION) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = PHI * a + (1 - PHI) * b;
      f1 = distanceAtAngle(points, template, x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = (1 - PHI) * a + PHI * b;
      f2 = distanceAtAngle(points, template, x2);
    }
  }
  return Math.min(f1, f2);
}

export type GestureTemplate = {
  name: string;
  points: GesturePoint[];
};

export type CompiledTemplate = {
  name: string;
  points: GesturePoint[];
};

export function compileTemplates(templates: GestureTemplate[]): CompiledTemplate[] {
  return templates.map((t) => ({ name: t.name, points: normalize(t.points) }));
}

export function recognize(
  rawPoints: GesturePoint[],
  compiledTemplates: CompiledTemplate[],
): { name: string; score: number } | null {
  if (rawPoints.length < 2) return null;
  const candidate = normalize(rawPoints);
  const halfDiagonal = 0.5 * Math.hypot(SQUARE_SIZE, SQUARE_SIZE);
  let best: { name: string; score: number } | null = null;
  for (const template of compiledTemplates) {
    const d = distanceAtBestAngle(candidate, template.points);
    const score = 1 - d / halfDiagonal;
    if (!best || score > best.score) best = { name: template.name, score };
  }
  return best;
}
