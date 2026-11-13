import { describe, expect, it } from 'vitest';
import type { CharacterSheet, PlayerResources } from 'shared';
import { makeConnCtx } from '../test/ctx';
import { makeResources, makeRoom } from '../test/fixtures';
import { registerResourceHandlers } from './resources';

function wizardSheet(level: number): CharacterSheet {
  return {
    name: 'Волшебник',
    senses: [],
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    proficiencyBonus: '3',
    saves: {},
    skills: {},
    attacks: [],
    classes: [{ className: 'wizard', level }],
    spells: [],
    hpMax: '30',
    ac: '12',
    speed: 30,
    damageDefenses: [],
  };
}

function wizardResources(): PlayerResources {
  return makeResources({
    spellSlots: [
      { level: 1, current: 1, max: 4 },
      { level: 2, current: 0, max: 3 },
      { level: 3, current: 1, max: 3 },
      { level: 4, current: 0, max: 2 },
    ],
    resources: [
      { id: 'arcane', key: 'wizard:arcaneRecovery', name: 'Магическое восстановление', current: 1, max: 1, reset: 'long', auto: true },
    ],
  });
}

describe('resources:arcaneRecovery', () => {
  it('возвращает выбранные ячейки в пределах бюджета и тратит ресурс', () => {
    const room = makeRoom();
    room.sheets.p1 = wizardSheet(8);
    room.resources.p1 = wizardResources();
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerResourceHandlers(f.ctx);

    f.invoke('resources:arcaneRecovery', {
      slots: [
        { level: 1, count: 2 },
        { level: 2, count: 1 },
      ],
    });

    expect(room.resources.p1!.spellSlots).toEqual([
      { level: 1, current: 3, max: 4 },
      { level: 2, current: 1, max: 3 },
      { level: 3, current: 1, max: 3 },
      { level: 4, current: 0, max: 2 },
    ]);
    expect(room.resources.p1!.resources[0]!.current).toBe(0);
  });

  it('отклоняет превышение бюджета и не тратит ресурс', () => {
    const room = makeRoom();
    room.sheets.p1 = wizardSheet(8);
    room.resources.p1 = wizardResources();
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerResourceHandlers(f.ctx);

    f.invoke('resources:arcaneRecovery', { slots: [{ level: 4, count: 2 }] });

    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(room.resources.p1!.spellSlots[3]!.current).toBe(0);
    const error = f.emitted.find((e) => e.event === 'chat:error')?.payload as { code?: string } | undefined;
    expect(error?.code).toBe('arcaneRecoveryBudget');
  });

  it('отклоняет восстановление не потраченных ячеек и уровень 6+', () => {
    const room = makeRoom();
    room.sheets.p1 = wizardSheet(20);
    room.resources.p1 = makeResources({
      spellSlots: [{ level: 6, current: 0, max: 1 }],
      resources: [
        { id: 'arcane', key: 'wizard:arcaneRecovery', name: 'Магическое восстановление', current: 1, max: 1, reset: 'long', auto: true },
      ],
    });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerResourceHandlers(f.ctx);

    f.invoke('resources:arcaneRecovery', { slots: [{ level: 6, count: 1 }] });

    const error = f.emitted.find((e) => e.event === 'chat:error')?.payload as { code?: string } | undefined;
    expect(error?.code).toBe('arcaneRecoveryInvalid');
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
  });
});
