export interface GridCandidate {
  /** Размер клетки в пикселях изображения, на котором считали. */
  size: number;
  offsetX: number;
  offsetY: number;
  /** 0..1 — нормированная корреляция профиля на найденном периоде. */
  confidence: number;
}

export const GRID_MIN_CONFIDENCE = 0.2;
export const GRID_AUTO_CONFIDENCE = 0.4;

const MIN_SIZE = 20;
const MAX_SIZE = 400;
const MIN_CORR = 0.2;
/** Порог близости корреляции для выбора фундаментального периода вместо кратного. */
const SUBHARMONIC_KEEP = 0.65;

function gray(data: Uint8ClampedArray, i: number): number {
  return 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
}

/** Профиль вертикальных перепадов: для каждого x — сумма |L(x)−L(x−1)| по y. */
function columnProfile(data: Uint8ClampedArray, width: number, height: number): Float64Array {
  const prof = new Float64Array(width);
  for (let y = 1; y < height; y++) {
    const base = y * width * 4;
    for (let x = 1; x < width; x++) {
      const i = base + x * 4;
      prof[x] = (prof[x] ?? 0) + Math.abs(gray(data, i) - gray(data, i - 4));
    }
  }
  return prof;
}

/** Профиль горизонтальных перепадов: для каждого y — сумма |L(y)−L(y−1)| по x. */
function rowProfile(data: Uint8ClampedArray, width: number, height: number): Float64Array {
  const prof = new Float64Array(height);
  for (let y = 1; y < height; y++) {
    const a = y * width * 4;
    const b = (y - 1) * width * 4;
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const i = x * 4;
      sum += Math.abs(gray(data, a + i) - gray(data, b + i));
    }
    prof[y] = sum;
  }
  return prof;
}

interface Periodicity {
  period: number;
  score: number;
}

/** Период профиля: нормированная автокорреляция + поправка на кратные (сабгармоники). */
function findPeriodicity(profile: Float64Array): Periodicity {
  const n = profile.length;
  const maxLag = Math.min(MAX_SIZE, Math.floor(n / 2));
  if (maxLag < MIN_SIZE) return { period: 0, score: 0 };

  let mean = 0;
  for (let i = 0; i < n; i++) mean += profile[i]!;
  mean /= n;
  const p = new Float64Array(n);
  for (let i = 0; i < n; i++) p[i] = profile[i]! - mean;

  const corr = new Float64Array(maxLag + 1);
  for (let lag = MIN_SIZE; lag <= maxLag; lag++) {
    let s = 0;
    let q1 = 0;
    let q2 = 0;
    for (let i = 0; i + lag < n; i++) {
      s += p[i]! * p[i + lag]!;
      q1 += p[i]! * p[i]!;
      q2 += p[i + lag]! * p[i + lag]!;
    }
    const d = Math.sqrt(q1 * q2);
    corr[lag] = d > 0 ? s / d : 0;
  }

  let maxCorr = 0;
  let maxAt = 0;
  for (let lag = MIN_SIZE; lag <= maxLag; lag++) {
    if (corr[lag]! > maxCorr) {
      maxCorr = corr[lag]!;
      maxAt = lag;
    }
  }
  if (maxCorr < MIN_CORR) return { period: 0, score: 0 };

  let bestLag = maxAt;
  for (const div of [4, 3, 2]) {
    const cand = Math.round(maxAt / div);
    if (cand >= MIN_SIZE && cand <= maxLag && corr[cand]! > SUBHARMONIC_KEEP * maxCorr) {
      bestLag = cand;
      break;
    }
  }
  let refined = bestLag;
  for (let l = bestLag - 2; l <= bestLag + 2; l++) {
    if (l >= MIN_SIZE && l <= maxLag && corr[l]! > corr[refined]!) refined = l;
  }
  return { period: refined, score: maxCorr };
}

/** Фаза: сдвиг, при котором гребёнка профиля даёт максимум. */
function findPhase(profile: Float64Array, period: number): number {
  const n = profile.length;
  let bestOff = 0;
  let bestSum = -Infinity;
  for (let off = 0; off < period; off++) {
    let sum = 0;
    let count = 0;
    for (let x = off; x < n; x += period) {
      sum += profile[x]!;
      count++;
    }
    const avg = count > 0 ? sum / count : 0;
    if (avg > bestSum) {
      bestSum = avg;
      bestOff = off;
    }
  }
  return bestOff;
}

function mean(profile: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < profile.length; i++) sum += profile[i]!;
  return sum / profile.length;
}

/** Среднее профиля по гребёнке (period, offset) — «сила линий» сетки. */
function combMean(profile: Float64Array, period: number, offset: number): number {
  let sum = 0;
  let count = 0;
  for (let x = offset; x < profile.length; x += period) {
    sum += profile[x]!;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Детект квадратной сетки по изображению (RGBA): период по X/Y + сдвиг + уверенность.
 * Нормализованная автокорреляция, поправка на кратные периоды; при расхождении осей
 * берётся более уверенная.
 */
export function detectGridFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): GridCandidate | null {
  if (width < 64 || height < 64) return null;
  const col = columnProfile(data, width, height);
  const row = rowProfile(data, width, height);
  const px = findPeriodicity(col);
  const py = findPeriodicity(row);
  if (!px.period && !py.period) return null;

  let period: number;
  let score: number;
  if (px.period > 0 && py.period > 0) {
    const rel = Math.abs(px.period - py.period) / px.period;
    if (rel < 0.08) {
      period = Math.round((px.period + py.period) / 2);
    } else {
      period = px.score >= py.score ? px.period : py.period;
    }
    score = Math.max(px.score, py.score);
  } else {
    period = px.period || py.period;
    score = Math.max(px.score, py.score);
  }
  if (period < MIN_SIZE) return null;

  const offsetX = findPhase(col, period);
  const offsetY = findPhase(row, period);
  // Защита от ложных срабатываний на шуме: линии должны заметно превышать фон профиля.
  const contrast = Math.max(
    combMean(col, period, offsetX) / Math.max(1e-6, mean(col)),
    combMean(row, period, offsetY) / Math.max(1e-6, mean(row))
  );
  if (contrast < 1.4) return null;

  return { size: period, offsetX, offsetY, confidence: score };
}
