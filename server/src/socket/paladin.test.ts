import { describe, expect, it } from 'vitest';
import { LAY_ON_HANDS_ACTION, type CharacterSheet } from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { registerActionHandlers } from './actions';

function setup() {
  const caster = makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' });
  const ally = makeToken('t2', { x: 150, y: 100, faction: 'ally', hpMax: '100', hpCurrent: 20 });
  const room = makeCombatRoom([caster, ally], { p1: 'lib1' });
  room.sheets.p1 = {
    name: 'Паладин',
    abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 16 },
    classes: [{ className: 'paladin', level: 5 }],
    choices: [],
    attacks: [],
    spells: [],
    saves: {},
    skills: {},
    damageDefenses: [],
    senses: [],
    hpMax: '40',
    ac: '16',
    speed: 30,
  } as unknown as CharacterSheet;
  room.resources.p1 = makeResources({
    hp: { current: 40, max: 40, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    resources: [
      { id: 'lh', key: 'paladin:layOnHands', name: 'Наложение рук', current: 25, max: 25, reset: 'long' },
    ],
  });
  const f = makeConnCtx(room, { playerId: 'p1' });
  registerActionHandlers(f.ctx);
  return { room, f, caster, ally };
}

const pool = (room: ReturnType<typeof setup>['room']): number =>
  room.resources.p1!.resources.find((r) => r.key === 'paladin:layOnHands')!.current;

describe('Наложение рук', () => {
  it('бонусное действие лечит на выбранное количество и тратит пул', () => {
    const { room, f, ally } = setup();
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: LAY_ON_HANDS_ACTION,
      targetIds: ['t2'],
      slot: 'bonus',
      featureAmount: 10,
    });
    expect(f.selfEvents('chat:error')).toHaveLength(0);
    expect(ally.hpCurrent).toBe(30);
    expect(pool(room)).toBe(15);
    const turn = room.scene.maps[0]!.combat.turns.e1!;
    expect(turn.bonusActionUsed).toBe(true);
    expect(turn.actionUsed).toBe(false);
  });

  it('снятие отравления стоит 5 и не лечит', () => {
    const { room, f, ally } = setup();
    ally.conditions = [{ key: 'poisoned', name: 'Отравлен', rounds: null }];
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: LAY_ON_HANDS_ACTION,
      targetIds: ['t2'],
      slot: 'bonus',
      featureAmount: 5,
      variant: 'poison',
    });
    expect(f.selfEvents('chat:error')).toHaveLength(0);
    expect(ally.hpCurrent).toBe(20);
    expect(pool(room)).toBe(20);
    expect(ally.conditions.some((c) => c.key === 'poisoned')).toBe(false);
  });

  it('без отравления снятие отклоняется без траты', () => {
    const { room, f, ally } = setup();
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: LAY_ON_HANDS_ACTION,
      targetIds: ['t2'],
      slot: 'bonus',
      featureAmount: 5,
      variant: 'poison',
    });
    expect((f.selfEvents('chat:error')[0]?.payload as { code?: string })?.code).toBe('restoreNoCondition');
    expect(ally.hpCurrent).toBe(20);
    expect(pool(room)).toBe(25);
  });

  it('цель дальше касания отклоняется без траты', () => {
    const { room, f, ally } = setup();
    ally.x = 300;
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: LAY_ON_HANDS_ACTION,
      targetIds: ['t2'],
      slot: 'bonus',
      featureAmount: 10,
    });
    expect((f.selfEvents('chat:error')[0]?.payload as { code?: string })?.code).toBe('outOfRange');
    expect(pool(room)).toBe(25);
  });
});
