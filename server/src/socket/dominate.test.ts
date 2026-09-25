import { describe, expect, it } from 'vitest';
import { automationForSpell, emptyTurnState, type Token } from 'shared';
import { findSpell } from '../spells';
import { makeConnCtx } from '../test/ctx';
import { makeCombatRoom, makeRoom, makeToken } from '../test/fixtures';
import { applyEffectTo } from './effectsApply';
import { validateSpellCast, type SpellCastInput } from './spellResolve';

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

const beast = (over: Partial<Token> = {}): Token =>
  makeToken('t2', {
    x: 150,
    y: 100,
    faction: 'enemy',
    statblock: { abilities, creatureType: 'beast' },
    ...over,
  });

function castInput(caster: Token, targets: Token[], key: string, level: number): SpellCastInput {
  return {
    caster,
    mapId: 'm1',
    spell: findSpell(key)!,
    castLevel: level,
    characterLevel: level,
    stats: null,
    targets,
    author: 'DM',
  };
}

describe('Dominate Beast/Person', () => {
  it('валидация: только свой тип существ и не союзник', () => {
    const caster = makeToken('t1', { x: 100, y: 100, faction: 'ally', libraryItemId: 'lib1' });
    const enemyBeast = beast();
    const allyBeast = beast({ id: 't3', faction: 'ally' });
    const undead = beast({ id: 't4', statblock: { abilities, creatureType: 'undead' } });
    const room = makeRoom();
    room.scene.maps[0]!.tokens.push(caster, enemyBeast, allyBeast, undead);
    makeConnCtx(room, { dm: true });

    const input = castInput(caster, [enemyBeast], 'XPHB:Dominate Beast', 4);
    expect(validateSpellCast(room, input)).toBeUndefined();
    expect(validateSpellCast(room, { ...input, targets: [allyBeast] })).toEqual({ code: 'spellNoTarget' });
    expect(validateSpellCast(room, { ...input, targets: [undead] })).toEqual({ code: 'spellNoTarget' });
    expect(
      validateSpellCast(room, { ...input, spell: findSpell('XPHB:Dominate Person')!, targets: [enemyBeast] })
    ).toEqual({ code: 'spellNoTarget' });
  });

  it('контроль: цель под кастером, после снятия — прежняя фракция', () => {
    const room = makeRoom();
    const caster = makeToken('t1', { x: 100, y: 100, faction: 'ally', libraryItemId: 'lib1' });
    const target = beast();
    room.scene.maps[0]!.tokens.push(caster, target);
    room.controllers['p1'] = 'lib1';
    room.controllers['p2'] = 'lib2';
    const f = makeConnCtx(room, { dm: true });
    const effectDef = automationForSpell(findSpell('XPHB:Dominate Beast')!, { castLevel: 4 }).effects![0]!;
    applyEffectTo(f.ctx, room, {
      sourceKey: 'XPHB:Dominate Beast',
      sourceId: caster.id,
      mapId: 'm1',
      effectDef,
      target,
      untilSaveDc: 14,
    });

    expect(target.faction).toBe('ally');
    expect(target.effects[0]?.dominates).toBe(true);
    expect(target.effects[0]?.prevFaction).toBe('enemy');
    expect(f.ctx.manager.controlsToken(room, 'm1', 'p1', target)).toBe(true);
    expect(f.ctx.manager.controlsToken(room, 'm1', 'p2', target)).toBe(false);

    f.ctx.manager.removeEffect(room, target, target.effects[0]!.id);
    expect(target.faction).toBe('enemy');
    expect(f.ctx.manager.controlsToken(room, 'm1', 'p1', target)).toBe(false);
  });

  it('реакция цели тратит реакцию кастера', () => {
    const caster = makeToken('t1', { x: 100, y: 100, faction: 'ally', libraryItemId: 'lib1' });
    const target = beast();
    const room = makeCombatRoom([caster, target], { p1: 'lib1' });
    const combat = room.scene.maps[0]!.combat!;
    combat.entries.push({ id: 'e2', tokenId: target.id, name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combat.turns['e2'] = { ...emptyTurnState(30), movementUsed: 0 };
    target.effects.push({
      id: 'd1',
      name: 'Dominate Beast',
      sourceKey: 'XPHB:Dominate Beast',
      sourceId: caster.id,
      concentration: true,
      duration: { type: 'concentration' },
      modifiers: [],
      dominates: true,
    });
    const f = makeConnCtx(room, { dm: true });

    expect(f.ctx.manager.spendSlot(room, 'm1', target, 'reaction')).toBe(true);
    expect(combat.turns['e2']?.reactionUsed).toBe(true);
    expect(combat.turns['e1']?.reactionUsed).toBe(true);
    expect(f.ctx.manager.spendSlot(room, 'm1', target, 'reaction')).toBe(false);
  });
});
