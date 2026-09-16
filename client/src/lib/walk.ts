export const WALK_MS_PER_STEP = 150;
export const WALK_MAX_MS = 1500;

export interface WalkPoint {
  x: number;
  y: number;
}

export interface WalkSession {
  /** Мировые точки от старта к финишу. */
  points: WalkPoint[];
  duration: number;
  /** Индекс последней обработанной точки (шага). */
  stepIndex: number;
  startedAt: number;
}

export interface WalkFrame {
  position: WalkPoint;
  /** Непройденные шаги (могли перескочить при длинном кадре). */
  steps: number[];
  settled: boolean;
}

/** Длительность похода: 150 мс на шаг, не меньше одного шага и не больше 1.5 с. */
export function walkDuration(count: number): number {
  return Math.min(WALK_MAX_MS, Math.max(WALK_MS_PER_STEP, (count - 1) * WALK_MS_PER_STEP));
}

export function startWalkSession(points: WalkPoint[], startedAt: number): WalkSession {
  return { points, duration: walkDuration(points.length), stepIndex: 0, startedAt };
}

/**
 * Кадр похода: интерполяция по сегментам и все шаги, которые нужно обработать
 * (без пропуска клеток). Метка времени может быть меньше `startedAt` (Firefox) —
 * прогресс зажимается в диапазон.
 */
export function walkFrame(session: WalkSession, now: number): WalkFrame {
  const segments = session.points.length - 1;
  const elapsed = Math.max(0, now - session.startedAt);
  const t = session.duration > 0 ? Math.min(1, elapsed / session.duration) : 1;
  const progress = t * segments;
  const idx = Math.max(0, Math.min(segments, Math.floor(progress)));
  const steps: number[] = [];
  for (let i = session.stepIndex + 1; i <= idx; i++) steps.push(i);
  if (idx > session.stepIndex) session.stepIndex = idx;
  let position: WalkPoint;
  if (idx >= segments) {
    position = { ...session.points[segments]! };
  } else {
    const local = progress - idx;
    const a = session.points[idx]!;
    const b = session.points[idx + 1]!;
    position = { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
  }
  return { position, steps, settled: t >= 1 };
}

/** Точки, реально пройденные до шага `stepIndex` включительно. */
export function walkedPoints(session: WalkSession, stepIndex: number): WalkPoint[] {
  const last = Math.max(0, Math.min(stepIndex, session.points.length - 1));
  return session.points.slice(0, last + 1);
}
