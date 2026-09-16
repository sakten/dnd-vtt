import type { Wall } from 'shared';
import { chainSegments, marchingSquares, simplify } from './contour';

export interface AnnotateParams {
  /** Порог яркости для «тёмной породы». */
  threshold?: number;
  /** Минимальный размер компоненты (после заливки дыр), px. */
  minSize?: number;
  /** Минимальная длина сегмента после упрощения, px. */
  minLen?: number;
  /** Допуск упрощения, px. */
  simplify?: number;
}

export interface AnnotateResult {
  walls: Wall[];
  /** Итоговая маска породы (1 — скала), для оверлея. */
  mask: Uint8Array;
  components: number;
  kept: number;
}

let idSeq = 0;

/** Заливка дыр: всё, что не связано с краем изображения через фон, — порода. */
function fillHoles(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(mask);
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (!out[p] && !outside[p]) {
      outside[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  for (let i = 0; i < out.length; i++) if (!out[i] && !outside[i]) out[i] = 1;
  return out;
}

/** Убирает мелкие компоненты (мусор) из маски. */
function dropSmallComponents(mask: Uint8Array, w: number, h: number, minSize: number): { out: Uint8Array; components: number; kept: number } {
  const labels = new Int32Array(w * h);
  const out = new Uint8Array(w * h);
  const stack: number[] = [];
  let components = 0;
  let kept = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    components++;
    labels[start] = components;
    stack.length = 0;
    stack.push(start);
    const pixels: number[] = [];
    while (stack.length) {
      const p = stack.pop()!;
      pixels.push(p);
      const x = p % w;
      const y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = yy * w + xx;
          if (mask[q] && !labels[q]) {
            labels[q] = components;
            stack.push(q);
          }
        }
      }
    }
    if (pixels.length >= minSize) {
      kept++;
      for (const p of pixels) out[p] = 1;
    }
  }
  return { out, components, kept };
}

/**
 * Разметка органической карты: тёмная порода → заливка дыр → удаление мусора →
 * внешние границы (marching squares) → полилинии → сегменты стен.
 */
export function annotateWalls(data: Uint8ClampedArray, width: number, height: number, params: AnnotateParams = {}): AnnotateResult {
  const threshold = params.threshold ?? 70;
  const minSize = params.minSize ?? 1500;
  const minLen = params.minLen ?? 40;
  const tol = params.simplify ?? 3;
  if (width < 16 || height < 16) return { walls: [], mask: new Uint8Array(0), components: 0, kept: 0 };

  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = (data[p]! * 0.299 + data[p + 1]! * 0.587 + data[p + 2]! * 0.114) | 0;
  }
  const dark = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) dark[i] = gray[i]! < threshold ? 1 : 0;

  const filled = fillHoles(dark, width, height);
  const { out: mask, components, kept } = dropSmallComponents(filled, width, height, minSize);

  const segs = marchingSquares(mask, width, height);
  const paths = chainSegments(segs);
  const walls: Wall[] = [];
  for (const path of paths) {
    const pts = simplify(path, tol);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) < minLen) continue;
      walls.push({ id: `an-${++idSeq}`, kind: 'wall', x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }
  return { walls, mask, components, kept };
}
