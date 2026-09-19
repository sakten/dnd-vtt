import { describe, expect, it } from 'vitest';
import type { SpellFxPayload } from 'shared';
import { buildFxPlan, damageColor, type FxGrid } from './timeline';

const GRID: FxGrid = { size: 50, offsetX: 0, offsetY: 0 };

const fx = (patch: Partial<SpellFxPayload> = {}): SpellFxPayload => ({
  id: 'f1',
  mapId: 'm1',
  casterId: 't1',
  key: 'XPHB:Fireball',
  name: 'Fireball',
  resolution: 'save',
  mode: 'damage',
  area: { shape: 'sphere', size: 20 },
  origin: { x: 300, y: 100 },
  direction: null,
  targets: ['t2', 't3'],
  types: ['fire'],
  count: 1,
  ...patch,
});

describe('палитра эффектов', () => {
  it('по типу урона, иначе арканный', () => {
    expect(damageColor(['fire'])).toBe('#ff8a2b');
    expect(damageColor(['cold'])).toBe('#7fd4ff');
    expect(damageColor(['unknown'])).toBe('#8fb7ff');
    expect(damageColor([])).toBe('#8fb7ff');
  });
});

describe('таймлайн эффекта', () => {
  it('Fireball: снаряд к точке, взрыв радиусом области и искры на целях', () => {
    const plan = buildFxPlan(fx(), GRID);
    const kinds = plan.phases.map((p) => p.kind);
    expect(kinds.filter((k) => k === 'travel')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'burst')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'impact')).toHaveLength(2);
    const burst = plan.phases.find((p) => p.kind === 'burst')!;
    // 20 фт радиуса = 4 клетки по 50 px.
    expect(burst.radius).toBe(200);
    expect(burst.color).toBe('#ff8a2b');
    expect(plan.duration).toBeGreaterThan(900);
  });

  it('атака заклинанием: снаряд на каждую цель со сдвигом', () => {
    const plan = buildFxPlan(
      fx({ resolution: 'attack', attack: 'ranged', area: undefined, types: ['force'], targets: ['t2', 't3'] }),
      GRID
    );
    const travels = plan.phases.filter((p) => p.kind === 'travel');
    expect(travels).toHaveLength(2);
    expect(travels[1]!.at).toBeGreaterThan(travels[0]!.at);
    expect(plan.phases.filter((p) => p.kind === 'impact')).toHaveLength(2);
  });

  it('бафф на себя: только аура на кастере', () => {
    const plan = buildFxPlan(
      fx({ resolution: 'effect', mode: 'buff', area: undefined, types: [], toSelf: true, targets: [] }),
      GRID
    );
    expect(plan.phases.map((p) => p.kind)).toEqual(['aura']);
    expect(plan.phases[0]!.to).toEqual({ tokenId: 't1' });
    expect(plan.phases[0]!.color).toBe('#ffd98a');
  });

  it('лечение: зелёная аура на цели', () => {
    const plan = buildFxPlan(
      fx({ resolution: 'save', mode: 'heal', area: undefined, types: [], targets: ['t2'] }),
      GRID
    );
    expect(plan.phases[0]!.kind).toBe('aura');
    expect(plan.phases[0]!.color).toBe('#7dffa8');
    expect(plan.phases[0]!.to).toEqual({ tokenId: 't2' });
  });
});

describe('настоящие формы области (Ф2)', () => {
  it('конус: вспышка у вершины и форма в сторону прицела', () => {
    const plan = buildFxPlan(
      fx({ area: { shape: 'cone', size: 15 }, direction: { x: 400, y: 100 }, targets: [] }),
      GRID
    );
    expect(plan.phases.map((p) => p.kind)).toEqual(['impact', 'shape']);
    const shape = plan.phases[1]!;
    expect(shape.shape).toBe('cone');
    expect(shape.radius).toBe(150); // 15 фт
    expect(shape.dir).toEqual({ point: { x: 400, y: 100 } });
    // Вершина привязана к центру клетки точки применения.
    expect(shape.to).toEqual({ point: { x: 325, y: 125 } });
  });

  it('конус от себя: вершина у кастера, а не в центре клетки', () => {
    const plan = buildFxPlan(
      fx({ area: { shape: 'cone', size: 15 }, selfArea: true, direction: { x: 400, y: 100 }, targets: [] }),
      GRID
    );
    const shape = plan.phases.find((p) => p.kind === 'shape')!;
    expect(shape.to).toEqual({ tokenId: 't1' });
  });

  it('линия: длина и ширина в мировых px', () => {
    const plan = buildFxPlan(fx({ area: { shape: 'line', size: 30, width: 5 }, direction: { x: 400, y: 100 } }), GRID);
    const shape = plan.phases.find((p) => p.kind === 'shape')!;
    expect(shape.shape).toBe('line');
    expect(shape.radius).toBe(300);
    expect(shape.width).toBe(50);
  });

  it('куб от себя: квадратный взрыв сразу, без снаряда', () => {
    const plan = buildFxPlan(fx({ area: { shape: 'cube', size: 15 }, selfArea: true }), GRID);
    expect(plan.phases.map((p) => p.kind)).toEqual(['burst', 'impact', 'impact']);
    const burst = plan.phases[0]!;
    expect(burst.shape).toBe('cube');
    expect(burst.radius).toBe(75);
    expect(burst.at).toBe(0);
  });
});

describe('оверрайды заклинаний (Ф3)', () => {
  it('Волшебные стрелы: дротик на каждую стрелу, фиолетовые', () => {
    const plan = buildFxPlan(
      fx({ key: 'XPHB:Magic Missile', resolution: 'auto', mode: 'damage', area: undefined, targets: ['t2'], types: ['force'], count: 3 }),
      GRID
    );
    const travels = plan.phases.filter((p) => p.kind === 'travel');
    expect(travels).toHaveLength(3);
    expect(plan.phases.filter((p) => p.kind === 'impact')).toHaveLength(3);
    expect(travels[0]!.color).toBe('#c9b8ff');
    expect(travels[1]!.at).toBeGreaterThan(travels[0]!.at);
  });

  it('Мистический заряд: 2 луча без изгиба', () => {
    const plan = buildFxPlan(
      fx({ key: 'XPHB:Eldritch Blast', resolution: 'attack', attack: 'ranged', area: undefined, targets: ['t2'], types: ['force'], count: 2 }),
      GRID
    );
    const travels = plan.phases.filter((p) => p.kind === 'travel');
    expect(travels).toHaveLength(2);
    expect(travels[0]!.arc).toBe(0);
    expect(travels[0]!.color).toBe('#b48aff');
  });

  it('Щит: гранёная аура на кастере', () => {
    const plan = buildFxPlan(
      fx({ key: 'XPHB:Shield', resolution: 'effect', mode: 'buff', area: undefined, types: [], toSelf: true, targets: [] }),
      GRID
    );
    expect(plan.phases[0]!.aura).toBe('shield');
    expect(plan.phases[0]!.color).toBe('#9fc4ff');
  });
});
