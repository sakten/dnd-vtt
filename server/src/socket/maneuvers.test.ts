import { describe, expect, it, vi } from 'vitest';
import { BAIT_AND_SWITCH_ACTION, type AttackEntry, type CharacterSheet, type FeatureChoice } from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { registerActionHandlers } from './actions';
import { pendingOffers, registerReactionHandlers } from './reactions';
import { applyRollBonusChoices, rollBonusOffers } from './reactions/features';
import { resolveWeaponAttack } from './attackResolve';
import { availableChoiceRiders, applyAttackRiders } from './attackRiders';

const BLADE: AttackEntry = {
  name: 'Меч',
  hit: 'd20+5',
  damage: '1d8',
  damageType: 'slashing',
  rangeType: 'melee',
  rangeNormal: 5,
  rangeLong: 0,
};

function sheet(level: number, choices: FeatureChoice[] = []): CharacterSheet {
  return {
    name: 'Воин',
    abilities: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 8 },
    classes: [{ className: 'fighter', level, subclass: 'battleMaster' }],
    choices,
    attacks: [BLADE],
    spells: [],
    saves: {},
    skills: {},
    damageDefenses: [],
    senses: [],
    hpMax: '30',
    ac: '16',
    speed: 30,
  } as unknown as CharacterSheet;
}

function dice(current = 4, knowYourEnemy = 0) {
  return {
    resources: [
      { id: 'r1', key: 'fighter.battleMaster:superiorityDice', name: 'Кости превосходства', current, max: 4, reset: 'short' as const },
      { id: 'r2', key: 'fighter.battleMaster:knowYourEnemy', name: 'Знай врага', current: knowYourEnemy, max: 1, reset: 'short' as const },
    ],
  };
}

/** Комната без боя (makeCombatRoom с выключенным боем). */
function plainRoom(tokens: ReturnType<typeof makeToken>[], controllers: Record<string, string> = {}) {
  const room = makeCombatRoom(tokens, controllers);
  room.scene.maps[0]!.combat.active = false;
  return room;
}

/** Сид Math.random на время колбэка (броски детерминированы). */
function withRandom<T>(value: number, fn: () => T): T {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

describe('Отвлекающий удар', () => {
  function setup(choices: FeatureChoice[]) {
    const attacker = makeToken('t1', { libraryItemId: 'lib1', x: 50, y: 100, faction: 'ally' });
    const target = makeToken('t2', { x: 100, y: 100, hpMax: '30', hpCurrent: 30, ac: '5', faction: 'enemy' });
    const ally = makeToken('t3', { x: 150, y: 100, faction: 'ally' });
    const room = makeCombatRoom([attacker, target, ally], { p1: 'lib1' });
    room.sheets.p1 = sheet(3, choices);
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      resources: dice().resources,
    });
    const f = makeConnCtx(room, { playerId: 'p1', all: true });
    return { attacker, target, ally, room, f };
  }

  it('окно после попадания: кость к урону и преимущество следующей чужой атаке', () => {
    const { attacker, target, ally, room, f } = setup([
      { kind: 'maneuver', key: 'XPHB:Distracting Strike' },
    ]);
    expect(availableChoiceRiders(f.ctx, room, attacker, BLADE).map((r) => r.id)).toContain(
      'fighter.battleMaster:distractingStrike'
    );

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 19, d8 8
    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    const offer = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'rider:fighter.battleMaster:distractingStrike')
    );
    expect(offer).toBeDefined();

    const responder = makeConnCtx(room, { playerId: 'p1' });
    registerReactionHandlers(responder.ctx);
    responder.invoke('reaction:respond', { id: offer!.id, optionId: 'rider:fighter.battleMaster:distractingStrike' });
    rand.mockRestore();

    expect(target.hpCurrent).toBe(14); // 30 − (1d8 8 + кость 1d8 8)
    expect(room.resources.p1!.resources[0]!.current).toBe(3);
    const effect = target.effects.find((e) => e.sourceKey === 'rider:fighter.battleMaster:distractingStrike');
    expect(effect?.consumeOnIncomingAttack).toBe(true);
    expect(effect?.modifiers[0]?.filter).toMatchObject({ direction: 'against', otherThanSource: true });

    // Своя атака источника: без преимущества и без расхода эффекта.
    withRandom(0.9, () =>
      resolveWeaponAttack(f.ctx, {
        attacker,
        attackerMapId: 'm1',
        target,
        targetMapId: 'm1',
        attack: BLADE,
        author: 'A',
        ignoreRange: true,
      })
    );
    expect(target.effects.some((e) => e.sourceKey === 'rider:fighter.battleMaster:distractingStrike')).toBe(true);
    const ownRoll = [...f.emitted]
      .reverse()
      .map((e) => e.payload as { kind?: string; rollKind?: string; roll?: { expression?: string } })
      .find((m) => m.kind === 'roll' && m.rollKind === 'attack');
    expect(ownRoll?.roll?.expression).not.toContain('d20a');

    // Чужая атака: преимущество и сгорание эффекта.
    withRandom(0.5, () =>
      resolveWeaponAttack(f.ctx, {
        attacker: ally,
        attackerMapId: 'm1',
        target,
        targetMapId: 'm1',
        attack: BLADE,
        author: 'B',
        ignoreRange: true,
      })
    );
    expect(target.effects.some((e) => e.sourceKey === 'rider:fighter.battleMaster:distractingStrike')).toBe(false);
    const allyRoll = [...f.emitted]
      .reverse()
      .map((e) => e.payload as { kind?: string; rollKind?: string; roll?: { expression?: string } })
      .find((m) => m.kind === 'roll' && m.rollKind === 'attack');
    expect(allyRoll?.roll?.expression).toContain('d20a');
  });

  it('без выбранного манёвра вариант не предлагается', () => {
    const { attacker, room, f } = setup([]);
    expect(availableChoiceRiders(f.ctx, room, attacker, BLADE).map((r) => r.id)).not.toContain(
      'fighter.battleMaster:distractingStrike'
    );
    expect(applyAttackRiders(f.ctx, room, attacker, 'm1', null, ['fighter.battleMaster:distractingStrike']).expr).toBe('');
  });
});

describe('Точный удар', () => {
  const PRECISION_OPTION = 'feature:fighter.battleMaster:precisionAttack:self';

  function setup(choices: FeatureChoice[], extra: ReturnType<typeof makeToken>[] = []) {
    const attacker = makeToken('t1', { libraryItemId: 'lib1', x: 50, y: 100 });
    const room = plainRoom([attacker, ...extra], { p1: 'lib1' });
    room.sheets.p1 = { ...sheet(5, choices), hpMax: '30' };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      resources: dice().resources,
    });
    return { attacker, room, f: makeConnCtx(room, { playerId: 'p1' }) };
  }

  it('предлагается своему промаху и добавляет кость к броску', () => {
    const { attacker, room, f } = setup([{ kind: 'maneuver', key: 'XPHB:Precision Attack' }]);
    const offers = rollBonusOffers(f.ctx, room, { attacker, attackerMapId: 'm1' });
    const option = offers.flatMap((o) => o.options).find((o) => o.id === PRECISION_OPTION);
    expect(option).toBeDefined();

    const bonus = withRandom(0.9, () =>
      applyRollBonusChoices(f.ctx, room, [{ optionId: PRECISION_OPTION, mapId: 'm1', tokenId: 't1' }])
    );
    expect(bonus).toBe(8); // 1d8
    expect(room.resources.p1!.resources[0]!.current).toBe(3);
    const message = f.emitted
      .filter((e) => e.event === 'chat:message')
      .map((e) => e.payload as { kind?: string; roll?: { total: number }; labelParams?: { subject?: string } })
      .find((m) => m.kind === 'roll' && m.labelParams?.subject?.includes('Точный удар'));
    expect(message?.roll?.total).toBe(8);
  });

  it('без выбранного манёвра окно не предлагает вариант', () => {
    const { attacker, room, f } = setup([]);
    const offers = rollBonusOffers(f.ctx, room, { attacker, attackerMapId: 'm1' });
    expect(offers.flatMap((o) => o.options).some((o) => o.id === PRECISION_OPTION)).toBe(false);
  });

  it('союзнику не предлагается: бонус только себе', () => {
    const ally = makeToken('t2', { x: 150, y: 100, faction: 'ally' });
    const { room, f } = setup([{ kind: 'maneuver', key: 'XPHB:Precision Attack' }], [ally]);
    const offers = rollBonusOffers(f.ctx, room, { attacker: ally, attackerMapId: 'm1' });
    expect(offers.flatMap((o) => o.options).some((o) => o.id === PRECISION_OPTION)).toBe(false);
  });
});

describe('Приманка и подмена', () => {
  function setup(variant: 'self' | 'ally') {
    const fighter = makeToken('t1', { libraryItemId: 'lib1', x: 50, y: 100, faction: 'ally' });
    const ally = makeToken('t2', { x: 100, y: 100, faction: 'ally' });
    const room = makeCombatRoom([fighter, ally], { p1: 'lib1' });
    room.sheets.p1 = sheet(5, [{ kind: 'maneuver', key: 'XPHB:Bait and Switch' }]);
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      resources: dice().resources,
    });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    withRandom(0.9, () =>
      f.invoke('action:use', {
        mapId: 'm1',
        tokenId: 't1',
        actionId: BAIT_AND_SWITCH_ACTION,
        targetIds: ['t2'],
        slot: 'bonus',
        variant,
      })
    );
    return { fighter, ally, room, f };
  }

  it('обменивает местами, тратит 5 фт движения и даёт AC союзнику', () => {
    const { fighter, ally, room } = setup('ally');
    expect(fighter.x).toBe(100);
    expect(ally.x).toBe(50);
    expect(room.scene.maps[0]!.combat.turns.e1!.movementUsed).toBe(5);
    expect(room.resources.p1!.resources[0]!.current).toBe(3);
    const effect = ally.effects.find((e) => e.sourceKey === BAIT_AND_SWITCH_ACTION);
    expect(effect?.modifiers[0]).toMatchObject({ target: 'ac', mode: 'add', value: 8 });
    expect(fighter.effects.some((e) => e.sourceKey === BAIT_AND_SWITCH_ACTION)).toBe(false);
  });

  it('вариант «себе» вешает AC на воина', () => {
    const { fighter, ally } = setup('self');
    expect(fighter.effects.find((e) => e.sourceKey === BAIT_AND_SWITCH_ACTION)?.modifiers[0]).toMatchObject({
      target: 'ac',
      mode: 'add',
      value: 8,
    });
    expect(ally.effects.some((e) => e.sourceKey === BAIT_AND_SWITCH_ACTION)).toBe(false);
  });

  it('две подошвы 2×2 меняются местами зеркально', () => {
    const fighter = makeToken('t1', {
      libraryItemId: 'lib1',
      x: 100,
      y: 100,
      cells: 2,
      w: 100,
      h: 100,
      faction: 'ally',
    });
    const ally = makeToken('t2', { x: 200, y: 100, cells: 2, w: 100, h: 100, faction: 'ally' });
    const room = makeCombatRoom([fighter, ally], { p1: 'lib1' });
    room.sheets.p1 = sheet(5, [{ kind: 'maneuver', key: 'XPHB:Bait and Switch' }]);
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      resources: dice().resources,
    });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    withRandom(0.9, () =>
      f.invoke('action:use', {
        mapId: 'm1',
        tokenId: 't1',
        actionId: BAIT_AND_SWITCH_ACTION,
        targetIds: ['t2'],
        slot: 'bonus',
        variant: 'ally',
      })
    );
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(false);
    expect(fighter.x).toBe(200);
    expect(ally.x).toBe(100);
    expect(room.scene.maps[0]!.combat.turns.e1!.movementUsed).toBe(5);
    expect(room.resources.p1!.resources[0]!.current).toBe(3);
    expect(ally.effects.find((e) => e.sourceKey === BAIT_AND_SWITCH_ACTION)?.modifiers[0]).toMatchObject({
      target: 'ac',
      mode: 'add',
      value: 8,
    });
  });

  it('1×1 и 2×2 меняются минимальным сдвигом без пересечений', () => {
    const fighter = makeToken('t1', { libraryItemId: 'lib1', x: 125, y: 25, faction: 'ally' });
    const large = makeToken('t2', { x: 100, y: 100, cells: 2, w: 100, h: 100, faction: 'ally' });
    const room = makeCombatRoom([fighter, large], { p1: 'lib1' });
    room.sheets.p1 = sheet(5, [{ kind: 'maneuver', key: 'XPHB:Bait and Switch' }]);
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      resources: dice().resources,
    });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    withRandom(0.9, () =>
      f.invoke('action:use', {
        mapId: 'm1',
        tokenId: 't1',
        actionId: BAIT_AND_SWITCH_ACTION,
        targetIds: ['t2'],
        slot: 'bonus',
        variant: 'ally',
      })
    );
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(false);
    // Большой накрывает старую клетку меньшего, меньший — в дальней свободной клетке старой области.
    expect(large.x).toBe(100);
    expect(large.y).toBe(50);
    expect(fighter.x).toBe(125);
    expect(fighter.y).toBe(125);
    expect(room.scene.maps[0]!.combat.turns.e1!.movementUsed).toBe(5);
    expect(room.resources.p1!.resources[0]!.current).toBe(3);
    expect(large.effects.find((e) => e.sourceKey === BAIT_AND_SWITCH_ACTION)?.modifiers[0]).toMatchObject({
      target: 'ac',
      mode: 'add',
      value: 8,
    });
  });

  it('смешанный обмен через стену — отказ без траты', () => {
    const fighter = makeToken('t1', { libraryItemId: 'lib1', x: 125, y: 25, faction: 'ally' });
    const large = makeToken('t2', { x: 100, y: 100, cells: 2, w: 100, h: 100, faction: 'ally' });
    const room = makeCombatRoom([fighter, large], { p1: 'lib1' });
    room.scene.maps[0]!.walls = [{ id: 'w1', kind: 'wall', x1: 0, y1: 50, x2: 300, y2: 50 }];
    room.sheets.p1 = sheet(5, [{ kind: 'maneuver', key: 'XPHB:Bait and Switch' }]);
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      resources: dice().resources,
    });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: BAIT_AND_SWITCH_ACTION,
      targetIds: ['t2'],
      slot: 'bonus',
      variant: 'ally',
    });
    const error = f.emitted.find((e) => e.event === 'chat:error')?.payload as { code?: string } | undefined;
    expect(error?.code).toBe('swapNoSpace');
    expect(room.resources.p1!.resources[0]!.current).toBe(4);
    expect(room.scene.maps[0]!.combat.turns.e1!.movementUsed).toBe(0);
    expect(fighter.x).toBe(125);
    expect(large.x).toBe(100);
  });

  it('цель слишком далеко — ошибка без траты бонуса и кости', () => {
    const fighter = makeToken('t1', { libraryItemId: 'lib1', x: 50, y: 100, faction: 'ally' });
    const ally = makeToken('t2', { x: 250, y: 100, faction: 'ally' });
    const room = makeCombatRoom([fighter, ally], { p1: 'lib1' });
    room.sheets.p1 = sheet(5, [{ kind: 'maneuver', key: 'XPHB:Bait and Switch' }]);
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      resources: dice().resources,
    });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: BAIT_AND_SWITCH_ACTION,
      targetIds: ['t2'],
      slot: 'bonus',
      variant: 'ally',
    });
    const error = f.emitted.find((e) => e.event === 'chat:error')?.payload as { code?: string } | undefined;
    expect(error?.code).toBe('outOfRange');
    expect(room.resources.p1!.resources[0]!.current).toBe(4);
    expect(room.scene.maps[0]!.combat.turns.e1!.bonusActionUsed).toBe(false);
    expect(room.scene.maps[0]!.combat.turns.e1!.movementUsed).toBe(0);
  });

  it('враждебная цель не соглашается — отказ без траты', () => {
    const fighter = makeToken('t1', { libraryItemId: 'lib1', x: 50, y: 100, faction: 'ally' });
    const enemy = makeToken('t2', { x: 100, y: 100, faction: 'enemy' });
    const room = makeCombatRoom([fighter, enemy], { p1: 'lib1' });
    room.sheets.p1 = sheet(5, [{ kind: 'maneuver', key: 'XPHB:Bait and Switch' }]);
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      resources: dice().resources,
    });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    withRandom(0.9, () =>
      f.invoke('action:use', {
        mapId: 'm1',
        tokenId: 't1',
        actionId: BAIT_AND_SWITCH_ACTION,
        targetIds: ['t2'],
        slot: 'bonus',
        variant: 'ally',
      })
    );
    const error = f.emitted.find((e) => e.event === 'chat:error')?.payload as { code?: string } | undefined;
    expect(error?.code).toBe('targetUnwilling');
    expect(room.resources.p1!.resources[0]!.current).toBe(4);
    expect(room.scene.maps[0]!.combat.turns.e1!.bonusActionUsed).toBe(false);
    expect(room.scene.maps[0]!.combat.turns.e1!.movementUsed).toBe(0);
    expect(fighter.x).toBe(50);
    expect(enemy.x).toBe(100);
  });
});

describe('Знай врага', () => {
  it('раскрывает защиты цели в чат и восстанавливается костью', () => {
    const fighter = makeToken('t1', { libraryItemId: 'lib1', x: 50, y: 100 });
    const monster = makeToken('t2', {
      x: 100,
      y: 100,
      faction: 'enemy',
      damageDefenses: [
        { id: 'd1', type: 'immunity', damageType: 'poison' },
        { id: 'd2', type: 'resistance', damageType: 'fire' },
        { id: 'd3', type: 'vulnerability', damageType: 'cold' },
      ],
    });
    const room = plainRoom([fighter, monster], { p1: 'lib1' });
    room.sheets.p1 = sheet(7);
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      resources: dice(4, 1).resources,
    });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:fighter.battleMaster:knowYourEnemy',
      targetIds: ['t2'],
    });
    const messages = f.emitted
      .filter((e) => e.event === 'chat:message')
      .map((e) => e.payload as { system?: { code: string; params?: Record<string, string> } })
      .filter((m) => m.system?.code === 'features.knowYourEnemy');
    expect(messages).toHaveLength(1);
    expect(messages[0]?.system?.params).toMatchObject({
      target: 't2',
      immunities: 'poison',
      resistances: 'fire',
      vulnerabilities: 'cold',
    });
    expect(room.resources.p1!.resources[1]!.current).toBe(0);
    expect(room.resources.p1!.resources[0]!.current).toBe(4);

    // Второе использование — за кость превосходства.
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:fighter.battleMaster:knowYourEnemy',
      targetIds: ['t2'],
    });
    expect(room.resources.p1!.resources[0]!.current).toBe(3);
    expect(
      f.emitted
        .filter((e) => e.event === 'chat:message')
        .map((e) => e.payload as { system?: { code: string } })
        .filter((m) => m.system?.code === 'features.knowYourEnemy')
    ).toHaveLength(2);
  });
});
