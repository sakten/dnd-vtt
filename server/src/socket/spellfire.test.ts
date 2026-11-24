import { describe, expect, it } from 'vitest';
import { automationForSpell, normalizeSheet } from 'shared';
import { makeCombatRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { findSpell } from '../spells';
import { pendingOffers, registerReactionHandlers } from './reactions';
import { registerSpellHandlers } from './spells';
import { applySpellfire, spellfireOptions } from './spellfire';

function setup() {
  const caster = makeToken('t1', { libraryItemId: 'lib1', name: 'Kobold', faction: 'ally' });
  const room = makeCombatRoom([caster], { p1: 'lib1' });
  room.sheets.p1 = normalizeSheet({ choices: [{ kind: 'feat', key: 'FRHoF:spellfireAdept' }] });
  room.resources.p1 = makeResources({
    hitDice: [{ die: 8, current: 2, max: 2 }],
  });
  const f = makeConnCtx(room, { playerId: 'p1', all: true });
  const def = automationForSpell(findSpell('XPHB:Sacred Flame')!);
  return { room, caster, f, def };
}

describe('Fueled Spellfire', () => {
  it('предлагает 1–2 кости хитов на урон излучением и тратит их раз в ход', () => {
    const { room, caster, f, def } = setup();
    expect(spellfireOptions(room, 'm1', caster, def)).toEqual([1, 2]);

    const bonus = applySpellfire(f.ctx, room, 'm1', caster, 1);
    expect(bonus).toBeGreaterThanOrEqual(1);
    expect(bonus).toBeLessThanOrEqual(8);
    expect(room.resources.p1!.hitDice[0]!.current).toBe(1);
    expect(spellfireOptions(room, 'm1', caster, def)).toBeNull();
  });

  it('не предлагает без фита или на урон другого типа', () => {
    const { room, caster } = setup();
    const fireball = automationForSpell(findSpell('XPHB:Fireball')!);
    expect(spellfireOptions(room, 'm1', caster, fireball)).toBeNull();

    const plain = setup();
    plain.room.sheets.p1 = normalizeSheet({});
    expect(spellfireOptions(plain.room, 'm1', plain.caster, plain.def)).toBeNull();
  });

  it('окно выбора костей хитов открывается при касте Sacred Flame', () => {
    const caster = makeToken('t1', { libraryItemId: 'lib1', name: 'Kobold', faction: 'ally' });
    const target = makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30, faction: 'enemy' });
    const room = makeCombatRoom([caster, target], { p1: 'lib1' });
    room.sheets.p1 = normalizeSheet({
      classes: [{ className: 'cleric', level: 1 }],
      spells: [{ key: 'XPHB:Sacred Flame', className: 'cleric' }],
      choices: [{ kind: 'feat', key: 'FRHoF:spellfireAdept' }],
    });
    room.resources.p1 = makeResources({ hitDice: [{ die: 8, current: 2, max: 2 }] });
    const f = makeConnCtx(room, { playerId: 'p1', all: true });
    registerSpellHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Sacred Flame',
      targetIds: ['t2'],
    });
    const offer = pendingOffers('TEST').find((o) => o.options.some((op) => op.id === 'spellfire:1'));
    expect(offer).toBeDefined();

    const responder = makeConnCtx(room, { playerId: 'p1' });
    registerReactionHandlers(responder.ctx);
    responder.invoke('reaction:respond', { id: offer!.id, optionId: 'spellfire:1' });
    expect(room.resources.p1!.hitDice[0]!.current).toBe(1);
  });

  it('True Strike и доп. урон Celestial Revelation считаются излучением', () => {
    const { room, caster } = setup();
    const trueStrike = automationForSpell(findSpell('XPHB:True Strike')!, { characterLevel: 5 });
    expect(spellfireOptions(room, 'm1', caster, trueStrike)).toEqual([1, 2]);

    caster.effects.push({
      id: 'rev',
      name: 'Небесные крылья',
      duration: { type: 'rounds', rounds: 10 },
      modifiers: [],
      extraDamageDealt: { amount: 3, damageType: 'radiant', oncePerTurn: true },
    });
    const fireball = automationForSpell(findSpell('XPHB:Fireball')!);
    expect(spellfireOptions(room, 'm1', caster, fireball)).toEqual([1, 2]);
  });

  it('многолучевой урон тоже предлагает Fueled (бонус — в первый луч)', () => {
    const { room, caster } = setup();
    const base = automationForSpell(findSpell('XPHB:Sacred Flame')!);
    const multi = { ...base, count: 2 };
    expect(spellfireOptions(room, 'm1', caster, multi)).toEqual([1, 2]);
  });
});
