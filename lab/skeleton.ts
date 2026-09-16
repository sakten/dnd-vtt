import type { Wall } from 'shared';

export interface SkeletonParams {
  size: number;
  offsetX: number;
  offsetY: number;
  /** Порог бинаризации (0..255); если не задан — Otsu. */
  threshold?: number;
  /** Минимальная длина сегмента в клетках. */
  minCells?: number;
  /** Допуск упрощения полилинии, px. */
  simplify?: number;
}

let idSeq = 0;
const nextId = () => `sk-${++idSeq}`;

function lumaArray(data: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(data.length / 4);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (data[p]! * 0.299 + data[p + 1]! * 0.587 + data[p + 2]! * 0.114) | 0;
  }
  return out;
}

function otsu(gray: Uint8Array): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]!] = (hist[gray[i]!] ?? 0) + 1;
  let total = 0;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    total += hist[i]!;
    sum += i * hist[i]!;
  }
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let maxVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      best = t;
    }
  }
  return best;
}

function closeMask(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const dil = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let dy = -r; dy <= r && !v; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          if (mask[yy * w + xx]) {
            v = 1;
            break;
          }
        }
      }
      dil[y * w + x] = v;
    }
  }
  const ero = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let dy = -r; dy <= r && v; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          if (!dil[yy * w + xx]) {
            v = 0;
            break;
          }
        }
      }
      ero[y * w + x] = v;
    }
  }
  return ero;
}

/** Скелет бинарной маски (Zhang-Suen). */
export function skeletonize(mask: Uint8Array, w: number, h: number): Uint8Array {
  const img = new Uint8Array(mask);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x]!);
  let changed = true;
  const toRemove: number[] = [];
  while (changed) {
    changed = false;
    for (const step of [0, 1]) {
      toRemove.length = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!at(x, y)) continue;
          const p2 = at(x, y - 1);
          const p3 = at(x + 1, y - 1);
          const p4 = at(x + 1, y);
          const p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1);
          const p7 = at(x - 1, y + 1);
          const p8 = at(x - 1, y);
          const p9 = at(x - 1, y - 1);
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let i = 0; i < 8; i++) if (seq[i] === 0 && seq[i + 1] === 1) a++;
          if (a !== 1) continue;
          if (step === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }
          toRemove.push(y * w + x);
        }
      }
      if (toRemove.length) {
        changed = true;
        for (const i of toRemove) img[i] = 0;
      }
    }
  }
  return img;
}

interface Pt {
  x: number;
  y: number;
}

export function tracePolylines(skel: Uint8Array, w: number, h: number): Pt[][] {
  const visited = new Uint8Array(w * h);
  const neighbors = (x: number, y: number): Pt[] => {
    const out: Pt[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        if (skel[yy * w + xx]) out.push({ x: xx, y: yy });
      }
    }
    return out;
  };
  const degree = (x: number, y: number) => neighbors(x, y).length;

  const walk = (start: Pt): Pt[] => {
    const path: Pt[] = [start];
    visited[start.y * w + start.x] = 1;
    let cur = start;
    for (;;) {
      const next = neighbors(cur.x, cur.y).filter((p) => !visited[p.y * w + p.x]);
      if (next.length === 0) break;
      // при ветвлении идём в первого невизитанного; остальные останутся для других проходов
      const step = next[0]!;
      path.push(step);
      visited[step.y * w + step.x] = 1;
      if (degree(step.x, step.y) > 2) break;
      cur = step;
    }
    return path;
  };

  const paths: Pt[][] = [];
  // Сначала от концов (степень 1).
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!skel[y * w + x] || visited[y * w + x]) continue;
      if (degree(x, y) === 1) {
        const path = walk({ x, y });
        if (path.length > 2) paths.push(path);
      }
    }
  }
  // Затем оставшиеся (петли/ветки).
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!skel[y * w + x] || visited[y * w + x]) continue;
      const path = walk({ x, y });
      if (path.length > 2) paths.push(path);
    }
  }
  return paths;
}

export function simplify(points: Pt[], tol: number): Pt[] {
  if (points.length < 3) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let maxDist = -1;
  let index = -1;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const len = Math.hypot(dx, dy);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const d = len === 0 ? Math.hypot(p.x - first.x, p.y - first.y) : Math.abs(dy * p.x - dx * p.y + last.x * first.y - last.y * first.x) / len;
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= tol || index < 0) return [first, last];
  const left = simplify(points.slice(0, index + 1), tol);
  const right = simplify(points.slice(index), tol);
  return [...left.slice(0, -1), ...right];
}

/**
 * D: скелет тёмных линий. Бинаризация (Otsu) → закрытие → скелет → полилинии →
 * упрощение (Дуглас–Пекер) → снап концов к узлам сетки.
 */
export function detectWallsSkeleton(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: SkeletonParams
): Wall[] {
  const { size, offsetX, offsetY } = params;
  if (!Number.isFinite(size) || size < 10) return [];
  const minLen = (params.minCells ?? 1) * size * 0.7;
  const tol = params.simplify ?? 3;

  const gray = lumaArray(data);
  const threshold = params.threshold ?? otsu(gray);
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) mask[i] = gray[i]! < threshold ? 1 : 0;

  const closed = closeMask(mask, width, height, 2);
  const skel = skeletonize(closed, width, height);
  const paths = tracePolylines(skel, width, height);

  const snap = (v: number, offset: number) => {
    const node = Math.round((v - offset) / size) * size + offset;
    return Math.abs(node - v) <= size * 0.4 ? node : v;
  };

  const walls: Wall[] = [];
  for (const path of paths) {
    const pts = simplify(path, tol);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < minLen) continue;
      walls.push({
        id: nextId(),
        kind: 'wall',
        x1: snap(a.x, offsetX),
        y1: snap(a.y, offsetY),
        x2: snap(b.x, offsetX),
        y2: snap(b.y, offsetY),
      });
    }
  }
  return walls.slice(0, 2000);
}
