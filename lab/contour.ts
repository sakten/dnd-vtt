import type { Wall } from 'shared';

export interface ContourParams {
  /** Отступ адаптивного порога от локального среднего (больше — меньше «скал»). */
  c?: number;
  /** Окно локального среднего, px. */
  window?: number;
  /** Минимальная длина контура после упрощения, px. */
  minLen?: number;
  /** Допуск упрощения полилинии, px. */
  simplify?: number;
}

let idSeq = 0;
const nextId = () => `ct-${++idSeq}`;

function lumaArray(data: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(data.length / 4);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (data[p]! * 0.299 + data[p + 1]! * 0.587 + data[p + 2]! * 0.114) | 0;
  }
  return out;
}

/** Маска «тёмное» по адаптивному порогу (интегральное изображение). */
function darkMaskAdaptive(gray: Uint8Array, w: number, h: number, window: number, c: number): Uint8Array {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x]!;
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)]! + rowSum;
    }
  }
  const r = Math.max(1, window >> 1);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const area = (y1 - y0 + 1) * (x1 - x0 + 1);
      const sum =
        integral[(y1 + 1) * (w + 1) + (x1 + 1)]! -
        integral[y0 * (w + 1) + (x1 + 1)]! -
        integral[(y1 + 1) * (w + 1) + x0]! +
        integral[y0 * (w + 1) + x0]!;
      out[y * w + x] = gray[y * w + x]! < sum / area - c ? 1 : 0;
    }
  }
  return out;
}

/** Открытие (эрозия+дилатация) квадратом радиуса r. */
function open(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask;
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
          if (!mask[yy * w + xx]) {
            v = 0;
            break;
          }
        }
      }
      ero[y * w + x] = v;
    }
  }
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
          if (ero[yy * w + xx]) {
            v = 1;
            break;
          }
        }
      }
      dil[y * w + x] = v;
    }
  }
  return dil;
}

interface Pt {
  x: number;
  y: number;
}

/** Контуры методом marching squares: сегменты между серединами рёбер блоков 2×2. */
export function marchingSquares(mask: Uint8Array, w: number, h: number): [Pt, Pt][] {
  const segs: [Pt, Pt][] = [];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]!);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const tl = at(x, y);
      const tr = at(x + 1, y);
      const br = at(x + 1, y + 1);
      const bl = at(x, y + 1);
      const code = tl | (tr << 1) | (br << 2) | (bl << 3);
      if (code === 0 || code === 15) continue;
      const top = { x: x + 0.5, y };
      const right = { x: x + 1, y: y + 0.5 };
      const bottom = { x: x + 0.5, y: y + 1 };
      const left = { x, y: y + 0.5 };
      switch (code) {
        case 1:
        case 14:
          segs.push([left, top]);
          break;
        case 2:
        case 13:
          segs.push([top, right]);
          break;
        case 3:
        case 12:
          segs.push([left, right]);
          break;
        case 4:
        case 11:
          segs.push([right, bottom]);
          break;
        case 6:
        case 9:
          segs.push([top, bottom]);
          break;
        case 7:
        case 8:
          segs.push([left, bottom]);
          break;
        case 5:
          segs.push([left, top], [right, bottom]);
          break;
        case 10:
          segs.push([left, bottom], [top, right]);
          break;
      }
    }
  }
  return segs;
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
    const d =
      len === 0
        ? Math.hypot(p.x - first.x, p.y - first.y)
        : Math.abs(dy * p.x - dx * p.y + last.x * first.y - last.y * first.x) / len;
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= tol || index < 0) return [first, last];
  const leftPart = simplify(points.slice(0, index + 1), tol);
  const rightPart = simplify(points.slice(index), tol);
  return [...leftPart.slice(0, -1), ...rightPart];
}

/** Сшивка сегментов контуров в полилинии. */
export function chainSegments(segs: [Pt, Pt][]): Pt[][] {
  const key = (p: Pt) => `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;
  const adj = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const p of s) {
      const k = key(p);
      const list = adj.get(k);
      if (list) list.push(i);
      else adj.set(k, [i]);
    }
  });
  const used = new Uint8Array(segs.length);
  const paths: Pt[][] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const seg = segs[i]!;
    const path: Pt[] = [seg[0], seg[1]];
    // продолжаем в обе стороны
    for (const dir of [1, -1] as const) {
      for (;;) {
        const end = dir === 1 ? path[path.length - 1]! : path[0]!;
        const candidates = adj.get(key(end)) ?? [];
        let next = -1;
        for (const ci of candidates) if (!used[ci]) { next = ci; break; }
        if (next < 0) break;
        used[next] = 1;
        const s = segs[next]!;
        const other = key(s[0]) === key(end) ? s[1] : s[0];
        if (dir === 1) path.push(other);
        else path.unshift(other);
      }
    }
    if (path.length >= 2) paths.push(path);
  }
  return paths;
}

/**
 * C: контуры «скал» для органических карт (пещеры). Тёмные области (адаптивный
 * порог + открытие) → контуры marching squares → полилинии → упрощение.
 * Стены — произвольные отрезки, сетка не нужна.
 */
export function detectWallsContour(data: Uint8ClampedArray, width: number, height: number, params: ContourParams = {}): Wall[] {
  const c = params.c ?? 12;
  const window = params.window ?? 31;
  const minLen = params.minLen ?? 60;
  const tol = params.simplify ?? 4;
  if (width < 16 || height < 16) return [];

  const gray = lumaArray(data);
  const mask = open(darkMaskAdaptive(gray, width, height, window, c), width, height, 2);
  const segs = marchingSquares(mask, width, height);
  const paths = chainSegments(segs);

  const walls: Wall[] = [];
  for (const path of paths) {
    const pts = simplify(path, tol);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) < minLen) continue;
      walls.push({ id: nextId(), kind: 'wall', x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }
  return walls.slice(0, 2000);
}
