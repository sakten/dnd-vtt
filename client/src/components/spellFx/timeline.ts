import { cellCenter, pointCell, type AreaSpec, type SpellFxPayload } from 'shared';
import { ARCANE_COLOR, damageTypeColor } from '../../lib/damageColors';

export interface WorldPoint {
  x: number;
  y: number;
}

/** Сетка карты: нужна, чтобы привязать вершину области к центру клетки (как на сервере). */
export interface FxGrid {
  size: number;
  offsetX: number;
  offsetY: number;
}

/** Якорь фазы: фиксированная точка или токен (позиция берётся каждый кадр). */
export type FxAnchor = { point: WorldPoint } | { tokenId: string };

export interface FxPhase {
  kind: 'travel' | 'burst' | 'impact' | 'aura' | 'shape';
  /** Начало, мс от старта эффекта. */
  at: number;
  dur: number;
  from?: FxAnchor;
  to?: FxAnchor;
  /** Направление конуса/линии (мировая точка прицела). */
  dir?: FxAnchor;
  /** Форма области: `shape`-фаза и вид взрыва. */
  shape?: AreaSpec['shape'];
  color: string;
  /** Радиус сферы/цилиндра, длина конуса/линии или полусторона куба — в мировых px. */
  radius?: number;
  /** Ширина линии в мировых px. */
  width?: number;
  /** Высота дуги снаряда в мировых px (знак — сторона изгиба). */
  arc?: number;
  /** Особый вид ауры (оверрайды заклинаний). */
  aura?: FxStyle['aura'];
}

export interface FxPlan {
  id: string;
  phases: FxPhase[];
  duration: number;
}

const HEAL = '#7dffa8';
const BUFF = '#ffd98a';

/** Оверрайды визуала конкретных заклинаний (Ф3): цвет и характер снарядов/аур. */
export interface FxStyle {
  color?: string;
  /** Задержка между снарядами/лучами, мс. */
  shotDelay?: number;
  /** Длительность полёта снаряда, мс. */
  travelDur?: number;
  /** Изгиб траектории, px (0 — прямая). */
  travelArc?: number;
  /** Множитель длительности взрыва. */
  burstDur?: number;
  /** Особый вид ауры. */
  aura?: 'shield' | 'holy';
}

const FX_STYLES: Record<string, FxStyle> = {
  // Волшебные стрелы: быстрые фиолетовые дротики очередью.
  'XPHB:Magic Missile': { color: '#c9b8ff', shotDelay: 90, travelDur: 360, travelArc: 24 },
  // Мистический заряд: прямые фиолетовые лучи.
  'XPHB:Eldritch Blast': { color: '#b48aff', shotDelay: 130, travelDur: 420, travelArc: 0 },
  // Благословение: тёплое золотое свечение.
  'XPHB:Bless': { color: '#ffe9a8', aura: 'holy' },
  // Щит: голубые грани-лепестки вокруг кастера.
  'XPHB:Shield': { color: '#9fc4ff', aura: 'shield' },
  // Огненный шар: чуть дольше держится пламя.
  'XPHB:Fireball': { burstDur: 1.1 },
  'XPHB:Lightning Bolt': { color: '#fff08a' },
};

export function damageColor(types: string[]): string {
  for (const type of types) {
    const color = damageTypeColor(type);
    if (color) return color;
  }
  return ARCANE_COLOR;
}

/** Привязка точки к центру клетки сетки: общая геометрия shared (`rules/areas.ts`). */
function snapToCell(p: WorldPoint, grid: FxGrid): WorldPoint {
  const cell = pointCell(p, grid);
  return cellCenter(cell.cx, cell.cy, grid);
}

/** Список целей-снарядов: лучей может быть больше целей (Magic Missile, Eldritch Blast). */
function shotList(targets: FxAnchor[], origin: FxAnchor, count: number): FxAnchor[] {
  if (targets.length === 0) return [origin];
  const total = Math.max(1, count > 1 ? count : targets.length);
  return Array.from({ length: total }, (_, i) => targets[i % targets.length]!);
}

/** Таймлайн эффекта: фазы в мировых координатах, размеры — в мировых px. */
export function buildFxPlan(fx: SpellFxPayload, grid: FxGrid): FxPlan {
  const cell = grid.size > 0 ? grid.size : 50;
  const feet = (n: number) => (n / 5) * cell;
  const style = FX_STYLES[fx.key] ?? {};
  const color = style.color ?? (fx.mode === 'heal' ? HEAL : fx.mode === 'buff' ? BUFF : damageColor(fx.types));
  const caster: FxAnchor = { tokenId: fx.casterId };
  const origin: FxAnchor = fx.origin ? { point: fx.origin } : caster;
  const areaPoint: FxAnchor | null = fx.origin ? { point: snapToCell(fx.origin, grid) } : null;
  const targets = fx.targets.map((id): FxAnchor => ({ tokenId: id }));
  const shotDelay = style.shotDelay ?? 110;
  const travelDur = style.travelDur ?? 520;
  const travelArc = style.travelArc ?? 55;
  const burstDur = Math.round(900 * (style.burstDur ?? 1));
  const phases: FxPhase[] = [];

  if (fx.attack === 'ranged') {
    // Луч/снаряд на каждый выстрел; у лучей — сдвиг по времени и чередование дуги.
    shotList(targets, origin, fx.count).forEach((to, i) => {
      const start = i * shotDelay;
      phases.push({
        kind: 'travel',
        at: start,
        dur: travelDur,
        from: caster,
        to,
        color,
        arc: i % 2 === 0 ? travelArc : -travelArc,
      });
      phases.push({ kind: 'impact', at: start + travelDur - 50, dur: 380, to, color, radius: cell * 0.7 });
    });
  } else if (fx.attack === 'melee') {
    targets.forEach((to, i) => {
      phases.push({ kind: 'impact', at: i * shotDelay, dur: 340, to, color, radius: cell * 0.8 });
    });
  } else if (fx.mode === 'heal' && !fx.area) {
    // Лечение без области: аура на цели (или на кастере, если лечит себя).
    const list = fx.toSelf || targets.length === 0 ? [caster] : targets;
    list.forEach((to, i) => {
      phases.push({ kind: 'aura', at: i * shotDelay, dur: 880, to, color, radius: cell * 0.85, aura: style.aura });
    });
  } else if (fx.area && areaPoint) {
    // Настоящие формы области: конус/линия бьют от вершины, сфера/куб/цилиндр — от точки.
    const shape = fx.area.shape;
    const directional = shape === 'cone' || shape === 'line';
    if (directional) {
      // У областей «от себя» вершина визуально в руках кастера (геометрия урона считается
      // от центра клетки, но рисовать конус из центра клетки — заметный сдвиг от токена).
      const vertex = fx.selfArea ? caster : areaPoint;
      phases.push({ kind: 'impact', at: 0, dur: 220, to: vertex, color, radius: cell * 0.5 });
      phases.push({
        kind: 'shape',
        at: 40,
        dur: 800,
        to: vertex,
        dir: fx.direction ? { point: fx.direction } : undefined,
        shape,
        color,
        radius: feet(fx.area.size),
        width: shape === 'line' ? feet(fx.area.width ?? 5) : feet(fx.area.size),
      });
      targets.forEach((to, i) => {
        phases.push({ kind: 'impact', at: 560 + i * 60, dur: 380, to, color, radius: cell * 0.75 });
      });
    } else {
      // Сфера/куб «от себя» — вспышка сразу; брошенная сфера — сначала снаряд к точке.
      const burstAt = fx.selfArea ? 0 : 420;
      if (!fx.selfArea) {
        phases.push({ kind: 'travel', at: 0, dur: 470, from: caster, to: origin, color, arc: 90 });
      }
      phases.push({
        kind: 'burst',
        at: burstAt,
        dur: burstDur,
        to: areaPoint,
        shape,
        color,
        // Сфера/цилиндр: радиус = размер; куб: полусторона квадрата.
        radius: shape === 'cube' ? feet(fx.area.size) / 2 : feet(fx.area.size),
      });
      targets.forEach((to, i) => {
        phases.push({ kind: 'impact', at: burstAt + 140 + i * 60, dur: 380, to, color, radius: cell * 0.75 });
      });
    }
  } else if (fx.resolution === 'save' || fx.area) {
    // Спасбросок без области: снаряд к точке и вспышка.
    phases.push({ kind: 'travel', at: 0, dur: 470, from: caster, to: origin, color, arc: 90 });
    phases.push({ kind: 'burst', at: 420, dur: burstDur, to: origin, color, radius: cell * 0.55 });
    targets.forEach((to, i) => {
      phases.push({ kind: 'impact', at: 560 + i * 60, dur: 380, to, color, radius: cell * 0.75 });
    });
  } else if (fx.mode === 'damage' && targets.length > 0) {
    // Авто-урон (Magic Missile): снаряды бьют по целям без спасброска.
    shotList(targets, origin, fx.count).forEach((to, i) => {
      const start = i * shotDelay;
      phases.push({
        kind: 'travel',
        at: start,
        dur: travelDur - 100,
        from: caster,
        to,
        color,
        arc: travelArc * 0.9,
      });
      phases.push({ kind: 'impact', at: start + travelDur - 140, dur: 360, to, color, radius: cell * 0.7 });
    });
  } else {
    // Бафф/лечение: аура на цели (или на кастере, если эффект на себя).
    const list = fx.toSelf || targets.length === 0 ? [caster] : targets;
    list.forEach((to, i) => {
      phases.push({ kind: 'aura', at: i * shotDelay, dur: 880, to, color, radius: cell * 0.85, aura: style.aura });
    });
  }

  const duration = phases.reduce((max, p) => Math.max(max, p.at + p.dur), 0);
  return { id: fx.id, phases, duration };
}
