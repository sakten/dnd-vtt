import type { Wall, WallKind } from 'shared';
import { newId } from './id';

export interface WallDetectParams {
  /** Размер клетки сетки, px. */
  size: number;
  offsetX: number;
  offsetY: number;
  /** Минимальная разница яркости «пол ↔ линия» по модулю. */
  contrast?: number;
  /** Доля позиций вдоль линии, где контраст превышен. */
  ratio?: number;
  /** Полуширина поиска в стороны от линии сетки, px. */
  band?: number;
  /** Пропуск вокруг нарисованной линии сетки, px. */
  skip?: number;
  /** Отступ от края клетки при выборке «пола», px. */
  margin?: number;
  /** Требуемая толщина линии стены (подряд идущие смещения), px. */
  minThickness?: number;
  /** Убирать «мебель»: короткие отрезки, не связанные с длинными стенами. */
  furnitureFilter?: boolean;
  /** Искать двери; выключено — разрывы остаются проходами (пещеры без дверей). */
  doors?: boolean;
}

const MAX_WALLS = 2000;
/** Минимальная длина стены (в клетках), которая считается «настоящей». */
const FURNITURE_MIN_CELLS = 3;
/** Максимальный разрыв в стене (в клетках), который становится дверью. */
const DOOR_MAX_GAP = 2;

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

/** Прогоны стен + двери: разрыв 1–2 клетки между длинными прогонами = дверь. */
function pushRuns(
  walls: Wall[],
  flags: boolean[],
  doors: boolean,
  make: (a0: number, a1: number, kind: WallKind) => Wall
): void {
  const n = flags.length;
  const runs: { start: number; end: number }[] = [];
  let i = 0;
  while (i < n) {
    if (!flags[i]) {
      i++;
      continue;
    }
    const start = i;
    while (i < n && flags[i]) i++;
    runs.push({ start, end: i - 1 });
  }
  for (const run of runs) walls.push(make(run.start, run.end, 'wall'));
  // Без поиска дверей разрывы остаются проходами — ничего не добавляем.
  if (!doors) return;
  for (let k = 0; k + 1 < runs.length; k++) {
    const left = runs[k]!;
    const right = runs[k + 1]!;
    const gap = right.start - left.end - 1;
    const leftLen = left.end - left.start + 1;
    const rightLen = right.end - right.start + 1;
    if (gap >= 1 && gap <= DOOR_MAX_GAP && leftLen >= 2 && rightLen >= 2) {
      walls.push(make(left.end + 1, right.start - 1, 'door'));
    }
  }
}

/** Коллинеарны ли отрезки (один — продолжение другого в пределах пары клеток). */
function collinear(a: Wall, b: Wall, size: number): boolean {
  const angA = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
  const angB = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
  let d = Math.abs(angA - angB) % Math.PI;
  if (d > Math.PI / 2) d = Math.PI - d;
  if (d > 0.1) return false;
  const mx = (a.x1 + a.x2) / 2;
  const my = (a.y1 + a.y2) / 2;
  const dx = b.x2 - b.x1;
  const dy = b.y2 - b.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return false;
  const perp = Math.abs((mx - b.x1) * dy - (my - b.y1) * dx) / len;
  if (perp > size * 0.35) return false;
  const near = Math.min(
    Math.hypot(a.x1 - b.x1, a.y1 - b.y1),
    Math.hypot(a.x1 - b.x2, a.y1 - b.y2),
    Math.hypot(a.x2 - b.x1, a.y2 - b.y1),
    Math.hypot(a.x2 - b.x2, a.y2 - b.y2)
  );
  return near <= size * (DOOR_MAX_GAP + 1);
}

/** Фильтр мебели: короткие отрезки оставляем, только если они примыкают к длинным или коллинеарны им. */
function filterFurniture(walls: Wall[], size: number): Wall[] {
  const cellLen = (w: Wall) => Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / size);
  const nodeKey = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  const kept = new Set<string>();
  const anchors = new Set<string>();
  const long: Wall[] = [];
  for (const w of walls) {
    if (w.kind !== 'door' && cellLen(w) >= FURNITURE_MIN_CELLS) {
      kept.add(w.id);
      long.push(w);
      anchors.add(nodeKey(w.x1, w.y1));
      anchors.add(nodeKey(w.x2, w.y2));
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const w of walls) {
      if (kept.has(w.id)) continue;
      const touches = anchors.has(nodeKey(w.x1, w.y1)) || anchors.has(nodeKey(w.x2, w.y2));
      const aligned = long.some((l) => collinear(w, l, size));
      if (touches || aligned) {
        kept.add(w.id);
        anchors.add(nodeKey(w.x1, w.y1));
        anchors.add(nodeKey(w.x2, w.y2));
        changed = true;
      }
    }
  }
  return walls.filter((w) => kept.has(w.id));
}

/**
 * A++: локальный контраст по модулю (ловит и светлые, и тёмные стены).
 * Для каждого ребра: «пол» = медиана яркости внутри обеих клеток; стена там,
 * где вдоль линии (в стороне от нарисованной линии сетки) идёт полоса
 * контрастной яркости толщиной не меньше `minThickness`.
 */
export function detectWalls(data: Uint8ClampedArray, width: number, height: number, params: WallDetectParams): Wall[] {
  const { size, offsetX, offsetY } = params;
  const contrast = params.contrast ?? 55;
  const ratio = params.ratio ?? 0.5;
  const band = params.band ?? 10;
  const skip = params.skip ?? 2;
  const margin = params.margin ?? 6;
  const minThickness = params.minThickness ?? 3;
  const furnitureFilter = params.furnitureFilter ?? true;
  const doors = params.doors ?? true;
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
    pushRuns(walls, flags, doors, (r0, r1, kind) => ({
      id: newId(),
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
    pushRuns(walls, flags, doors, (c0, c1, kind) => ({
      id: newId(),
      kind,
      x1: offsetX + c0 * size,
      y1: offsetY + r * size,
      x2: offsetX + (c1 + 1) * size,
      y2: offsetY + r * size,
    }));
  }

  const result = furnitureFilter ? filterFurniture(walls, size) : walls;
  return result.slice(0, MAX_WALLS);
}
