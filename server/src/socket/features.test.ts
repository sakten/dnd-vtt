import { describe, expect, it } from 'vitest';
import type { CharacterSheet, ConditionKey } from 'shared';
import { makeCombatRoom, makeResources, makeRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { registerActionHandlers } from './actions';
import { applyEffectTo } from './effectsApply';
import { syncFeatureEffectsForItem } from './features';
import { registerTokenHandlers } from './token';

const updatedIds = (emitted: { event: string; payload: unknown }[]): string[] =>
  emitted
    .filter((e) => e.event === 'token:update')
    .map((e) => (e.payload as { token: { id: string } }).token.id);

describe('syncFeatureEffectsForItem', () => {
  it('синхронизирует скрытые эффекты черт у всех токенов предмета и рассылает их', () => {
    const t1 = makeToken('t1', { libraryItemId: 'lib1' });
    const t2 = makeToken('t2', { libraryItemId: 'lib1' });
    const room = makeRoom();
    room.scene.maps[0]!.tokens = [t1, t2];
    const f = makeConnCtx(room, { dm: true });

    syncFeatureEffectsForItem(f.ctx, room, 'lib1', [{ className: 'barbarian', level: 1 }]);
    for (const t of [t1, t2]) {
      expect(t.effects.some((e) => e.sourceKey?.startsWith('feature:barbarian:unarmoredDefense'))).toBe(true);
      expect(updatedIds(f.emitted)).toContain(t.id);
    }

    // Пустые классы: эффекты черт снимаются, токены снова рассылаются.
    const before = f.emitted.length;
    syncFeatureEffectsForItem(f.ctx, room, 'lib1', []);
    for (const t of [t1, t2]) {
      expect(t.effects.some((e) => e.sourceKey?.startsWith('feature:'))).toBe(false);
    }
    expect(f.emitted.length).toBeGreaterThan(before);
  });

  it('пассивные бонусы вида: тёмное зрение, сопротивления и выносливость дварфа', () => {
    const t1 = makeToken('t1', { libraryItemId: 'lib1' });
    const room = makeRoom();
    room.scene.maps[0]!.tokens = [t1];
    const f = makeConnCtx(room, { dm: true });

    syncFeatureEffectsForItem(
      f.ctx,
      room,
      'lib1',
      [{ className: 'wizard', level: 6 }],
      undefined,
      { key: 'XPHB:Dwarf' }
    );

    const effects = t1.effects.filter((effect) => effect.sourceKey?.startsWith('feature:race:XPHB:Dwarf'));
    expect(effects.some((effect) => effect.senses?.some((s) => s.type === 'darkvision' && s.range === 120))).toBe(true);
    expect(
      effects.some((effect) =>
        effect.modifiers.some((m) => m.mode === 'resistance' && m.filter?.damageType === 'poison')
      )
    ).toBe(true);
    expect(effects.some((effect) => effect.modifiers.some((m) => m.target === 'save' && m.mode === 'advantage'))).toBe(true);

    syncFeatureEffectsForItem(f.ctx, room, 'lib1', [{ className: 'wizard', level: 6 }]);
    expect(t1.effects.some((effect) => effect.sourceKey?.startsWith('feature:race:'))).toBe(false);
  });
});

describe('авто-окончание эффектов по состояниям', () => {
  const bladesong = () => ({
    id: 'song',
    name: 'Пение клинка',
    duration: { type: 'rounds' as const, rounds: 10 },
    modifiers: [],
    endsOnConditions: [
      'incapacitated',
      'paralyzed',
      'stunned',
      'unconscious',
      'petrified',
      'dead',
    ] as ConditionKey[],
  });

  it('снимается, когда эффект накладывает недееспособность', () => {
    const t1 = makeToken('t1');
    const t2 = makeToken('t2');
    t1.effects.push(bladesong());
    const room = makeRoom();
    room.scene.maps[0]!.tokens = [t1, t2];
    const f = makeConnCtx(room, { dm: true });

    applyEffectTo(f.ctx, room, {
      sourceKey: 'TEST:Hold',
      sourceId: 't2',
      mapId: 'm1',
      effectDef: { name: 'Паралич', duration: { type: 'rounds', rounds: 1 }, conditions: ['paralyzed'], modifiers: [] },
      target: t1,
    });

    expect(t1.effects.some((e) => e.id === 'song')).toBe(false);
    expect(t1.conditions.some((c) => c.key === 'paralyzed')).toBe(true);
  });

  it('снимается при ручной выдаче состояния через token:update', () => {
    const t1 = makeToken('t1');
    t1.effects.push(bladesong());
    const room = makeRoom();
    room.scene.maps[0]!.tokens = [t1];
    const f = makeConnCtx(room, { dm: true });
    registerTokenHandlers(f.ctx);

    f.invoke('token:update', {
      mapId: 'm1',
      id: 't1',
      patch: { conditions: [{ key: 'incapacitated', name: 'Недееспособен', rounds: null }] },
    });

    expect(t1.conditions.some((c) => c.key === 'incapacitated')).toBe(true);
    expect(t1.effects.some((e) => e.id === 'song')).toBe(false);
  });
});

describe('Пение клинка как классовое действие', () => {
  const sheet = (): CharacterSheet => ({
    name: 'Певец клинка',
    senses: [],
    abilities: { str: 10, dex: 16, con: 12, int: 16, wis: 10, cha: 10 },
    proficiencyBonus: '2',
    saves: { int: true },
    skills: {},
    attacks: [],
    classes: [{ className: 'wizard', subclass: 'bladesinging', level: 2 }],
    spells: [],
    hpMax: '14',
    ac: '12',
    speed: 30,
    damageDefenses: [],
  });

  it('накладывает эффект и тратит бонусное действие и ресурс', () => {
    const t1 = makeToken('t1', { libraryItemId: 'lib1' });
    const room = makeCombatRoom([t1], { p1: 'lib1' });
    room.sheets.p1 = sheet();
    room.resources.p1 = makeResources({
      resources: [
        {
          id: 'bladesong',
          key: 'wizard.bladesinging:bladesong',
          name: 'Пение клинка',
          current: 2,
          max: 2,
          reset: 'long',
          auto: true,
        },
      ],
    });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:wizard.bladesinging:bladesong',
    });

    const effect = t1.effects.find((e) => e.name === 'Пение клинка');
    expect(effect?.duration).toEqual({ type: 'rounds', rounds: 10 });
    expect(effect?.modifiers[0]).toMatchObject({ target: 'ac', mode: 'add', value: 'int' });
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(room.scene.maps[0]!.combat.turns.e1!.bonusActionUsed).toBe(true);
  });
});

describe('активные черты вида', () => {
  const aasimarSheet = (): CharacterSheet => ({
    name: 'Аасимар',
    senses: [],
    abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 16 },
    proficiencyBonus: '2',
    saves: {},
    skills: {},
    attacks: [],
    classes: [{ className: 'fighter', level: 1 }],
    race: { key: 'XPHB:Aasimar' },
    spells: [],
    hpMax: '12',
    ac: '12',
    speed: 30,
    damageDefenses: [],
  });

  it('Исцеляющие руки лечат союзника и тратят ресурс', () => {
    const t1 = makeToken('t1', { libraryItemId: 'lib1' });
    const t2 = makeToken('t2', { hpMax: '20', hpCurrent: 10, faction: 'ally' });
    const room = makeCombatRoom([t1, t2], { p1: 'lib1' });
    room.sheets.p1 = aasimarSheet();
    room.resources.p1 = makeResources({
      resources: [
        {
          id: 'healing',
          key: 'race:XPHB:Aasimar:healingHands',
          name: 'Исцеляющие руки',
          current: 1,
          max: 1,
          reset: 'long',
          auto: true,
        },
      ],
    });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'race:XPHB:Aasimar:healingHands',
      targetIds: ['t2'],
    });

    expect(t2.hpCurrent).toBeGreaterThan(10);
    expect(room.resources.p1!.resources[0]!.current).toBe(0);
  });
});
