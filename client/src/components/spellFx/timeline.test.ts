import { describe, expect, it } from 'vitest';
import type { SpellFxPayload } from 'shared';
import { buildFxPlan, damageColor } from './timeline';

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
    const plan = buildFxPlan(fx(), 50);
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
      50
    );
    const travels = plan.phases.filter((p) => p.kind === 'travel');
    expect(travels).toHaveLength(2);
    expect(travels[1]!.at).toBeGreaterThan(travels[0]!.at);
    expect(plan.phases.filter((p) => p.kind === 'impact')).toHaveLength(2);
  });

  it('бафф на себя: только аура на кастере', () => {
    const plan = buildFxPlan(
      fx({ resolution: 'effect', mode: 'buff', area: undefined, types: [], toSelf: true, targets: [] }),
      50
    );
    expect(plan.phases.map((p) => p.kind)).toEqual(['aura']);
    expect(plan.phases[0]!.to).toEqual({ tokenId: 't1' });
    expect(plan.phases[0]!.color).toBe('#ffd98a');
  });

  it('лечение: зелёная аура на цели', () => {
    const plan = buildFxPlan(
      fx({ resolution: 'save', mode: 'heal', area: undefined, types: [], targets: ['t2'] }),
      50
    );
    expect(plan.phases[0]!.kind).toBe('aura');
    expect(plan.phases[0]!.color).toBe('#7dffa8');
    expect(plan.phases[0]!.to).toEqual({ tokenId: 't2' });
  });
});
