import type { AreaSpec, SpellFxPayload } from 'shared';

export interface WorldPoint {
  x: number;
  y: number;
}

/** Якорь фазы: фиксированная точка или токен (позиция берётся каждый кадр). */
export type FxAnchor = { point: WorldPoint } | { tokenId: string };

export interface FxPhase {
  kind: 'travel' | 'burst' | 'impact' | 'aura';
  /** Начало, мс от старта эффекта. */
  at: number;
  dur: number;
  from?: FxAnchor;
  to?: FxAnchor;
  color: string;
  /** Радиус вспышки/ауры в мировых px. */
  radius?: number;
  /** Высота дуги снаряда в мировых px (знак — сторона изгиба). */
  arc?: number;
}

export interface FxPlan {
  id: string;
  phases: FxPhase[];
  duration: number;
}

const TYPE_COLORS: Record<string, string> = {
  fire: '#ff8a2b',
  cold: '#7fd4ff',
  lightning: '#ffe86b',
  acid: '#9bea3a',
  poison: '#7cd06a',
  necrotic: '#a06bff',
  radiant: '#ffe6a3',
  force: '#8fb7ff',
  thunder: '#dbe9ff',
  psychic: '#ff7fd0',
  bludgeoning: '#c9b8a3',
  piercing: '#d9d9d9',
  slashing: '#e0a0a0',
};

const ARCANE = '#8fb7ff';
const HEAL = '#7dffa8';
const BUFF = '#ffd98a';

export function damageColor(types: string[]): string {
  for (const type of types) {
    const color = TYPE_COLORS[type];
    if (color) return color;
  }
  return ARCANE;
}

/** Радиус для радиальных эффектов: сфера/цилиндр — сам размер, остальные — приближение. */
function areaRadiusFeet(area: AreaSpec): number {
  if (area.shape === 'sphere' || area.shape === 'cylinder') return area.size;
  if (area.shape === 'cone') return area.size * 0.8;
  if (area.shape === 'line') return area.size * 0.6;
  return area.size * 0.75;
}

/** Таймлайн эффекта: фазы в мировых координатах, размеры — в мировых px. */
export function buildFxPlan(fx: SpellFxPayload, gridSize: number): FxPlan {
  const cell = gridSize > 0 ? gridSize : 50;
  const feet = (n: number) => (n / 5) * cell;
  const color = fx.mode === 'heal' ? HEAL : fx.mode === 'buff' ? BUFF : damageColor(fx.types);
  const caster: FxAnchor = { tokenId: fx.casterId };
  const origin: FxAnchor = fx.origin ? { point: fx.origin } : caster;
  const targets = fx.targets.map((id): FxAnchor => ({ tokenId: id }));
  const radius = fx.area ? feet(areaRadiusFeet(fx.area)) : cell * 0.55;
  const phases: FxPhase[] = [];

  if (fx.attack === 'ranged') {
    // Луч/снаряд на каждую цель; у лучей — сдвиг по времени и чередование дуги.
    const list = targets.length > 0 ? targets : [origin];
    list.forEach((to, i) => {
      const start = i * 110;
      phases.push({ kind: 'travel', at: start, dur: 520, from: caster, to, color, arc: i % 2 === 0 ? 55 : -55 });
      phases.push({ kind: 'impact', at: start + 470, dur: 380, to, color, radius: cell * 0.7 });
    });
  } else if (fx.attack === 'melee') {
    targets.forEach((to, i) => {
      phases.push({ kind: 'impact', at: i * 110, dur: 340, to, color, radius: cell * 0.8 });
    });
  } else if (fx.mode === 'heal' && !fx.area) {
    // Лечение без области: аура на цели (или на кастере, если лечит себя).
    const list = fx.toSelf || targets.length === 0 ? [caster] : targets;
    list.forEach((to, i) => {
      phases.push({ kind: 'aura', at: i * 110, dur: 880, to, color, radius: cell * 0.85 });
    });
  } else if (fx.resolution === 'save' || fx.area) {
    // Снаряд до точки, взрыв области, искры на задетых целях.
    phases.push({ kind: 'travel', at: 0, dur: 470, from: caster, to: origin, color, arc: 90 });
    phases.push({ kind: 'burst', at: 420, dur: 900, to: origin, color, radius });
    targets.forEach((to, i) => {
      phases.push({ kind: 'impact', at: 560 + i * 60, dur: 380, to, color, radius: cell * 0.75 });
    });
  } else if (fx.mode === 'damage' && targets.length > 0) {
    // Авто-урон (Magic Missile): снаряды бьют по целям без спасброска.
    targets.forEach((to, i) => {
      const start = i * 110;
      phases.push({ kind: 'travel', at: start, dur: 460, from: caster, to, color, arc: 50 });
      phases.push({ kind: 'impact', at: start + 420, dur: 360, to, color, radius: cell * 0.7 });
    });
  } else {
    // Бафф/лечение: аура на цели (или на кастере, если эффект на себя).
    const list = fx.toSelf || targets.length === 0 ? [caster] : targets;
    list.forEach((to, i) => {
      phases.push({ kind: 'aura', at: i * 110, dur: 880, to, color, radius: cell * 0.85 });
    });
  }

  const duration = phases.reduce((max, p) => Math.max(max, p.at + p.dur), 0);
  return { id: fx.id, phases, duration };
}
