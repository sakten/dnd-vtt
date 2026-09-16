import type { Sense } from '../domain/sense';
import type { Wall } from '../domain/scene';
import { crossesWalls, type Point } from './walls';

export interface SightContext {
  walls: Wall[];
  /** Карта в «Темноте»: дальность ограничена восприятием. */
  darkness: boolean;
  /** Клетки вижна (как у тумана). */
  cellSize: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Радиусы восприятия в клетках: вне «Темноты» — без предела,
 * в темноте — по сенсам (футы ÷ 5), без них 1 клетка вокруг.
 */
export function visionRadiiCells(darkness: boolean, senses: Sense[] | undefined): (number | null)[] {
  if (!darkness) return [null];
  const radii = (senses ?? []).map((s) => Math.floor(Math.max(0, s.range) / 5)).filter((r) => r > 0);
  return radii.length > 0 ? radii : [1];
}

/**
 * Видит ли зритель точку: стены и закрытые двери блокируют всегда,
 * в «Темноте» нужен хотя бы один радиус (Чёбышёв по клеткам).
 */
export function canSee(from: Point, target: Point, senses: Sense[] | undefined, ctx: SightContext): boolean {
  if (crossesWalls(from, target, ctx.walls, 'sight')) return false;
  if (!ctx.darkness) return true;
  const size = ctx.cellSize || 50;
  const fromX = Math.floor((from.x - ctx.offsetX) / size);
  const fromY = Math.floor((from.y - ctx.offsetY) / size);
  const targetX = Math.floor((target.x - ctx.offsetX) / size);
  const targetY = Math.floor((target.y - ctx.offsetY) / size);
  const distance = Math.max(Math.abs(targetX - fromX), Math.abs(targetY - fromY));
  return visionRadiiCells(ctx.darkness, senses).some((r) => r === null || distance <= r);
}
