import type { Wall, WallKind } from 'shared';

export interface LocalParams {
  size: number;
  offsetX: number;
  offsetY: number;
  /** Минимальная разница яркости «пол ↔ линия» по модулю, считаем стеной. */
  contrast?: number;
  /** Доля позиций вдоль ребра, где контраст превышен. */
  ratio?: number;
  /** Полуширина поиска в стороны от линии сетки, px. */
  band?: number;
  /** Пропуск вокруг самой линии сетки, px. */
  skip?: number;
  /** Отступ от края клетки при выборке «пола», px. */
  margin?: number;
  /** Требуемая толщина линии стены (подряд идущие смещения), px. */
  minThickness?: number;
}

const MAX_WALLS = 2000;

function lumaArray(data: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(data.length / 4);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (data[p]! * 0.299 + data[p + 1]! * 0.587 + data[p + 2]! * 0.114) | 0;
  }
  return out;
}

function median(values: number[]): number {
  if (!values.length) return 255;
  values.sort((a, b) => a - b);
  return values[values.length >> 1]!;
}

/** Медианная яркость «пола» внутри клетки (без краёв). */
function cellFloor(
  luma: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  margin: number,
  out: number[]
): void {
  const mx0 = Math.min(x1, Math.max(0, x0 + margin));
  const mx1 = Math.min(width, Math.max(mx0 + 1, x1 - margin));
  const my0 = Math.min(height, Math.max(0, y0 + margin));
  const my1 = Math.min(height, Math.max(my0 + 1, y1 - margin));
  const stepX = Math.max(1, Math.floor((mx1 - mx0) / 8));
  const stepY = Math.max(1, Math.floor((my1 - my0) / 8));
  for (let y = my0; y < my1; y += stepY) {
    for (let x = mx0; x < mx1; x += stepX) out.push(luma[y * width + x]!);
  }
}

/** Максимальная толщина полосы с контрастом ≥ порога (в стороне от линии сетки). */
function bandThickness(
  luma: Uint8Array,
  width: number,
  height: number,
  vertical: boolean,
  line: number,
  at: number,
  floor: number,
  band: number,
  skip: number,
  contrast: number
): number {
  let best = 0;
  let run = 0;
  for (let d = -band; d <= band; d++) {
    if (Math.abs(d) <= skip) {
      run = 0;
      continue;
    }
    const px = vertical ? line + d : at;
    const py = vertical ? at : line + d;
    if (px < 0 || py < 0 || px >= width || py >= height) {
      run = 0;
      continue;
    }
    if (Math.abs(luma[py * width + px]! - floor) >= contrast) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

function runLen(flags: boolean[], from: number, dir: 1 | -1): number {
  let len = 0;
  for (let i = from; i >= 0 && i < flags.length && flags[i]; i += dir) len++;
  return len;
}

function pushRuns(walls: Wall[], flags: boolean[], make: (a0: number, a1: number, kind: WallKind) => Wall): void {
  const n = flags.length;
  let i = 0;
  while (i < n) {
    if (!flags[i]) {
      i++;
      continue;
    }
    const start = i;
    while (i < n && flags[i]) i++;
    walls.push(make(start, i - 1, 'wall'));
  }
  for (let j = 1; j < n - 1; j++) {
    if (flags[j] || !flags[j - 1] || !flags[j + 1]) continue;
    if (runLen(flags, j - 1, -1) >= 2 && runLen(flags, j + 1, 1) >= 2) walls.push(make(j, j, 'door'));
  }
}

let idSeq = 0;
const nextId = () => `lab-${++idSeq}`;

/**
 * A++: локальный контраст по модулю (ловит и светлые, и тёмные стены).
 * Для каждого ребра: пол = медиана яркости внутри обеих клеток; стена там,
 * где вдоль линии (в стороне от нарисованной линии сетки) идёт полоса
 * контрастной яркости толщиной не меньше `minThickness`.
 */
export function detectWallsLocal(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: LocalParams
): Wall[] {
  const { size, offsetX, offsetY } = params;
  const contrast = params.contrast ?? 60;
  const ratio = params.ratio ?? 0.5;
  const band = params.band ?? 10;
  const skip = params.skip ?? 2;
  const margin = params.margin ?? 6;
  const minThickness = params.minThickness ?? 3;
  if (!Number.isFinite(size) || size < 10 || width < 16 || height < 16) return [];

  const luma = lumaArray(data);
  const cols = Math.floor((width - offsetX) / size);
  const rows = Math.floor((height - offsetY) / size);
  if (cols < 1 || rows < 1) return [];

  const walls: Wall[] = [];

  // Вертикальные линии.
  for (let c = 0; c <= cols; c++) {
    const x = Math.round(offsetX + c * size);
    const flags: boolean[] = [];
    for (let r = 0; r < rows; r++) {
      const y0 = Math.max(0, Math.round(offsetY + r * size));
      const y1 = Math.min(height, Math.round(offsetY + (r + 1) * size));
      const samples: number[] = [];
      if (c > 0) cellFloor(luma, width, height, Math.round(offsetX + (c - 1) * size), y0, x, y1, margin, samples);
      if (c < cols) cellFloor(luma, width, height, x, y0, Math.round(offsetX + (c + 1) * size), y1, margin, samples);
      const floor = median(samples);
      let hits = 0;
      let total = 0;
      for (let a = y0; a < y1; a++) {
        total++;
        if (bandThickness(luma, width, height, true, x, a, floor, band, skip, contrast) >= minThickness) hits++;
      }
      flags.push(total > 0 && hits / total >= ratio);
    }
    pushRuns(walls, flags, (r0, r1, kind) => ({
      id: nextId(),
      kind,
      x1: offsetX + c * size,
      y1: offsetY + r0 * size,
      x2: offsetX + c * size,
      y2: offsetY + (r1 + 1) * size,
    }));
  }

  // Горизонтальные линии.
  for (let r = 0; r <= rows; r++) {
    const y = Math.round(offsetY + r * size);
    const flags: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      const x0 = Math.max(0, Math.round(offsetX + c * size));
      const x1 = Math.min(width, Math.round(offsetX + (c + 1) * size));
      const samples: number[] = [];
      if (r > 0) cellFloor(luma, width, height, x0, Math.round(offsetY + (r - 1) * size), x1, y, margin, samples);
      if (r < rows) cellFloor(luma, width, height, x0, y, x1, Math.round(offsetY + (r + 1) * size), margin, samples);
      const floor = median(samples);
      let hits = 0;
      let total = 0;
      for (let a = x0; a < x1; a++) {
        total++;
        if (bandThickness(luma, width, height, false, y, a, floor, band, skip, contrast) >= minThickness) hits++;
      }
      flags.push(total > 0 && hits / total >= ratio);
    }
    pushRuns(walls, flags, (c0, c1, kind) => ({
      id: nextId(),
      kind,
      x1: offsetX + c0 * size,
      y1: offsetY + r * size,
      x2: offsetX + (c1 + 1) * size,
      y2: offsetY + r * size,
    }));
  }

  return walls.slice(0, MAX_WALLS);
}
