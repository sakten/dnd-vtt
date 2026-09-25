import { describe, expect, it } from 'vitest';
import type { AutomationDef, AutomationEffect } from 'shared';
import { dispatchKind, type DispatchInput } from './dispatch';

const effect = (): AutomationEffect => ({ name: 'E', duration: { type: 'permanent' }, to: 'self', modifiers: [] });

const def = (partial: Partial<AutomationDef>): AutomationDef => ({
  key: 'TEST:Spell',
  name: 'Spell',
  resolution: 'auto',
  ...partial,
});

const pick = (partial: Partial<AutomationDef>, input: Partial<DispatchInput> = {}) =>
  dispatchKind(def(partial), { hasStats: true, hasExpression: true, ...input });

describe('dispatchKind', () => {
  it('utility перехватывает всё остальное (и работает без статов)', () => {
    const partial: Partial<AutomationDef> = {
      resolution: 'utility',
      utility: { kind: 'teleport', amount: 30 },
      save: { ability: 'dex' },
      attack: { rangeType: 'ranged' },
      effects: [effect()],
    };
    expect(pick(partial)).toBe('utility');
    expect(pick(partial, { hasStats: false })).toBe('utility');
  });

  it('summon — только при поле summon', () => {
    expect(pick({ resolution: 'summon', summon: { duration: { type: 'permanent' }, initiative: 'own' } })).toBe('summon');
    expect(pick({ resolution: 'summon' }, { hasExpression: false })).toBe('manual');
  });

  it('effect — только при непустых effects', () => {
    expect(pick({ resolution: 'effect', effects: [effect()] })).toBe('effect');
    expect(pick({ resolution: 'effect' }, { hasExpression: false })).toBe('manual');
  });

  it('lifeTransfer приоритетнее атаки и спасброска', () => {
    expect(
      pick({
        resolution: 'auto',
        damage: { dice: '4d8', types: ['necrotic'] },
        lifeTransfer: { factor: 2 },
        save: { ability: 'con' },
      })
    ).toBe('lifeTransfer');
  });

  it('attack требует статов и приоритетнее save', () => {
    const attack: Partial<AutomationDef> = {
      resolution: 'attack',
      attack: { rangeType: 'ranged' },
      damage: { dice: '1d10', types: ['fire'] },
      save: { ability: 'dex' },
    };
    expect(pick(attack)).toBe('attack');
    expect(pick(attack, { hasStats: false })).toBe('single');
  });

  it('save+heal+damage перехватывает раньше обычного save', () => {
    expect(
      pick({
        resolution: 'save',
        save: { ability: 'dex' },
        damage: { dice: '1d6', types: ['radiant'] },
        heal: { dice: '1d6' },
      })
    ).toBe('healOrDamage');
  });

  it('save без heal — ветка save; спас без статов не срабатывает', () => {
    const partial: Partial<AutomationDef> = { resolution: 'save', save: { ability: 'con' }, damage: { dice: '8d6', types: ['fire'] } };
    expect(pick(partial)).toBe('save');
    expect(pick(partial, { hasStats: false })).toBe('single');
  });

  it('auto: эффекты без спасброска и атаки срабатывают даже без выражения урона', () => {
    expect(pick({ resolution: 'auto', effects: [effect()] }, { hasExpression: false })).toBe('auto');
  });

  it('manual — когда выражения нет и других веток нет', () => {
    expect(pick({ resolution: 'auto' }, { hasExpression: false })).toBe('manual');
  });

  it('multi/single — финальные ветки: save/attack приоритетнее targets', () => {
    expect(pick({ resolution: 'save', targets: 5, save: { ability: 'dex' }, damage: { dice: '1d6', types: ['cold'] } })).toBe('save');
    expect(pick({ resolution: 'auto', targets: 5, damage: { dice: '1d6', types: ['cold'] } })).toBe('multi');
    expect(pick({ resolution: 'auto', damage: { dice: '1d6', types: ['cold'] } })).toBe('single');
  });
});
