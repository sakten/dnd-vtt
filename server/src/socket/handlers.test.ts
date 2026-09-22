import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ABILITIES,
  DEFAULT_SPEED,
  type AutomationDef,
  type CharacterSheet,
  type PlayerResources,
  type AttackEntry,
  type TokenStatblock,
} from 'shared';
import type { Room } from '../roomTypes';
import { actorStats } from '../room/actor';
import { makeCombatRoom as makeRoom, makeResources, makeToken } from '../test/fixtures';
import { makeConnCtx as makeCtx } from '../test/ctx';
import { registerCombatHandlers } from './combat';
import { registerLibraryHandlers } from './library';
import { registerRoomHandlers } from './room';
import { registerTokenHandlers } from './token';
import { registerActionHandlers } from './actions';
import { resolveWeaponAttack } from './attackResolve';
import { applyAttackRiders } from './attackRiders';
import { registerResourceHandlers } from './resources';
import { registerSpellHandlers } from './spells';
import { registerDiceHandlers } from './dice';
import { registerRollAnimHandlers } from './rollAnim';
import { openReactionWindow, pendingOffers, registerReactionHandlers } from './reactions';
import { registerSheetHandlers } from './sheet';
import { createZoneFromDef } from './zones';

const combatOf = (room: Room) => room.scene.maps[0]!.combat;

describe('combat:endTurn', () => {
  it('игрок, управляющий активным токеном, может завершить ход', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerCombatHandlers(f.ctx);

    f.invoke('combat:endTurn', { mapId: 'm1' });
    expect(combatOf(room).round).toBe(2);
  });

  it('чужой игрок не может завершить ход', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p2: 'lib2' });
    const f = makeCtx(room, { playerId: 'p2' });
    registerCombatHandlers(f.ctx);

    // активируем второй токен, чтобы был куда перейти
    room.scene.maps[0]!.tokens.push(makeToken('t2'));
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    f.invoke('combat:endTurn', { mapId: 'm1' });
    expect(combatOf(room).currentIndex).toBe(0);
    expect(combatOf(room).round).toBe(1);
  });

  it('DM завершает ход', () => {
    const room = makeRoom([makeToken('t1'), makeToken('t2')], {});
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    const f = makeCtx(room, { dm: true });
    registerCombatHandlers(f.ctx);

    f.invoke('combat:endTurn', { mapId: 'm1' });
    expect(combatOf(room).currentIndex).toBe(1);
  });
});

describe('combat:setTurn / setMovement', () => {
  it('setTurn доступен только DM', () => {
    const room = makeRoom([makeToken('t1'), makeToken('t2')], {});
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });

    const player = makeCtx(room, { playerId: 'p1' });
    registerCombatHandlers(player.ctx);
    player.invoke('combat:setTurn', { mapId: 'm1', id: 'e2' });
    expect(combatOf(room).currentIndex).toBe(0);

    const dm = makeCtx(room, { dm: true });
    registerCombatHandlers(dm.ctx);
    dm.invoke('combat:setTurn', { mapId: 'm1', id: 'e2' });
    expect(combatOf(room).currentIndex).toBe(1);
  });

  it('setMovement принимает от контролёра активного токена и от DM', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const player = makeCtx(room, { playerId: 'p1' });
    registerCombatHandlers(player.ctx);
    player.invoke('combat:setMovement', { mapId: 'm1', tokenId: 't1', used: 20, diagonals: 2 });
    expect(combatOf(room).turns.e1!.movementUsed).toBe(20);
    expect(combatOf(room).turns.e1!.diagonalsUsed).toBe(2);
  });

  it('setMovement чужого игрока игнорируется', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p2: 'lib2' });
    const f = makeCtx(room, { playerId: 'p2' });
    registerCombatHandlers(f.ctx);
    f.invoke('combat:setMovement', { mapId: 'm1', tokenId: 't1', used: 20 });
    expect(combatOf(room).turns.e1!.movementUsed).toBe(0);
  });
});

describe('action:use', () => {
  it('фит Tough из выборов даёт скрытый эффект +2 HP за уровень', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const sheet: CharacterSheet = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 6 }],
      spells: [],
      choices: [{ kind: 'feat', key: 'XPHB:tough' }],
    };
    room.sheets.p1 = sheet;
    const f = makeCtx(room, { playerId: 'p1' });
    registerSheetHandlers(f.ctx);

    f.invoke('sheet:update', sheet);

    const effect = room.scene.maps[0]!.tokens[0]!.effects.find((e) => e.sourceKey === 'feature:XPHB:tough#0');
    expect(effect?.modifiers[0]).toMatchObject({ target: 'maxHp', mode: 'add', value: 12 });
    expect(effect?.hidden).toBe(true);
  });

  it('Рывок тратит действие и добавляет передвижение', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1', speed: 30 })], { p1: 'lib1' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dash', slot: 'action' });

    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
    expect(combatOf(room).turns.e1!.movementMax).toBe(60);
    expect(room.chat.some((m) => m.kind === 'text' && m.system?.code === 'automation.extraMovement')).toBe(true);
  });

  it('Expeditious Retreat: Рывок из эффекта тратит бонусное действие', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1', speed: 30 })], { p1: 'lib1' });
    room.scene.maps[0]!.tokens[0]!.effects.push({
      id: 'er1',
      name: 'Expeditious Retreat',
      duration: { type: 'concentration' },
      concentration: true,
      modifiers: [],
      actions: [{ id: 'dash', name: 'Рывок', cost: 'bonus', baseActionId: 'dash' }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'spell:er1:dash' });

    expect(combatOf(room).turns.e1!.bonusActionUsed).toBe(true);
    expect(combatOf(room).turns.e1!.actionUsed).toBe(false);
    expect(combatOf(room).turns.e1!.movementMax).toBe(60);
  });

  it('выданное действие без эффекта не тратит слот', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1', speed: 30 })], { p1: 'lib1' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'spell:missing:dash' });

    expect(combatOf(room).turns.e1!.bonusActionUsed).toBe(false);
  });

  it("Dragon's Breath: Выдох из эффекта — конус, спас DEX и урон", () => {
    const caster = makeToken('t1', {
      libraryItemId: 'lib1',
      x: 100,
      y: 100,
      statblock: {
        abilities: { ...DEFAULT_ABILITIES },
        spellcasting: { ability: 'int', dc: 13, spells: [] },
        actions: [],
      },
    });
    const target = makeToken('t2', { x: 100, y: 200, hpMax: '30', hpCurrent: 30 });
    const room = makeRoom([caster, target], { p1: 'lib1' });
    caster.effects.push({
      id: 'db1',
      name: "Dragon's Breath",
      sourceId: 't1',
      duration: { type: 'concentration' },
      concentration: true,
      modifiers: [],
      actions: [
        {
          id: 'breath',
          name: 'Выдох',
          cost: 'action',
          def: {
            key: "XPHB:Dragon's Breath",
            name: 'Выдох',
            resolution: 'save',
            save: { ability: 'dex', half: true },
            damage: { dice: '3d6', types: ['cold'] },
            area: { shape: 'cone', size: 15 },
            targeting: { kind: 'area', area: { shape: 'cone', size: 15 }, range: 15 },
          },
        },
      ],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);

    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'spell:db1:breath',
      origin: { x: 100, y: 100 },
      direction: { x: 100, y: 400 },
    });
    rand.mockRestore();

    expect(target.hpCurrent).toBeLessThan(30);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'save')).toBe(true);
    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
  });

  it("Dragon's Breath: каст вешает действие, Выдох кидает спас по врагу", () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, hpMax: '20', hpCurrent: 20 }),
        makeToken('t2', { x: 100, y: 200, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: "XPHB:Dragon's Breath", className: 'wizard' }] };
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerActionHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: "XPHB:Dragon's Breath",
      slotLevel: 3,
      targetIds: ['t1'],
      variant: 'cold',
    });

    const breath = room.scene.maps[0]!.tokens[0]!.effects.find((e) => e.sourceKey === "XPHB:Dragon's Breath");
    expect(breath?.variant).toBe('cold');
    expect(breath?.actions?.[0]?.def?.damage).toMatchObject({ types: ['cold'] });

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: `spell:${breath!.id}:breath`,
      origin: { x: 100, y: 100 },
      direction: { x: 100, y: 400 },
    });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBeLessThan(30);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'save')).toBe(true);
  });

  it('Vampiric Touch: атака лечит кастера на половину урона', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 100, y: 150, hpMax: '40', hpCurrent: 40, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Vampiric Touch', className: 'wizard' }] };
    room.resources.p1 = makeResources({
      hp: { current: 10, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 3, current: 1, max: 1 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerActionHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Vampiric Touch',
      slotLevel: 3,
      targetIds: ['t2'],
    });
    rand.mockRestore();

    const target = room.scene.maps[0]!.tokens[1]!;
    expect(target.hpCurrent).toBeLessThan(40);
    expect(room.resources.p1!.hp.current).toBeGreaterThan(10);
    const effect = room.scene.maps[0]!.tokens[0]!.effects.find((e) => e.sourceKey === 'XPHB:Vampiric Touch');
    expect(effect?.actions?.[0]?.id).toBe('touch');
    expect(room.chat.some((m) => m.kind === 'text' && m.system?.code === 'automation.lifesteal')).toBe(true);
  });

  it('Conjure Woodland Beings: аура бьёт только врагов', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { x: 130, y: 120, hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t3', { x: 120, y: 130, hpMax: '30', hpCurrent: 30, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Conjure Woodland Beings', className: 'wizard' }] };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 4, current: 1, max: 1 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Conjure Woodland Beings',
      slotLevel: 4,
    });
    rand.mockRestore();

    const tokens = room.scene.maps[0]!.tokens;
    expect(tokens[1]!.hpCurrent).toBe(30);
    expect(tokens[2]!.hpCurrent).toBeLessThan(30);
    expect(room.scene.maps[0]!.zones).toHaveLength(1);
  });

  it('Sunbeam: каст бьёт линией, слепит и вешает повтор действием', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 100, y: 200, hpMax: '40', hpCurrent: 40, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Sunbeam', className: 'wizard' }] };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 6, current: 1, max: 1 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Sunbeam',
      slotLevel: 6,
      origin: { x: 100, y: 100 },
      direction: { x: 100, y: 400 },
    });
    rand.mockRestore();

    const tokens = room.scene.maps[0]!.tokens;
    expect(tokens[1]!.hpCurrent).toBeLessThan(40);
    expect(tokens[1]!.conditions.some((c) => c.key === 'blinded')).toBe(true);
    const effect = tokens[0]!.effects.find((e) => e.sourceKey === 'XPHB:Sunbeam' && e.concentration);
    expect(effect?.actions?.[0]?.id).toBe('beam');
  });

  it('Heat Metal: авто-урон с помехой и повтор бонусным действием', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { x: 100, y: 150, hpMax: '40', hpCurrent: 40, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Heat Metal', className: 'wizard' }] };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 3, current: 2, max: 2 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerActionHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Heat Metal',
      slotLevel: 3,
      targetIds: ['t2'],
    });
    rand.mockRestore();

    const tokens = room.scene.maps[0]!.tokens;
    const target = tokens[1]!;
    expect(target.hpCurrent).toBeLessThan(40);
    const holding = target.effects.find((e) => e.sourceKey === 'XPHB:Heat Metal' && !e.concentration);
    expect(holding?.modifiers.map((m) => [m.target, m.mode])).toEqual([
      ['attack', 'disadvantage'],
      ['check', 'disadvantage'],
    ]);
    const effect = tokens[0]!.effects.find((e) => e.sourceKey === 'XPHB:Heat Metal' && e.concentration);
    const burn = effect?.actions?.[0];
    expect(burn?.cost).toBe('bonus');

    const before = target.hpCurrent;
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: `spell:${effect!.id}:burn`,
      targetIds: ['t2'],
    });

    expect(target.hpCurrent).toBeLessThan(before);
    expect(combatOf(room).turns.e1!.bonusActionUsed).toBe(true);
  });

  it('Eldritch Blast: Agonizing добавляет мод. характеристики к урону', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { x: 200, y: 100, hpMax: '30', hpCurrent: 30, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 },
      classes: [{ className: 'warlock', level: 1 }],
      invocations: ['XPHB:Agonizing Blast'],
      spells: [{ key: 'XPHB:Eldritch Blast', className: 'warlock' }],
    };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Eldritch Blast',
      targetIds: ['t2'],
    });
    rand.mockRestore();

    // 1d10(1) + мод. Харизмы 4 = 5.
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(25);
  });

  it("Hex: метка переносится на новую цель после смерти старой", () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { x: 100, y: 150, hpMax: '10', hpCurrent: 10, faction: 'enemy' }),
        makeToken('t3', { x: 100, y: 300, hpMax: '10', hpCurrent: 10, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Hex', className: 'wizard' }] };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 1, current: 1, max: 1 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerActionHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Hex', slotLevel: 1, targetIds: ['t2'] });

    const tokens = room.scene.maps[0]!.tokens;
    const mark = tokens[0]!.effects.find((e) => e.sourceKey === 'XPHB:Hex' && e.modifiers.length)!;
    expect(mark.modifiers[0]?.filter?.targetId).toBe('t2');
    const chip = tokens[1]!.effects.find((e) => e.sourceKey === 'XPHB:Hex' && !e.modifiers.length);
    expect(chip?.mark).toBe(true);

    tokens[1]!.hpCurrent = 0;
    combatOf(room).turns.e1!.bonusActionUsed = false; // перенос — на следующем ходу
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: `spell:${mark.id}:remark`,
      targetIds: ['t3'],
    });

    expect(mark.modifiers[0]?.filter?.targetId).toBe('t3');
    expect(tokens[1]!.effects.some((e) => e.sourceKey === 'XPHB:Hex' && !e.modifiers.length)).toBe(false);
    expect(tokens[2]!.effects.find((e) => e.sourceKey === 'XPHB:Hex' && !e.modifiers.length)?.mark).toBe(true);
    expect(combatOf(room).turns.e1!.bonusActionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'text' && m.system?.code === 'automation.markMoved')).toBe(true);
  });

  it("Hex: перенос метки при живой цели отклоняется", () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { x: 100, y: 150, hpMax: '10', hpCurrent: 10, faction: 'enemy' }),
        makeToken('t3', { x: 100, y: 300, hpMax: '10', hpCurrent: 10, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Hex', className: 'wizard' }] };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 1, current: 1, max: 1 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerActionHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Hex', slotLevel: 1, targetIds: ['t2'] });
    const mark = room.scene.maps[0]!.tokens[0]!.effects.find((e) => e.sourceKey === 'XPHB:Hex' && e.modifiers.length)!;
    combatOf(room).turns.e1!.bonusActionUsed = false; // перенос — на следующем ходу

    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: `spell:${mark.id}:remark`,
      targetIds: ['t3'],
    });

    const error = f.selfEvents('chat:error')[0]?.payload as { code?: string } | undefined;
    expect(error?.code).toBe('markTargetAlive');
    expect(mark.modifiers[0]?.filter?.targetId).toBe('t2');
    expect(combatOf(room).turns.e1!.bonusActionUsed).toBe(false);
  });

  it('Light: эффект-источник света вешается на цель', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { x: 100, y: 150, hpMax: '10', hpCurrent: 10, faction: 'ally' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Light', className: 'wizard' }] };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Light', targetIds: ['t2'] });

    const effect = room.scene.maps[0]!.tokens[1]!.effects.find((e) => e.sourceKey === 'XPHB:Light');
    expect(effect?.light).toEqual({ bright: 20, dim: 20 });
  });

  it('Darkness гасит Light на токене, но Light внутри Darkness сразу гаснет', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { x: 100, y: 150, hpMax: '10', hpCurrent: 10, faction: 'ally' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      spells: [
        { key: 'XPHB:Light', className: 'wizard' },
        { key: 'XPHB:Darkness', className: 'wizard' },
      ],
    };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 2, current: 1, max: 1 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Light', targetIds: ['t2'] });
    expect(room.scene.maps[0]!.tokens[1]!.effects.some((e) => e.sourceKey === 'XPHB:Light')).toBe(true);
    combatOf(room).turns.e1!.actionUsed = false;
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Darkness',
      slotLevel: 2,
      origin: { x: 100, y: 150 },
    });

    expect(room.scene.maps[0]!.tokens[1]!.effects.some((e) => e.sourceKey === 'XPHB:Light')).toBe(false);
    expect(room.scene.maps[0]!.zones.some((z) => z.sourceKey === 'XPHB:Darkness')).toBe(true);

    // Повторный Light в той же тьме гаснет сразу (эффект не остаётся).
    combatOf(room).turns.e1!.actionUsed = false;
    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Light', targetIds: ['t2'] });
    expect(room.scene.maps[0]!.tokens[1]!.effects.some((e) => e.sourceKey === 'XPHB:Light')).toBe(false);
  });

  it('Flame Blade (равный уровень) гасит Darkness, висящую на карте', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { x: 400, y: 100, hpMax: '10', hpCurrent: 10, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      spells: [{ key: 'XPHB:Flame Blade', className: 'druid' }],
    };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 2, current: 1, max: 1 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    // Тьма чужака (источник t2) уже на карте; t1 стоит внутри неё.
    const darknessDef: AutomationDef = {
      key: 'XPHB:Darkness',
      name: 'Darkness',
      resolution: 'effect',
      concentration: true,
      zone: {
        area: { shape: 'sphere', size: 15 },
        origin: 'point',
        duration: { type: 'concentration' },
        flags: { blocksLight: true },
      },
    };
    createZoneFromDef(f.ctx, {
      caster: room.scene.maps[0]!.tokens[1]!,
      mapId: 'm1',
      def: darknessDef,
      stats: null,
      origin: { x: 100, y: 100 },
    });
    expect(room.scene.maps[0]!.zones).toHaveLength(1);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Flame Blade',
      slotLevel: 2,
      targetIds: ['t1'],
    });

    expect(room.scene.maps[0]!.zones).toHaveLength(0);
    const effect = room.scene.maps[0]!.tokens[0]!.effects.find((e) => e.sourceKey === 'XPHB:Flame Blade');
    expect(effect?.light).toEqual({ bright: 10, dim: 10 });
  });

  it('Daylight: зона-солнечный свет в точке', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' })], {
      p1: 'lib1',
    });
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Daylight', className: 'wizard' }] };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 3, current: 1, max: 1 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Daylight',
      slotLevel: 3,
      origin: { x: 200, y: 100 },
    });

    expect(room.scene.maps[0]!.zones[0]?.light).toEqual({ bright: 60, dim: 60, sunlight: true });
  });

  it('Moonbeam: перемещение зоны действием и сейв по входу', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { x: 100, y: 600, hpMax: '40', hpCurrent: 40, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Moonbeam', className: 'wizard' }] };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 2, current: 1, max: 1 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerActionHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Moonbeam',
      slotLevel: 2,
      origin: { x: 100, y: 200 },
    });
    const zone = room.scene.maps[0]!.zones[0]!;
    expect(zone).toBeDefined();

    combatOf(room).turns.e1!.actionUsed = false; // перемещение — на следующем ходу
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: `zone:${zone.id}:move`,
      origin: { x: 100, y: 600 },
    });
    rand.mockRestore();

    expect(zone.origin.y).toBe(600);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBeLessThan(40);
    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'text' && m.system?.code === 'automation.zoneMoved')).toBe(true);
  });

  it('Moonbeam: перемещение дальше лимита и чужим игроком отклоняется', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t3', { libraryItemId: 'lib2', x: 300, y: 300, faction: 'ally' }),
      ],
      { p1: 'lib1', p2: 'lib2' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Moonbeam', className: 'wizard' }] };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 2, current: 1, max: 1 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerActionHandlers(f.ctx);
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Moonbeam',
      slotLevel: 2,
      origin: { x: 100, y: 100 },
    });
    const zone = room.scene.maps[0]!.zones[0]!;
    combatOf(room).turns.e1!.actionUsed = false;

    // 70 фт > 60 фт.
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: `zone:${zone.id}:move`,
      origin: { x: 100, y: 800 },
    });
    expect((f.selfEvents('chat:error')[0]?.payload as { code?: string })?.code).toBe('outOfRange');
    expect(zone.origin.y).toBe(100);

    // Чужой игрок: своим токеном пытается двигать чужую зону.
    const other = makeCtx(room, { playerId: 'p2' });
    registerActionHandlers(other.ctx);
    other.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't3',
      actionId: `zone:${zone.id}:move`,
      origin: { x: 100, y: 150 },
    });
    expect((other.selfEvents('chat:error')[0]?.payload as { code?: string })?.code).toBe('notYourToken');
  });

  it('Call Lightning: удар при касте и повтор действием зоны', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { x: 250, y: 100, hpMax: '40', hpCurrent: 40, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Call Lightning', className: 'wizard' }] };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 3, current: 1, max: 1 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerActionHandlers(f.ctx);

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Call Lightning',
      slotLevel: 3,
      origin: { x: 250, y: 100 },
    });
    rand.mockRestore();

    const target = room.scene.maps[0]!.tokens[1]!;
    expect(target.hpCurrent).toBeLessThan(40);
    const zone = room.scene.maps[0]!.zones[0]!;
    expect(zone.actions?.[0]?.id).toBe('strike');

    combatOf(room).turns.e1!.actionUsed = false;
    const before = target.hpCurrent;
    const rand2 = vi.spyOn(Math, 'random').mockReturnValue(0);
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: `zone:${zone.id}:strike`,
      origin: { x: 250, y: 100 },
    });
    rand2.mockRestore();

    expect(target.hpCurrent).toBeLessThan(before);
    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
  });

  it('концентрация не снимает Daylight: каст Call Lightning оставляет обе зоны', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' })], {
      p1: 'lib1',
    });
    room.sheets.p1 = {
      ...casterSheet(),
      spells: [
        { key: 'XPHB:Daylight', className: 'wizard' },
        { key: 'XPHB:Call Lightning', className: 'wizard' },
      ],
    };
    room.resources.p1 = makeResources({
      hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 3, current: 2, max: 2 }],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Daylight',
      slotLevel: 3,
      origin: { x: 300, y: 100 },
    });
    combatOf(room).turns.e1!.actionUsed = false;
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Call Lightning',
      slotLevel: 3,
      origin: { x: 250, y: 100 },
    });

    const keys = room.scene.maps[0]!.zones.map((z) => z.sourceKey).sort();
    expect(keys).toEqual(['XPHB:Call Lightning', 'XPHB:Daylight']);
  });

  it("Dragon's Breath: без точки области Выдох отклоняется", () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.scene.maps[0]!.tokens[0]!.effects.push({
      id: 'db1',
      name: "Dragon's Breath",
      sourceId: 't1',
      duration: { type: 'concentration' },
      modifiers: [],
      actions: [
        {
          id: 'breath',
          name: 'Выдох',
          cost: 'action',
          def: {
            key: "XPHB:Dragon's Breath",
            name: 'Выдох',
            resolution: 'save',
            save: { ability: 'dex', half: true },
            damage: { dice: '3d6', types: ['cold'] },
            area: { shape: 'cone', size: 15 },
            targeting: { kind: 'area', area: { shape: 'cone', size: 15 }, range: 15 },
          },
        },
      ],
    });
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'spell:db1:breath' });

    const error = f.selfEvents('chat:error')[0]?.payload as { code?: string } | undefined;
    expect(error?.code).toBe('noAreaPoint');
    expect(combatOf(room).turns.e1!.actionUsed).toBe(false);
  });

  it('способность монстра из статблока: атака тратит действие, сейв вешает состояние', () => {
    const statblock: TokenStatblock = {
      abilities: { ...DEFAULT_ABILITIES },
      attackBonus: '+5',
      saveDc: 13,
      actions: [
        {
          id: 'bite',
          name: 'Укус',
          source: 'monster',
          costs: ['action'],
          ability: {
            attack: { rangeType: 'melee', damage: '1d6+2', types: ['piercing'] },
            save: { ability: 'con' },
            effects: [{ condition: 'poisoned', duration: { type: 'rounds', rounds: 1 } }],
          },
        },
      ],
    };
    const room = makeRoom([makeToken('t1', { statblock }), makeToken('t2', { hpMax: '30', hpCurrent: 30 })]);
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    const rand = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'bite', targetIds: ['t2'] });
    rand.mockRestore();

    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(24);
    expect(room.scene.maps[0]!.tokens[1]!.conditions.some((c) => c.key === 'poisoned')).toBe(true);
  });

  it('атака вне досягаемости не тратит действие', () => {
    const sword: AttackEntry = {
      name: 'Клинок',
      hit: 'd20+5',
      damage: '1d8+3',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom([
      makeToken('t1', { attacks: [sword], x: 100, y: 100 }),
      makeToken('t2', { x: 500, y: 100, hpMax: '30', hpCurrent: 30 }),
    ]);
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    expect(combatOf(room).turns.e1!.actionUsed).toBe(false);
    expect(f.selfEvents('chat:error').length).toBeGreaterThan(0);
  });

  it('обычная атака по оглушённой цели идёт с преимуществом', () => {
    const sword: AttackEntry = {
      name: 'Клинок',
      hit: 'd20+5',
      damage: '1d8+3',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom([
      makeToken('t1', { attacks: [sword], x: 100, y: 100 }),
      makeToken('t2', {
        x: 150,
        y: 100,
        hpMax: '30',
        hpCurrent: 30,
        conditions: [{ key: 'stunned', name: 'Ошеломлён' }],
      }),
    ]);
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    rand.mockRestore();

    const attack = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'attack') as
      | { roll?: { dice?: { advantage?: string | null }[] } }
      | undefined;
    expect(attack?.roll?.dice?.[0]?.advantage).toBe('a');
  });

  it('способность босса: вне дистанции и без точки области действие не тратится', () => {
    const statblock: TokenStatblock = {
      abilities: { ...DEFAULT_ABILITIES },
      actions: [
        {
          id: 'bite',
          name: 'Укус',
          source: 'monster',
          costs: ['action'],
          targeting: { kind: 'creature', range: 5 },
          ability: {
            attack: { rangeType: 'melee', damage: '1d6' },
          },
        },
        {
          id: 'swipe',
          name: 'Хвостовой удар',
          source: 'monster',
          costs: ['action'],
          targeting: { kind: 'area', range: 30, area: { shape: 'sphere', size: 10 } },
          ability: {
            save: { ability: 'dex' },
            damage: { dice: '2d6' },
          },
        },
      ],
    };
    const room = makeRoom([
      makeToken('t1', { statblock, x: 100, y: 100 }),
      makeToken('t2', { x: 500, y: 100, hpMax: '30', hpCurrent: 30 }),
    ]);
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'bite', targetIds: ['t2'] });
    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'swipe' });

    expect(combatOf(room).turns.e1!.actionUsed).toBe(false);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30);
  });

  it('способность-область босса собирает цели по aim-точке', () => {
    const statblock: TokenStatblock = {
      abilities: { ...DEFAULT_ABILITIES },
      saveDc: 12,
      actions: [
        {
          id: 'swipe',
          name: 'Хвостовой удар',
          source: 'monster',
          costs: ['action'],
          targeting: { kind: 'area', range: 0, area: { shape: 'sphere', size: 10 } },
          ability: {
            save: { ability: 'dex' },
            damage: { dice: '2d6', types: ['bludgeoning'] },
          },
        },
      ],
    };
    const room = makeRoom([
      makeToken('t1', { statblock }),
      makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30 }),
      makeToken('t3', { x: 200, y: 100, hpMax: '30', hpCurrent: 30 }),
    ]);
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'swipe',
      origin: { x: 175, y: 100 },
    });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(22);
    expect(room.scene.maps[0]!.tokens[2]!.hpCurrent).toBe(22);
  });

  it('способность-область за стену не применяется: нет чистого пути', () => {
    const statblock: TokenStatblock = {
      abilities: { ...DEFAULT_ABILITIES },
      saveDc: 12,
      actions: [
        {
          id: 'swipe',
          name: 'Хвостовой удар',
          source: 'monster',
          costs: ['action'],
          targeting: { kind: 'area', range: 0, area: { shape: 'sphere', size: 10 } },
          ability: {
            save: { ability: 'dex' },
            damage: { dice: '2d6', types: ['bludgeoning'] },
          },
        },
      ],
    };
    const room = makeRoom([
      makeToken('t1', { statblock }),
      makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30 }),
    ]);
    room.scene.maps[0]!.walls = [{ id: 'w1', x1: 125, y1: 50, x2: 125, y2: 150, kind: 'wall' }];
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'swipe',
      origin: { x: 175, y: 100 },
    });

    expect(
      f.selfEvents('chat:error').some((e) => (e.payload as { code?: string } | undefined)?.code === 'noClearPath')
    ).toBe(true);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30);
  });

  it('легендарная способность-заклинание кастуется из полного каталога без слота', () => {
    const statblock: TokenStatblock = {
      abilities: { ...DEFAULT_ABILITIES },
      actions: [
        {
          id: 'spell1',
          name: 'Волшебные стрелы',
          source: 'monster',
          costs: [],
          legendaryCost: 1,
          spellKey: 'XPHB:Magic Missile',
        },
      ],
    };
    const room = makeRoom([makeToken('t1', { statblock }), makeToken('t2', { hpMax: '30', hpCurrent: 30 })]);
    const combat = combatOf(room);
    combat.entries.push(
      { id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' },
      { id: 's1', tokenId: 't1', name: 'A', imageUrl: '', initiative: 10, bonus: '', legendaryOwnerId: 'e1' }
    );
    combat.currentIndex = 2;
    combat.turns.e1!.legendaryRemaining = 3;
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'spell1', targetIds: ['t2'] });
    rand.mockRestore();

    expect(combat.turns.e1!.actionUsed).toBe(false);
    expect(combat.turns.e1!.legendaryRemaining).toBe(2);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBeLessThan(30);
  });

  it('легендарная способность недоступна на своём ходу', () => {
    const statblock: TokenStatblock = {
      abilities: { ...DEFAULT_ABILITIES },
      actions: [
        {
          id: 'spell1',
          name: 'Волшебные стрелы',
          source: 'monster',
          costs: [],
          legendaryCost: 1,
          spellKey: 'XPHB:Magic Missile',
        },
      ],
    };
    const room = makeRoom([makeToken('t1', { statblock }), makeToken('t2', { hpMax: '30', hpCurrent: 30 })]);
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'spell1', targetIds: ['t2'] });

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30);
    expect(
      f.selfEvents('chat:error').some((e) => (e.payload as { code?: string } | undefined)?.code === 'legendaryOnly')
    ).toBe(true);
  });

  it('Второе дыхание лечит 1d10 + уровень воина и тратит ресурс', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 3 }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      hp: { current: 10, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [],
      resources: [
        { id: 'r1', key: 'fighter:secondWind', name: 'Второе дыхание', current: 2, max: 2, reset: 'short' },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d10 = 9
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:fighter:secondWind' });
    rand.mockRestore();

    expect(room.resources.p1!.hp.current).toBe(22); // 10 + 9 + 3
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(combatOf(room).turns.e1!.bonusActionUsed).toBe(true);
  });

  it('Боевой дух самурая: 5 временных HP и преимущество на атаки оружием', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 3, subclass: 'samurai' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        { id: 'r1', key: 'fighter.samurai:fightingSpirit', name: 'Боевой дух', current: 3, max: 3, reset: 'long' },
      ],
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:fighter.samurai:fightingSpirit' });

    const tk = room.scene.maps[0]!.tokens[0]!;
    expect(room.resources.p1!.hp.temp).toBe(5);
    const effect = tk.effects.find((e) => e.name === 'Боевой дух');
    expect(effect?.modifiers[0]?.filter).toEqual({ direction: 'self', weapon: true });
    expect(room.resources.p1!.resources[0]!.current).toBe(2);
  });

  it('временные HP поглощаются до основных', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.resources.p1 = {
      ...casterResources(),
      hp: { current: 10, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [],
      resources: [],
    };
    const tk = room.scene.maps[0]!.tokens[0]!;
    const f = makeCtx(room, { playerId: 'p1' });

    f.manager.grantTempHp(room, tk, 5);
    expect(room.resources.p1!.hp.temp).toBe(5);

    f.manager.adjustTokenHp(room, 'm1', tk, -7);
    expect(room.resources.p1!.hp.temp).toBe(0);
    expect(room.resources.p1!.hp.current).toBe(8); // 10 − 2
  });

  it('Чемпион критует на 19, прочие — нет', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', attacks: [sword] }),
        makeToken('t2', { hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 3, subclass: 'champion' }],
      spells: [],
    };
    room.resources.p1 = casterResources();
    const [attacker, target] = room.scene.maps[0]!.tokens;
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 = 19
    const f = makeCtx(room, { playerId: 'p1' });
    const casterInput = {
      attacker: attacker!,
      attackerMapId: 'm1',
      target: target!,
      targetMapId: 'm1',
      attack: sword,
      prefix: 't1',
      author: 't1',
    };
    const crit = resolveWeaponAttack(f.ctx, casterInput);
    room.sheets.p1 = { ...casterSheet(), classes: [{ className: 'fighter', level: 3 }], spells: [] };
    const plain = resolveWeaponAttack(f.ctx, casterInput);
    rand.mockRestore();

    expect(crit.crit).toBe(true);
    expect(plain.crit).toBe(false);
  });

  it('Фанатичное присутствие: преимущество союзникам в 30 фт без выбора целей', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', faction: 'ally', x: 100, y: 100 }),
        makeToken('t2', { faction: 'ally', x: 150, y: 100 }),
        makeToken('t3', { faction: 'enemy', x: 150, y: 150 }),
        makeToken('t4', { faction: 'ally', x: 100, y: 600 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', level: 10, subclass: 'zealot' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'barbarian.zealot:zealousPresence',
          name: 'Фанатичное присутствие',
          current: 1,
          max: 1,
          reset: 'long',
        },
      ],
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:barbarian.zealot:zealousPresence' });

    const [, ally, enemy, far] = room.scene.maps[0]!.tokens;
    const hasBuff = (t: (typeof room.scene.maps)[0]['tokens'][number]) =>
      t.effects.some((e) => e.name === 'Фанатичное присутствие');
    expect(hasBuff(ally!)).toBe(true);
    expect(hasBuff(enemy!)).toBe(false);
    expect(hasBuff(far!)).toBe(false);
    expect(room.resources.p1!.resources[0]!.current).toBe(0);
  });

  it('Божественная искра: лечит союзника на 1d8 + Мдр и тратит Проведение', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', faction: 'ally', x: 100, y: 100 }),
        makeToken('t2', { faction: 'ally', x: 150, y: 100, hpMax: '30', hpCurrent: 20 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, wis: 16 },
      classes: [{ className: 'cleric', level: 2 }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'cleric:channelDivinity',
          name: 'Проведение божественности',
          current: 2,
          max: 2,
          reset: 'short',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.6); // d8 = 5
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:cleric:divineSpark',
      targetIds: ['t2'],
    });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(28); // 20 + 5 + Мдр 3
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
  });

  it('Божественная искра: врагу CON-спас, при провале урон 1d8 + Мдр', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', faction: 'ally', x: 100, y: 100 }),
        makeToken('t2', { faction: 'enemy', x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, wis: 16 },
      classes: [{ className: 'cleric', level: 2 }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'cleric:channelDivinity',
          name: 'Проведение божественности',
          current: 2,
          max: 2,
          reset: 'short',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValueOnce(0.6).mockReturnValue(0.1); // d8 = 5, d20 = 3
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:cleric:divineSpark',
      targetIds: ['t2'],
    });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(22); // 30 − (5 + Мдр 3)
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
  });

  it('Изгнание нежити: автоцели-враги в 30 фт, испуг+недееспособность и Карающая', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', faction: 'ally', x: 100, y: 100 }),
        makeToken('t2', { faction: 'enemy', x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
        makeToken('t3', { faction: 'ally', x: 150, y: 150 }),
        makeToken('t4', { faction: 'enemy', x: 100, y: 600, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, wis: 16 },
      classes: [{ className: 'cleric', level: 5 }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'cleric:channelDivinity',
          name: 'Проведение божественности',
          current: 2,
          max: 2,
          reset: 'short',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1, 3d8 = 3
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:cleric:turnUndead' });
    rand.mockRestore();

    const [, enemy, ally, far] = room.scene.maps[0]!.tokens;
    expect(enemy!.hpCurrent).toBe(27); // 3d8 (по Мдр) радиантом
    const turn = enemy!.effects.find((e) => e.name === 'Изгнание нежити');
    expect(turn?.conditions).toEqual(['frightened', 'incapacitated']);
    expect(turn?.duration).toMatchObject({ type: 'untilSave', ability: 'wis', dc: 14 });
    expect(ally!.effects.length).toBe(0);
    expect(far!.effects.length).toBe(0);
    expect(far!.hpCurrent).toBe(30);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
  });

  it('Сияние рассвета: автоцели-враги в 30 фт, CON-спас пополам, 2d10 + уровень', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', faction: 'ally', x: 100, y: 100 }),
        makeToken('t2', { faction: 'enemy', x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
        makeToken('t3', { faction: 'ally', x: 150, y: 150 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, wis: 16 },
      classes: [{ className: 'cleric', level: 3, subclass: 'light' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'cleric:channelDivinity',
          name: 'Проведение божественности',
          current: 2,
          max: 2,
          reset: 'short',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0); // 2d10 = 2, d20 = 1 (провал)
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:cleric.light:radianceOfTheDawn' });
    rand.mockRestore();

    const [, enemy, ally] = room.scene.maps[0]!.tokens;
    expect(enemy!.hpCurrent).toBe(25); // 30 − (2 + уровень 3)
    expect(ally!.hpCurrent).toBe(0);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
  });

  it('Поддержание жизни: пул 5×уровня лечит раненых союзников до половины максимума', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', faction: 'ally', x: 100, y: 100 }),
        makeToken('t2', { faction: 'ally', x: 150, y: 100, hpMax: '30', hpCurrent: 5 }),
        makeToken('t3', { faction: 'ally', x: 150, y: 150, hpMax: '30', hpCurrent: 25 }),
        makeToken('t4', { faction: 'enemy', x: 200, y: 100, hpMax: '30', hpCurrent: 5 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, wis: 16 },
      classes: [{ className: 'cleric', level: 6, subclass: 'life' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'cleric:channelDivinity',
          name: 'Проведение божественности',
          current: 2,
          max: 2,
          reset: 'short',
        },
      ],
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:cleric.life:preserveLife' });

    const [, wounded, healthy, enemy] = room.scene.maps[0]!.tokens;
    expect(wounded!.hpCurrent).toBe(15); // до половины максимума
    expect(healthy!.hpCurrent).toBe(25); // не Bloodied — не тронут
    expect(enemy!.hpCurrent).toBe(5);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
  });

  it('Военный жрец: бонусное действие даёт одну атаку оружием и тратит ресурс', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, wis: 16 },
      classes: [{ className: 'cleric', level: 3, subclass: 'war' }],
      spells: [],
      attacks: [
        {
          name: 'Молот',
          hit: 'd20',
          damage: '1d8',
          damageType: 'bludgeoning',
          rangeType: 'melee',
          rangeNormal: 5,
          rangeLong: 0,
        },
      ],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        { id: 'r1', key: 'cleric.war:warPriest', name: 'Военный жрец', current: 3, max: 3, reset: 'short' },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 = 19 — попадание
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:cleric.war:warPriest' });

    const turn = combatOf(room).turns.e1!;
    expect(turn.attacksRemaining).toBeGreaterThanOrEqual(1);
    expect(turn.bonusActionUsed).toBe(true);
    expect(room.resources.p1!.resources[0]!.current).toBe(2);

    // Дополнительная атака тратит запас, а не действие.
    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    rand.mockRestore();
    expect(turn.attacksRemaining).toBe(0);
    expect(turn.actionUsed).toBe(false);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack')).toBe(true);
  });

  it('досягаемость: +10 фт в свой ход позволяет бить с 10 фт', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', attacks: [sword], x: 100, y: 100 }),
        makeToken('t2', { x: 200, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [] };
    room.resources.p1 = casterResources();
    combatOf(room).active = false;
    const [attacker, target] = room.scene.maps[0]!.tokens;
    attacker!.effects = [
      {
        id: 'reach1',
        name: 'Досягаемость',
        duration: { type: 'endOfTurn', of: 'target' },
        modifiers: [{ id: 'm1', target: 'reach', mode: 'add', value: 10 }],
      },
    ];
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 = 19
    const f = makeCtx(room, { playerId: 'p1' });
    const input = {
      attacker: attacker!,
      attackerMapId: 'm1',
      target: target!,
      targetMapId: 'm1',
      attack: sword,
      prefix: 't1',
      author: 't1',
    };
    const withReach = resolveWeaponAttack(f.ctx, input);
    attacker!.effects = [];
    const without = resolveWeaponAttack(f.ctx, input);
    rand.mockRestore();

    expect(withReach.error).toBeUndefined();
    expect(withReach.hitSuccess).toBe(true);
    expect(without.error?.code).toBe('attackOutOfReach');
  });

  it('атака оружием сквозь стену запрещена (нет чистого пути)', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', attacks: [sword], x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib1' }
    );
    room.scene.maps[0]!.walls = [{ id: 'w1', x1: 125, y1: 50, x2: 125, y2: 150, kind: 'wall' }];
    room.sheets.p1 = { ...casterSheet(), spells: [] };
    room.resources.p1 = casterResources();
    combatOf(room).active = false;
    const [attacker, target] = room.scene.maps[0]!.tokens;
    const f = makeCtx(room, { playerId: 'p1' });

    const result = resolveWeaponAttack(f.ctx, {
      attacker: attacker!,
      attackerMapId: 'm1',
      target: target!,
      targetMapId: 'm1',
      attack: sword,
      prefix: 't1',
      author: 't1',
    });

    expect(result.error?.code).toBe('noClearPath');
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack')).toBe(false);
  });

  it('край цели виден из-за угла — атака разрешена', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', attacks: [sword], x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib1' }
    );
    room.scene.maps[0]!.walls = [{ id: 'w1', x1: 125, y1: 100, x2: 125, y2: 150, kind: 'wall' }];
    room.sheets.p1 = { ...casterSheet(), spells: [] };
    room.resources.p1 = casterResources();
    combatOf(room).active = false;
    const [attacker, target] = room.scene.maps[0]!.tokens;
    const f = makeCtx(room, { playerId: 'p1' });

    const result = resolveWeaponAttack(f.ctx, {
      attacker: attacker!,
      attackerMapId: 'm1',
      target: target!,
      targetMapId: 'm1',
      attack: sword,
      prefix: 't1',
      author: 't1',
    });

    expect(result.error).toBeUndefined();
    expect(result.hitRoll).toBeDefined();
  });

  it('Шквал ударов: бонусное действие, фокус и +2 доп. атаки', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = { ...casterSheet(), classes: [{ className: 'monk', level: 2 }], spells: [] };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [{ id: 'r1', key: 'monk:focus', name: 'Фокус', current: 2, max: 2, reset: 'short' }],
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:monk:focus/flurryOfBlows' });

    const tk = room.scene.maps[0]!.tokens[0]!;
    const turn = combatOf(room).turns.e1!;
    expect(turn.flurryAttacks).toBe(2);
    expect(turn.bonusActionUsed).toBe(true);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    turn.actionUsed = true;
    expect(f.manager.canAttack(room, 'm1', tk)).toBe(false); // оружием запас Шквала не потратить
    expect(f.manager.canAttack(room, 'm1', tk, { unarmed: true })).toBe(true);
    f.manager.consumeAttack(room, 'm1', tk, { unarmed: true });
    f.manager.consumeAttack(room, 'm1', tk, { unarmed: true });
    expect(turn.flurryAttacks).toBe(0);
    expect(f.manager.canAttack(room, 'm1', tk, { unarmed: true })).toBe(false);
  });

  it('Безоружный удар монаха: атака действием, запас Extra Attack и Шквала', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '30', hpCurrent: 30, ac: '5' })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), classes: [{ className: 'monk', level: 5 }], spells: [] };
    room.resources.p1 = casterResources();
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 = 19 — попадание
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'unarmedStrike', targetIds: ['t2'] });
    const turn = combatOf(room).turns.e1!;
    expect(turn.actionUsed).toBe(true);
    expect(turn.attacksRemaining).toBe(1); // Extra Attack монаха 5
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack')).toBe(true);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'unarmedStrike', targetIds: ['t2'] });
    expect(turn.attacksRemaining).toBe(0);

    turn.flurryAttacks = 1;
    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'unarmedStrike', targetIds: ['t2'] });
    rand.mockRestore();
    expect(turn.flurryAttacks).toBe(0);
  });

  it('явный безоружный удар из листа переопределяет расчётный', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '30', hpCurrent: 30, ac: '5' })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'monk', level: 5 }],
      spells: [],
      attacks: [
        {
          name: 'Unarmed Strike',
          kind: 'unarmed',
          hit: 'd20+99',
          damage: '7',
          damageType: 'bludgeoning',
          rangeType: 'melee',
          rangeNormal: 5,
          rangeLong: 0,
        },
      ],
    };
    room.resources.p1 = casterResources();
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'unarmedStrike', targetIds: ['t2'] });
    rand.mockRestore();

    expect(f.emitted.filter((e) => e.event === 'chat:error').map((e) => e.payload)).toEqual([]);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(23); // 30 − 7 из листа
  });

  it('формулы атак понимают характеристики и бонус владения (str/dex/pb)', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '30', hpCurrent: 30, ac: '5' })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, str: 16, dex: 14 },
      classes: [{ className: 'fighter', level: 5 }],
      spells: [],
      attacks: [
        {
          name: 'Меч',
          hit: 'd20+str',
          damage: 'd6+dex+pb',
          damageType: 'slashing',
          rangeType: 'melee',
          rangeNormal: 5,
          rangeLong: 0,
        },
      ],
    };
    room.resources.p1 = casterResources();
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 19 (попадание), d6 6
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    rand.mockRestore();

    expect(f.emitted.filter((e) => e.event === 'chat:error').map((e) => e.payload)).toEqual([]);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(19); // 30 − (6 + Ловкость 2 + PB 3)
  });

  it('Ошеломляющий удар: окно после попадания, CON-спас и stunned', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '30', hpCurrent: 30, ac: '5' })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, dex: 14 },
      classes: [{ className: 'monk', level: 5 }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [{ id: 'r1', key: 'monk:focus', name: 'Фокус', current: 2, max: 2, reset: 'short' }],
    };
    const rand = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.9) // попадание безоружным (d20 19)
      .mockReturnValueOnce(0.1) // провал CON-спасброска (d20 3)
      .mockReturnValueOnce(0.9); // урон 1d8 = 8
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'unarmedStrike', targetIds: ['t2'] });

    const offer = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'rider:monk:stunningStrike')
    );
    expect(offer).toBeDefined();

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offer!.id, optionId: 'rider:monk:stunningStrike' });
    rand.mockRestore();

    const target = room.scene.maps[0]!.tokens[1]!;
    expect(target.conditions.some((c) => c.key === 'stunned')).toBe(true);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(target.hpCurrent).toBe(20); // 30 − (8 + Ловкость 2) после окна
  });

  it('Отражение атак: снижает урон и открывает окно перенаправления', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [sword], x: 100, y: 100 }),
        makeToken('t2', { libraryItemId: 'lib2', x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = { ...casterSheet(), classes: [{ className: 'monk', level: 3 }], spells: [] };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [{ id: 'r1', key: 'monk:focus', name: 'Фокус', current: 2, max: 2, reset: 'short' }],
    };
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'T2', imageUrl: '', initiative: 5, bonus: '' });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 17, 1d8 7, 1d10 9
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    const deflect = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'feature:monk:deflectAttacks')
    );
    expect(deflect).toBeDefined();

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: deflect!.id, optionId: 'feature:monk:deflectAttacks' });
    rand.mockRestore();

    const redirect = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'feature:monk:deflectAttacks:redirect')
    );
    expect(redirect).toBeDefined();
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30); // урон погашен
    f2.invoke('reaction:respond', { id: redirect!.id, optionId: null });
  });

  it('Ярость вешает эффект: сопротивление B/P/S и бонус урона по уровню', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', level: 9 }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [{ id: 'r1', key: 'barbarian:rage', name: 'Ярость', current: 2, max: 2, reset: 'short' }],
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:barbarian:rage' });

    const tk = room.scene.maps[0]!.tokens[0]!;
    const rage = tk.effects.find((e) => e.name === 'Ярость');
    expect(rage).toBeDefined();
    expect(rage!.duration).toEqual({ type: 'rounds', rounds: 10 });
    expect(rage!.modifiers.find((m) => m.target === 'damage' && m.mode === 'add')?.value).toBe(3);
    expect(rage!.modifiers.filter((m) => m.mode === 'resistance')).toHaveLength(3);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(combatOf(room).turns.e1!.bonusActionUsed).toBe(true);
  });

  it('Безрассудная атака: преимущество своим Str-атакам и атакам по себе', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', level: 2 }],
      spells: [],
    };
    room.resources.p1 = { ...casterResources(), spellSlots: [], resources: [] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:barbarian:recklessAttack' });

    const tk = room.scene.maps[0]!.tokens[0]!;
    const reckless = tk.effects.find((e) => e.name === 'Безрассудная атака');
    expect(reckless?.modifiers.map((m) => m.filter?.direction)).toEqual(['self', 'against']);
  });

  it('«Выпутаться» снимает эффект проверкой характеристики', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const tk = room.scene.maps[0]!.tokens[0]!;
    tk.effects = [
      {
        id: 'web1',
        name: 'Web',
        duration: { type: 'permanent' },
        modifiers: [],
        conditions: ['restrained'],
        escape: { ability: 'str', skill: 'athletics', dc: 15 },
      },
    ];
    tk.conditions = [{ key: 'restrained', name: 'Обездвижен', effectId: 'web1' }];
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.7); // d20 = 15
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'escape:web1' });
    rand.mockRestore();

    expect(tk.effects).toHaveLength(0);
    expect(tk.conditions).toHaveLength(0);
    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
  });

  it('игрок не может действовать не в свой ход', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.scene.maps[0]!.tokens.push(makeToken('t2'));
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dash' });
    expect(combatOf(room).turns.e1!.actionUsed).toBe(false);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(true);
  });

  it('реакционное действие доступно не в свой ход и тратит реакцию', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.scene.maps[0]!.tokens[0]!.statblock = {
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      actions: [{ id: 'parry', name: 'Парирование', source: 'monster', costs: ['reaction'] }],
    };
    room.scene.maps[0]!.tokens.push(makeToken('t2'));
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'parry', slot: 'reaction' });
    expect(combatOf(room).turns.e1!.reactionUsed).toBe(true);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(false);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'parry', slot: 'reaction' });
    expect(
      f.emitted.some((e) => e.event === 'chat:error' && (e.payload as { code?: string }).code === 'reactionSpent')
    ).toBe(true);
  });

  it('Атака списывает действие и оружие бьёт', () => {
    const room = makeRoom([makeToken('t1')], {});
    const token = room.scene.maps[0]!.tokens[0]!;
    token.attacks = [
      { name: 'Bite', hit: 'd20+5', damage: 'd6+3', rangeType: 'none', rangeNormal: 0, rangeLong: 0 },
    ];
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0 });

    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
    expect(combatOf(room).turns.e1!.attacksRemaining).toBe(0);
    expect(room.chat.length).toBeGreaterThan(0);
  });

  it('Mirror Image: попадание принимает образ, урона нет', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          attacks: [{ name: 'Bite', hit: 'd20+5', damage: 'd6+3', rangeType: 'none', rangeNormal: 0, rangeLong: 0 }],
        }),
        makeToken('t2', { hpMax: '30', hpCurrent: 30 }),
      ],
      {}
    );
    const target = room.scene.maps[0]!.tokens[1]!;
    target.effects = [
      {
        id: 'mi1',
        name: 'Mirror Image',
        duration: { type: 'rounds', rounds: 10 },
        modifiers: [],
        misdirect: { charges: 1, die: 'd6', threshold: 3 },
      },
    ];
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17 (попал), d6 = 5 (образ)
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    rand.mockRestore();

    expect(target.hpCurrent).toBe(30);
    expect(target.effects).toHaveLength(0);
    expect(room.chat.some((m) => m.kind === 'text' && m.system?.code === 'misdirect.hit')).toBe(true);
  });
});

describe('token:update права', () => {
  it('игрок-контролёр меняет hpTemp/conditions, но не faction/speed/statblock', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerTokenHandlers(f.ctx);
    const token = room.scene.maps[0]!.tokens[0]!;

    f.invoke('token:update', {
      mapId: 'm1',
      id: 't1',
      patch: {
        hpTemp: 5,
        faction: 'enemy',
        speed: 50,
        statblock: { abilities: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      },
    });

    expect(token.hpTemp).toBe(5);
    expect(token.faction).toBe('neutral');
    expect(token.speed).toBe(DEFAULT_SPEED);
    expect(token.statblock).toBeUndefined();
  });

  it('DM меняет faction/speed/statblock', () => {
    const room = makeRoom([makeToken('t1')], {});
    const f = makeCtx(room, { dm: true });
    registerTokenHandlers(f.ctx);
    const token = room.scene.maps[0]!.tokens[0]!;

    f.invoke('token:update', {
      mapId: 'm1',
      id: 't1',
      patch: {
        faction: 'enemy',
        speed: 50,
        statblock: { abilities: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      },
    });

    expect(token.faction).toBe('enemy');
    expect(token.speed).toBe(50);
    expect(token.statblock?.abilities.str).toBe(20);
  });
});

/** Синтетическая зона с эффектом на входе (Web-подобная). */
const enterZoneDef: AutomationDef = {
  key: 'TEST:Enter',
  name: 'Вход',
  resolution: 'auto',
  zone: {
    area: { shape: 'sphere', size: 20 },
    origin: 'point',
    duration: { type: 'rounds', rounds: 10 },
    triggers: {
      enter: {
        effects: [
          { name: 'Вход', duration: { type: 'permanent' }, to: 'targets', modifiers: [], conditions: ['restrained'] },
        ],
      },
    },
  },
};

describe('зоны и концентрация', () => {
  it('зонный каст держит якорь концентрации; ручное снятие эффекта гасит зону', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 200, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Hunger of Hadar', className: 'wizard' }] };
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerTokenHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Hunger of Hadar',
      slotLevel: 3,
      origin: { x: 200, y: 100 },
    });

    const caster = room.scene.maps[0]!.tokens[0]!;
    expect(room.scene.maps[0]!.zones).toHaveLength(1);
    expect(
      caster.effects.some((e) => e.concentration && e.sourceId === 't1' && e.sourceKey === 'XPHB:Hunger of Hadar')
    ).toBe(true);

    // Сняли якорь вручную (меню токена) — зона и её аура гаснут.
    f.invoke('token:update', { mapId: 'm1', id: 't1', patch: { effects: [] } });
    expect(room.scene.maps[0]!.zones).toHaveLength(0);
  });

  it('нет концентрации, если все цели прошли спас (Hypnotic Pattern)', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 300, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t3', { x: 350, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Hypnotic Pattern', className: 'wizard' }] };
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99); // d20 = 20 → все спаслись

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Hypnotic Pattern',
      slotLevel: 3,
      origin: { x: 300, y: 100 },
    });
    rand.mockRestore();

    const caster = room.scene.maps[0]!.tokens[0]!;
    expect(caster.effects.some((e) => e.concentration)).toBe(false);
    expect(combatOf(room).turns.e1!.concentrationId).toBeNull();
  });

  it('Mass Healing Word лечит всех выбранных существ (можно меньше шести)', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 10 }),
        makeToken('t3', { x: 200, y: 100, hpMax: '30', hpCurrent: 5 }),
        makeToken('t4', { x: 250, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Mass Healing Word', className: 'wizard' }] };
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Mass Healing Word',
      slotLevel: 3,
      targetIds: ['t2', 't3'],
    });

    const tokens = room.scene.maps[0]!.tokens;
    expect(tokens[1]!.hpCurrent).toBeGreaterThan(10);
    expect(tokens[2]!.hpCurrent).toBeGreaterThan(5);
    expect(tokens[3]!.hpCurrent).toBe(30);
  });

  it('Ученик жизни и Целитель-благословенный добавляют 2 + круг к лечению', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', faction: 'ally', x: 100, y: 100 }),
        makeToken('t2', { faction: 'ally', x: 125, y: 100, hpMax: '30', hpCurrent: 5 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, wis: 16 },
      classes: [{ className: 'cleric', level: 6, subclass: 'life' }],
      spells: [{ key: 'XPHB:Cure Wounds', className: 'cleric' }],
    };
    room.resources.p1 = {
      ...casterResources(),
      hp: { current: 20, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      spellSlots: [{ level: 1, current: 1, max: 1 }],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0); // 2d8 = 2
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Cure Wounds',
      slotLevel: 1,
      targetIds: ['t2'],
    });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(10); // 5 + 2d8 2 + (2 + круг 1)
    expect(room.resources.p1!.hp.current).toBe(23); // Целитель-благословенный: +3
  });

  it('Magic Initiate: заклинание 1 круга кастуется без ячейки раз в долгий отдых', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, int: 16 },
      classes: [],
      spells: [],
      choices: [
        { kind: 'feat', key: 'XPHB:magicInitiate', list: 'wizard', ability: 'int', spell: 'XPHB:Shield' },
      ],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'feat:XPHB:magicInitiate:freeCast',
          name: 'Magic Initiate: каст без ячейки',
          current: 1,
          max: 1,
          reset: 'long',
        },
      ],
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield', slotLevel: 1 });

    expect(room.resources.p1!.resources[0]!.current).toBe(0);
    expect(room.scene.maps[0]!.tokens[0]!.effects.some((e) => e.sourceKey === 'XPHB:Shield')).toBe(true);
  });

  it('Свирепый атакующий: перебрасывает урон и берёт лучший бросок раз в ход', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20+20',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', attacks: [sword], x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 4 }],
      spells: [],
      attacks: [sword],
      choices: [{ kind: 'feat', key: 'XPHB:savageAttacker' }],
    };
    room.resources.p1 = casterResources();
    const rand = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.9) // попадание (d20 19)
      .mockReturnValueOnce(0) // первый бросок урона: 1
      .mockReturnValueOnce(0.9); // второй бросок: 8
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(22); // 30 − 8 (лучший из 1 и 8)
    expect(
      room.scene.maps[0]!.tokens[0]!.effects.some((e) => e.sourceKey === 'feat:XPHB:savageAttacker:used')
    ).toBe(true);
  });

  it('Бардовское вдохновение: кость на союзнике и трата на промахе', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20+2',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', attacks: [sword], x: 100, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '15' }),
        makeToken('t3', { libraryItemId: 'lib3', x: 150, y: 150 }),
      ],
      { p1: 'lib1', p2: 'lib3' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 1 }],
      spells: [],
      attacks: [sword],
    };
    room.sheets.p2 = {
      ...casterSheet(),
      name: 'Бард',
      classes: [{ className: 'bard', level: 5 }],
      spells: [],
    };
    room.resources.p1 = casterResources();
    room.resources.p2 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'bard:bardicInspiration',
          name: 'Бардовское вдохновение',
          current: 3,
          max: 3,
          reset: 'long',
        },
      ],
    };
    combatOf(room).active = false;
    const f = makeCtx(room, { playerId: 'p2' });
    registerActionHandlers(f.ctx);

    // Бард даёт кость бойцу.
    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't3',
      actionId: 'class:bard:bardicInspiration',
      targetIds: ['t1'],
    });
    const dice = room.scene.maps[0]!.tokens[0]!.effects.filter((e) => e.bonusDie);
    expect(dice).toHaveLength(1);
    expect(dice[0]!.bonusDie).toBe('1d8');
    expect(room.resources.p2!.resources[0]!.current).toBe(2);

    // Промах бойца: окно вдохновения превращает его в попадание.
    const rand = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.2) // d20 = 5 → промах
      .mockReturnValueOnce(0.9) // кость вдохновения: 8
      .mockReturnValueOnce(0.9); // урон: 8
    const f2 = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f2.ctx);
    registerReactionHandlers(f2.ctx);
    f2.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const offer = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id.startsWith('bonusdie:'))
    );
    expect(offer).toBeDefined();
    const f3 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f3.ctx);
    f3.invoke('reaction:respond', {
      id: offer!.id,
      optionId: offer!.options.find((op) => op.id.startsWith('bonusdie:'))!.id,
    });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(22); // 5+2+8=15 → попадание, 1d8 8
    expect(room.scene.maps[0]!.tokens[0]!.effects.filter((e) => e.bonusDie)).toHaveLength(0);
  });

  it('Бардовское вдохновение на проваленном спасброске превращает его в успех', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', faction: 'ally', x: 100, y: 100 }),
        makeToken('t2', { libraryItemId: 'lib2', faction: 'enemy', x: 150, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1', p2: 'lib2' }
    );
    room.players.push(
      { id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null },
      { id: 'p2', name: 'P2', role: 'player', isConnected: true, socketId: null }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, wis: 16 },
      classes: [{ className: 'cleric', level: 3, subclass: 'light' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'cleric:channelDivinity',
          name: 'Проведение божественности',
          current: 2,
          max: 2,
          reset: 'short',
        },
      ],
    };
    const target = room.scene.maps[0]!.tokens[1]!;
    target.effects = [
      {
        id: 'bi1',
        name: 'Бардовское вдохновение (d12)',
        sourceKey: 'class:bard:bardicInspiration',
        sourceId: 'bard',
        duration: { type: 'rounds', rounds: 600 },
        modifiers: [],
        bonusDie: '1d12',
      },
    ];
    const rand = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0) // 2d10 = 2
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.1) // спас DEX: d20 3 → провал
      .mockReturnValueOnce(0.9); // кость вдохновения: 12 → 15 ≥ DC 13
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:cleric.light:radianceOfTheDawn' });
    const offer = pendingOffers('TEST').find((o) => o.options.some((op) => op.id.startsWith('bonusdie:')));
    expect(offer).toBeDefined();

    const f2 = makeCtx(room, { playerId: 'p2' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', {
      id: offer!.id,
      optionId: offer!.options.find((op) => op.id.startsWith('bonusdie:'))!.id,
    });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(28); // 5 урона, спас успешен → половина (2)
    expect(room.scene.maps[0]!.tokens[1]!.effects.filter((e) => e.bonusDie)).toHaveLength(0);
  });

  it('Мантия вдохновения: 2×кость временных HP и ходы движения по инициативе', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { libraryItemId: 'lib1', x: 150, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t3', { libraryItemId: 'lib1', x: 150, y: 150, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, cha: 16 },
      classes: [{ className: 'bard', level: 6, subclass: 'glamour' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'bard:bardicInspiration',
          name: 'Бардовское вдохновение',
          current: 3,
          max: 3,
          reset: 'short',
        },
      ],
    };
    combatOf(room).entries.push(
      { id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' },
      { id: 'e3', tokenId: 't3', name: 'C', imageUrl: '', initiative: 1, bonus: '' }
    );
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9); // кость d8: 8 → 16 врем. HP
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    registerCombatHandlers(f.ctx);

    f.invoke('action:use', {
      mapId: 'm1',
      tokenId: 't1',
      actionId: 'class:bard.glamour:mantleOfInspiration',
      targetIds: ['t2', 't3'],
    });
    rand.mockRestore();

    expect(room.resources.p1!.hp.temp).toBe(16);
    expect(actorStats(room, room.scene.maps[0]!.tokens[1]!).hp.temp).toBe(16);
    expect(actorStats(room, room.scene.maps[0]!.tokens[2]!).hp.temp).toBe(16);
    expect(
      room.scene.maps[0]!.tokens[1]!.effects.some((e) => e.restrictions?.ignoresOpportunityAttacks)
    ).toBe(true);
    expect(room.resources.p1!.resources[0]!.current).toBe(2);
    expect(combatOf(room).turns.e1!.bonusActionUsed).toBe(true);
    // Ход прерван: первым двигается t2 (только движение, без действий/реакции).
    expect(combatOf(room).currentIndex).toBe(1);
    expect(combatOf(room).turns.e2).toMatchObject({
      movementOnly: true,
      actionUsed: true,
      bonusActionUsed: true,
      reactionUsed: true,
      movementMax: 30,
    });
    // Завершение: следом t3, затем возврат к прерванному ходу барда.
    f.invoke('combat:endTurn', { mapId: 'm1' });
    expect(combatOf(room).currentIndex).toBe(2);
    expect(combatOf(room).turns.e3!.movementOnly).toBe(true);
    expect(room.scene.maps[0]!.tokens[1]!.effects.some((e) => e.sourceKey?.includes('mantleOfInspiration'))).toBe(false);
    f.invoke('combat:endTurn', { mapId: 'm1' });
    expect(combatOf(room).currentIndex).toBe(0);
    expect(combatOf(room).moveQueue).toBeUndefined();
    expect(combatOf(room).turns.e1!.bonusActionUsed).toBe(true);
    expect(combatOf(room).turns.e1!.movementOnly).toBe(false);
  });

  it('Режущие слова: кость барда-знания превращает попадание врага в промах', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20+8',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', faction: 'ally', x: 100, y: 100 }),
        makeToken('t2', { libraryItemId: 'lib2', faction: 'enemy', x: 150, y: 100, attacks: [sword] }),
        makeToken('t3', { faction: 'ally', x: 200, y: 100, hpMax: '30', hpCurrent: 30, ac: '15' }),
      ],
      { p1: 'lib1', p2: 'lib2' }
    );
    room.sheets.p1 = { ...casterSheet(), classes: [{ className: 'bard', level: 3, subclass: 'lore' }], spells: [] };
    room.sheets.p2 = { ...casterSheet(), classes: [{ className: 'fighter', level: 1 }], spells: [], attacks: [sword] };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'bard:bardicInspiration',
          name: 'Бардовское вдохновение',
          current: 3,
          max: 3,
          reset: 'long',
        },
      ],
    };
    room.resources.p2 = casterResources();
    combatOf(room).active = false;
    const rand = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // d20 11 + 8 = 19 → попадание по AC 15
      .mockReturnValueOnce(0.9); // кость d8: 8
    const f = makeCtx(room, { playerId: 'p2' });
    registerActionHandlers(f.ctx);
    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't2', actionId: 'attack', attackIndex: 0, targetIds: ['t3'] });
    const offer = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'feature:bard.lore:cuttingWords')
    );
    expect(offer).toBeDefined();

    f2.invoke('reaction:respond', { id: offer!.id, optionId: 'feature:bard.lore:cuttingWords' });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[2]!.hpCurrent).toBe(30); // 19 − 8 = 11 < AC 15 → промах
    expect(room.resources.p1!.resources[0]!.current).toBe(2);
  });

  it('Режущие слова: кость снижает урон оружия', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20+8',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', faction: 'ally', x: 100, y: 100 }),
        makeToken('t2', { libraryItemId: 'lib2', faction: 'enemy', x: 150, y: 100, attacks: [sword] }),
        makeToken('t3', { faction: 'ally', x: 200, y: 100, hpMax: '30', hpCurrent: 30, ac: '15' }),
      ],
      { p1: 'lib1', p2: 'lib2' }
    );
    room.sheets.p1 = { ...casterSheet(), classes: [{ className: 'bard', level: 3, subclass: 'lore' }], spells: [] };
    room.sheets.p2 = { ...casterSheet(), classes: [{ className: 'fighter', level: 1 }], spells: [], attacks: [sword] };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'bard:bardicInspiration',
          name: 'Бардовское вдохновение',
          current: 3,
          max: 3,
          reset: 'long',
        },
      ],
    };
    room.resources.p2 = casterResources();
    combatOf(room).active = false;
    const rand = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.9) // d20 19 + 8 = 27 → попадание (кость не перебить)
      .mockReturnValueOnce(0.5) // кость d6 (бард 3): 4
      .mockReturnValueOnce(0.9); // урон d8: 8
    const f = makeCtx(room, { playerId: 'p2' });
    registerActionHandlers(f.ctx);
    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't2', actionId: 'attack', attackIndex: 0, targetIds: ['t3'] });
    const offer = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'feature:bard.lore:cuttingWords:damage')
    );
    expect(offer).toBeDefined();
    expect(offer!.options.some((op) => op.id === 'feature:bard.lore:cuttingWords')).toBe(false);

    f2.invoke('reaction:respond', { id: offer!.id, optionId: 'feature:bard.lore:cuttingWords:damage' });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[2]!.hpCurrent).toBe(26); // 8 − 4 = 4 урона
    expect(room.resources.p1!.resources[0]!.current).toBe(2);
  });

  it('Боевое вдохновение: кость доблести добавляется к урону без реакции', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'bard', level: 6, subclass: 'valor' }],
      spells: [],
      attacks: [
        {
          name: 'Меч',
          hit: 'd20',
          damage: '1d8',
          damageType: 'slashing',
          rangeType: 'melee',
          rangeNormal: 5,
          rangeLong: 0,
        },
      ],
    };
    room.resources.p1 = casterResources();
    room.scene.maps[0]!.tokens[0]!.effects = [
      {
        id: 'bi1',
        name: 'Бардовское вдохновение (d8)',
        sourceKey: 'class:bard:bardicInspiration',
        sourceId: 'bard',
        duration: { type: 'rounds', rounds: 600 },
        modifiers: [],
        bonusDie: '1d8',
        bonusDieUses: ['damage', 'ac'],
      },
    ];
    combatOf(room).active = false;
    const rand = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // d20 11 → попадание
      .mockReturnValueOnce(0.3) // кость d8: 3
      .mockReturnValueOnce(0.9); // урон d8: 8
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    const offer = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'bonusdie:bi1:damage')
    );
    expect(offer).toBeDefined();

    f2.invoke('reaction:respond', { id: offer!.id, optionId: 'bonusdie:bi1:damage' });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(19); // 8 + 3 = 11 урона
    expect(room.scene.maps[0]!.tokens[0]!.effects.filter((e) => e.bonusDie)).toHaveLength(0);
  });

  it('Боевое вдохновение: кость доблести поднимает AC и отменяет попадание', () => {
    const sword: AttackEntry = {
      name: 'Меч',
      hit: 'd20+5',
      damage: '1d8',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, attacks: [sword] }),
        makeToken('t2', { libraryItemId: 'lib2', x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '15' }),
      ],
      { p1: 'lib1', p2: 'lib2' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 1 }],
      spells: [],
      attacks: [sword],
    };
    room.resources.p1 = casterResources();
    room.scene.maps[0]!.tokens[1]!.effects = [
      {
        id: 'bi2',
        name: 'Бардовское вдохновение (d8)',
        sourceKey: 'class:bard:bardicInspiration',
        sourceId: 'bard',
        duration: { type: 'rounds', rounds: 600 },
        modifiers: [],
        bonusDie: '1d8',
        bonusDieUses: ['damage', 'ac'],
      },
    ];
    combatOf(room).active = false;
    const rand = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // d20 11 + 5 = 16 → попадание по AC 15
      .mockReturnValueOnce(0.9); // кость d8: 8 → 16 < 23 → промах
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    const f2 = makeCtx(room, { playerId: 'p2' });
    registerReactionHandlers(f2.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    const offer = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'bonusdie:bi2:ac')
    );
    expect(offer).toBeDefined();

    f2.invoke('reaction:respond', { id: offer!.id, optionId: 'bonusdie:bi2:ac' });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30); // кость подняла AC → промах
    expect(room.scene.maps[0]!.tokens[1]!.effects.filter((e) => e.bonusDie)).toHaveLength(0);
  });

  it('Hold Person с апкастом накрывает две цели', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t3', { x: 200, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Hold Person', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 3, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1 → спас провален

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Hold Person',
      slotLevel: 3,
      targetIds: ['t2', 't3'],
    });
    rand.mockRestore();

    const tokens = room.scene.maps[0]!.tokens;
    expect(tokens[1]!.effects.some((e) => e.sourceKey === 'XPHB:Hold Person')).toBe(true);
    expect(tokens[2]!.effects.some((e) => e.sourceKey === 'XPHB:Hold Person')).toBe(true);
  });

  it('перетаскивание токена в зону срабатывает вне его хода (enter)', () => {
    const room = makeRoom([makeToken('t1'), makeToken('t2', { x: 500, y: 500, hpMax: '30', hpCurrent: 30 })], {});
    const f = makeCtx(room, { dm: true });
    registerTokenHandlers(f.ctx);
    const caster = room.scene.maps[0]!.tokens[0]!;
    createZoneFromDef(f.ctx, { caster, mapId: 'm1', def: enterZoneDef, stats: null, origin: { x: 125, y: 125 } });

    f.invoke('token:move', { mapId: 'm1', id: 't2', x: 125, y: 125 });

    expect(room.scene.maps[0]!.tokens[1]!.effects.some((e) => e.sourceKey === 'TEST:Enter')).toBe(true);
  });
});

function casterSheet(): CharacterSheet {
  return {
    name: 'Волшебник',
    senses: [],
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    proficiencyBonus: '3',
    saves: {},
    skills: {},
    attacks: [],
    classes: [{ className: 'wizard', level: 5 }],
    spells: [{ key: 'XPHB:Fireball', className: 'wizard' }],
    hpMax: '30',
    ac: '12',
    speed: 30,
    damageDefenses: [],
  };
}

function casterResources(): PlayerResources {
  return makeResources({
    hp: { current: 30, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    spellSlots: [{ level: 3, current: 1, max: 1 }],
  });
}

describe('spell:cast', () => {
  it('тратит ячейку/действие, кидает спасбросок и урон', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '30', hpCurrent: 30 })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 0, y: 0 },
    });

    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'save')).toBe(true);
  });

  it('Ярость запрещает каст заклинаний', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    const tk = room.scene.maps[0]!.tokens[0]!;
    tk.effects = [
      {
        id: 'rage1',
        name: 'Ярость',
        duration: { type: 'rounds', rounds: 10 },
        modifiers: [],
        restrictions: { noSpells: true },
      },
    ];
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 0, y: 0 },
    });

    expect(room.resources.p1!.spellSlots[0]!.current).toBe(casterResources().spellSlots[0]!.current);
    expect(combatOf(room).turns.e1!.actionUsed).toBe(false);
  });

  it('Shocking Grasp на попадании запрещает OA цели', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Shocking Grasp', className: 'wizard' }] };
    room.resources.p1 = casterResources();
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shocking Grasp', targetIds: ['t2'] });
    rand.mockRestore();

    const target = room.scene.maps[0]!.tokens[1]!;
    expect(target.effects.some((e) => e.restrictions?.noOpportunityAttacks)).toBe(true);
    expect(target.hpCurrent).toBeLessThan(30);
  });

  it('замедление: шанс провала заклинания с соматическим компонентом', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '30', hpCurrent: 30 })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    f.ctx.manager.applyEffect(room, room.scene.maps[0]!.tokens[0]!, {
      id: 'slow1',
      name: 'Slow',
      sourceId: 't2',
      duration: { type: 'untilSave', ability: 'wis', dc: 20, timing: 'end' },
      modifiers: [],
      restrictions: { spellFailureChance: 25 },
    });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1); // d100 = 11 → провал
    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 0, y: 0 },
    });
    rand.mockRestore();

    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30);
    expect(room.chat.some((m) => m.kind === 'roll' && m.labelParams?.subject?.includes('провал'))).toBe(true);
  });

  it('без выбранного заклинания не кастует', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Cure Wounds', slotLevel: 1 });

    expect(room.resources.p1!.spellSlots[0]!.current).toBe(1);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(true);
  });

  it('область: Fireball с origin поражает существ в радиусе', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 300, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t3', { x: 350, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t5', { x: 300, y: 600, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 300, y: 100 },
    });

    const t2 = room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!;
    const t3 = room.scene.maps[0]!.tokens.find((t) => t.id === 't3')!;
    const t5 = room.scene.maps[0]!.tokens.find((t) => t.id === 't5')!;
    const saves = room.chat.filter((m) => m.kind === 'roll' && m.rollKind === 'save');
    expect(saves).toHaveLength(2);
    expect(t2.hpCurrent).toBeLessThan(30);
    expect(t3.hpCurrent).toBeLessThan(30);
    expect(t5.hpCurrent).toBe(30);

    // Косметический эффект: сфера к точке, типы урона и только задетые цели.
    const fx = f.emitted.find((e) => e.event === 'fx:play')?.payload as
      | {
          key: string;
          mode: string;
          types: string[];
          targets: string[];
          area?: { shape: string; size: number };
          origin: { x: number; y: number } | null;
        }
      | undefined;
    expect(fx?.key).toBe('XPHB:Fireball');
    expect(fx?.mode).toBe('damage');
    expect(fx?.types).toEqual(['fire']);
    expect(fx?.area).toEqual({ shape: 'sphere', size: 20 });
    expect(fx?.origin).toEqual({ x: 300, y: 100 });
    expect([...(fx?.targets ?? [])].sort()).toEqual(['t2', 't3']);
  });

  it('файрболл за стену не кастуется: нет чистого пути', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 300, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    room.scene.maps[0]!.walls = [{ id: 'w1', x1: 200, y1: 50, x2: 200, y2: 150, kind: 'wall' }];
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 300, y: 100 },
    });

    expect(
      f.selfEvents('chat:error').some((e) => (e.payload as { code?: string } | undefined)?.code === 'noClearPath')
    ).toBe(true);
    // Ячейка не списана, цели не задеты.
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(1);
    expect(room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!.hpCurrent).toBe(30);
  });

  it('заклинание-атака по большой цели: видна крайняя клетка — каст проходит', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 175, y: 125, w: 100, h: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      spells: [{ key: 'XPHB:Scorching Ray', className: 'wizard' }],
    };
    room.resources.p1 = casterResources();
    // Стена закрывает линию до центра цели, но верхняя левая клетка подошвы видна.
    room.scene.maps[0]!.walls = [{ id: 'w1', x1: 125, y1: 100, x2: 125, y2: 150, kind: 'wall' }];
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Scorching Ray',
      slotLevel: 3,
      targetIds: ['t2'],
    });

    expect(f.selfEvents('chat:error')).toHaveLength(0);
    const fx = f.emitted.find((e) => e.event === 'fx:play')?.payload as { targets?: string[] } | undefined;
    expect(fx?.targets).toEqual(['t2']);
  });

  it('конус от себя: эффект помечен selfArea (Burning Hands)', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      spells: [
        { key: 'XPHB:Fireball', className: 'wizard' },
        { key: 'XPHB:Burning Hands', className: 'wizard' },
      ],
    };
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Burning Hands',
      slotLevel: 3,
      direction: { x: 300, y: 100 },
    });

    const fx = f.emitted.find((e) => e.event === 'fx:play')?.payload as
      | { area?: { shape: string; size: number }; selfArea?: boolean; direction?: { x: number } | null }
      | undefined;
    expect(fx?.area).toEqual({ shape: 'cone', size: 15 });
    expect(fx?.selfArea).toBe(true);
    expect(fx?.direction).toEqual({ x: 300, y: 100 });
  });

  it('взрыв области: сплошная стена не пропускает эффект', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 400, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t3', { x: 250, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    room.scene.maps[0]!.walls = [{ id: 'w1', x1: 350, y1: -100, x2: 350, y2: 300, kind: 'wall' }];
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 300, y: 100 },
    });

    expect(room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!.hpCurrent).toBe(30);
    expect(room.scene.maps[0]!.tokens.find((t) => t.id === 't3')!.hpCurrent).toBeLessThan(30);
    const fx = f.emitted.find((e) => e.event === 'fx:play')?.payload as { targets?: string[] } | undefined;
    expect(fx?.targets).toEqual(['t3']);
  });

  it('взрыв области огибает угол: укрытие за краем стены не спасает', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 375, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = casterSheet();
    room.resources.p1 = casterResources();
    room.scene.maps[0]!.walls = [{ id: 'w1', x1: 350, y1: 50, x2: 350, y2: 100, kind: 'wall' }];
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 300, y: 100 },
    });

    expect(room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!.hpCurrent).toBeLessThan(30);
  });

  it('Scorching Ray: каждый луч бьёт свою цель (3 броска)', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1' }),
        makeToken('t2', { hpMax: '40', hpCurrent: 40 }),
        makeToken('t3', { hpMax: '40', hpCurrent: 40 }),
      ],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      spells: [{ key: 'XPHB:Scorching Ray', className: 'wizard' }],
    };
    room.resources.p1 = {
      hp: { current: 20, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      hitDice: [],
      spellSlots: [{ level: 2, current: 1, max: 1 }],
      pact: { current: 0, max: 0, level: 0 },
      resources: [],
      notes: '',
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerRollAnimHandlers(f.ctx);
    f.invoke('player:rollAnimChance', { value: 100 });

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Scorching Ray',
      slotLevel: 2,
      targetIds: ['t2', 't3', 't2'],
    });

    const attacks = room.chat.filter((m) => m.kind === 'roll' && m.rollKind === 'attack');
    expect(attacks).toHaveLength(3);
    const subject = (m: (typeof attacks)[number]) =>
      (m as { labelParams?: { subject?: string } }).labelParams?.subject ?? '';
    expect(subject(attacks[0]!)).toContain('(1/3)');
    expect(subject(attacks[2]!)).toContain('(3/3)');
    // Лучи: анимация d20 только для первого броска, иначе анимации перебивают друг друга.
    expect(f.selfEvents('roll:anim')).toHaveLength(1);
  });

  it('иммунитет к типу урона обнуляет урон атаки', () => {
    const room = makeRoom(
      [
        makeToken('t1'),
        makeToken('t2', {
          hpMax: '30',
          hpCurrent: 30,
          damageDefenses: [{ id: 'd1', type: 'immunity', damageType: 'fire' }],
        }),
      ],
      {}
    );
    room.scene.maps[0]!.tokens[0]!.attacks = [
      { name: 'Огонь', hit: 'd20+20', damage: '2d6', damageType: 'fire', rangeType: 'none', rangeNormal: 0, rangeLong: 0 },
    ];
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    expect(room.scene.maps[0]!.tokens.find((t) => t.id === 't2')?.hpCurrent).toBe(30);
  });

  it('Shield накладывает +5 AC и тратит реакцию', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1', ac: '12' })], { p1: 'lib1' });
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });

    const tk = room.scene.maps[0]!.tokens[0]!;
    expect(tk.effects).toHaveLength(1);
    expect(tk.effects[0]!.modifiers[0]).toMatchObject({ target: 'ac', mode: 'add', value: 5 });
    expect(combatOf(room).turns.e1!.reactionUsed).toBe(true);
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(f.manager.acForToken(room, tk)).toBe(17);
  });

  it('реакционное заклинание кастуется не в свой ход и тратит реакцию', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1', ac: '12' })], { p1: 'lib1' });
    room.scene.maps[0]!.tokens.push(makeToken('t2'));
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });

    expect(combatOf(room).turns.e1!.reactionUsed).toBe(true);
    expect(room.scene.maps[0]!.tokens[0]!.effects).toHaveLength(1);
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(false);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(true);
  });

  it('Bless — концентрация на цели; endConcentration снимает эффекты', () => {    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2')],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Bless', className: 'cleric' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Bless',
      slotLevel: 1,
      targetIds: ['t2'],
    });

    const target = room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!;
    expect(target.effects).toHaveLength(1);
    expect(target.effects[0]!.concentration).toBe(true);
    expect(target.effects[0]!.sourceId).toBe('t1');
    expect(combatOf(room).turns.e1!.concentrationId).toBe(target.effects[0]!.id);

    const caster = room.scene.maps[0]!.tokens[0]!;
    expect(caster.effects.some((e) => e.sourceKey === 'XPHB:Bless' && e.concentration)).toBe(true);

    f.invoke('spell:endConcentration', { mapId: 'm1', tokenId: 't1' });
    expect(target.effects).toHaveLength(0);
    expect(caster.effects.some((e) => e.sourceKey === 'XPHB:Bless')).toBe(false);
    expect(combatOf(room).turns.e1!.concentrationId).toBeNull();
  });

  it('Aid поднимает максимум и текущие HP цели', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '20', hpCurrent: 20 })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Aid', className: 'cleric' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 2, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Aid', slotLevel: 2, targetIds: ['t2'] });

    const target = room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!;
    expect(target.hpMax).toBe('25');
    expect(target.hpCurrent).toBe(25);
    expect(target.effects).toHaveLength(1);
  });

  it('Hex помечает цель, даёт +1d6 урона и метку на цели', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '40', hpCurrent: 40 })],
      { p1: 'lib1' }
    );
    room.scene.maps[0]!.tokens[0]!.attacks = [
      { name: 'Меч', hit: 'd20+20', damage: '1d8', damageType: 'slashing', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
    ];
    room.sheets.p1 = {
      ...casterSheet(),
      attacks: [
        { name: 'Меч', hit: 'd20+20', damage: '1d8', damageType: 'slashing', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
      ],
      spells: [{ key: 'XPHB:Hex', className: 'warlock' }],
    };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // d20 = 11 → попадание
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerDiceHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Hex', slotLevel: 1, targetIds: ['t2'] });

    const caster = room.scene.maps[0]!.tokens[0]!;
    const target = room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!;
    const hex = caster.effects.find((e) => e.sourceKey === 'XPHB:Hex');
    expect(hex!.modifiers[0]!.filter?.targetId).toBe('t2');
    expect(target.effects.some((e) => e.sourceKey === 'XPHB:Hex')).toBe(true);

    f.invoke('dice:attack', { tokenId: 't1', targetId: 't2', attackIndex: 0 });
    rand.mockRestore();

    const damage = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'damage') as
      | { roll?: { expression?: string } }
      | undefined;
    expect(damage?.roll?.expression).toContain('1d6');
  });
});

describe('spell:cast монстра (статблок)', () => {
  const monsterStatblock = (spellcasting: NonNullable<TokenStatblock['spellcasting']>): TokenStatblock => ({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
    spellcasting,
  });

  it('кастует из списка и тратит ячейку статблока', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          statblock: monsterStatblock({
            ability: 'wis',
            dc: 14,
            spells: ['XPHB:Shield'],
            slots: [{ level: 1, max: 2, current: 2 }],
          }),
        }),
      ],
      {}
    );
    const f = makeCtx(room, { dm: true });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });

    const token = room.scene.maps[0]!.tokens[0]!;
    expect(token.statblock?.spellcasting?.slots?.[0]?.current).toBe(1);
    expect(token.effects).toHaveLength(1);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(false);
  });

  it('заклинание вне списка статблока не кастуется', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          statblock: monsterStatblock({ ability: 'wis', spells: [], slots: [{ level: 1, max: 1, current: 1 }] }),
        }),
      ],
      {}
    );
    const f = makeCtx(room, { dm: true });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });

    const token = room.scene.maps[0]!.tokens[0]!;
    expect(token.statblock?.spellcasting?.slots?.[0]?.current).toBe(1);
    expect(token.effects).toHaveLength(0);
    expect(
      f.emitted.some((e) => e.event === 'chat:error' && (e.payload as { code?: string }).code === 'spellNotInStatblock')
    ).toBe(true);
  });

  it('без свободной ячейки нужного круга не кастует', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          statblock: monsterStatblock({
            ability: 'wis',
            spells: ['XPHB:Shield'],
            slots: [{ level: 1, max: 1, current: 0 }],
          }),
        }),
      ],
      {}
    );
    const f = makeCtx(room, { dm: true });
    registerSpellHandlers(f.ctx);

    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: 'XPHB:Shield' });

    expect(room.scene.maps[0]!.tokens[0]!.effects).toHaveLength(0);
    expect(
      f.emitted.some((e) => e.event === 'chat:error' && (e.payload as { code?: string }).code === 'noSlot')
    ).toBe(true);
  });
});

describe('реакции (R1)', () => {
  const melee = (name = 'Меч', hit = 'd20+20'): AttackEntry => ({
    name,
    hit,
    damage: '1d8',
    damageType: 'slashing',
    rangeType: 'melee',
    rangeNormal: 5,
    rangeLong: 0,
  });
  const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 };

  it('окно на попадание: Shield тратит реакцию/ячейку и отменяет урон', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '16', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), ac: '16', spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17 (не крит)
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const defender = room.scene.maps[0]!.tokens[1]!;
    expect(defender.hpCurrent).toBe(30);
    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('spell:XPHB:Shield');

    // Пока окно открыто, даже DM не может действовать (заморозка).
    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dash' });
    expect(
      f.emitted.some((e) => e.event === 'chat:error' && (e.payload as { code?: string }).code === 'reactionPending')
    ).toBe(true);

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'spell:XPHB:Shield' });
    rand.mockRestore();

    expect(defender.effects.some((e) => e.sourceKey === 'XPHB:Shield')).toBe(true);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(defender.hpCurrent).toBe(30);
  });

  it('щит не предлагается при промахе', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '25', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), ac: '25', spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // d20 = 11
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    rand.mockRestore();

    expect(pendingOffers('TEST')).toHaveLength(0);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30);
  });

  it('щит не предлагается, если попадание с запасом больше бонуса', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '10', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), ac: '10', spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17 ≥ 10+5
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    rand.mockRestore();

    expect(pendingOffers('TEST')).toHaveLength(0);
    expect(room.resources.p1!.hp.current).toBeLessThan(30);
  });

  it('игрок со Щитом видит окно при выходе врага из досягаемости (не авто-OA)', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 150, y: 100, hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки')], x: 100, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Shield', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const f = makeCtx(room, { dm: true });
    registerCombatHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't2',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
      ],
    });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.tokenId).toBe('t1');
    expect(offers[0]!.options.map((o) => o.id)).toEqual(['opportunity']);
    expect(combatOf(room).turns.e1!.reactionUsed).toBe(false);
    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBe(30);
    f.invoke('reaction:forceSkip', { id: offers[0]!.id });
  });

  it('реакционная черта (Рипост) даёт окно вместо авто-OA', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 150, y: 100, hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки')], x: 100, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 5, subclass: 'battleMaster' }],
      spells: [],
      attacks: [melee('Рапира')],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'fighter.battleMaster:superiorityDice',
          name: 'Кости превосходства',
          current: 4,
          max: 4,
          reset: 'short',
        },
      ],
    };
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const f = makeCtx(room, { dm: true });
    registerCombatHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't2',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
      ],
    });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toEqual(['opportunity']);
    expect(combatOf(room).turns.e1!.reactionUsed).toBe(false);
    f.invoke('reaction:forceSkip', { id: offers[0]!.id });
  });

  it('черта без ресурса (кости кончились) не открывает окно — авто-OA', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 150, y: 100, hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки')], x: 100, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'fighter', level: 5, subclass: 'battleMaster' }],
      spells: [],
      attacks: [melee('Рапира')],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'fighter.battleMaster:superiorityDice',
          name: 'Кости превосходства',
          current: 0,
          max: 4,
          reset: 'short',
        },
      ],
    };
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const f = makeCtx(room, { dm: true });
    registerCombatHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't2',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
      ],
    });

    expect(pendingOffers('TEST')).toHaveLength(0);
    expect(combatOf(room).turns.e1!.reactionUsed).toBe(true);
  });
  it('без спец-реакций атака по возможности срабатывает автоматически', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки')], x: 150, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.resources.p1 = casterResources();
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerCombatHandlers(f.ctx);

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // d20 = 11, 1d8 = 5
    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't1',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
      ],
    });
    rand.mockRestore();

    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack' && m.author === 't2')).toBe(true);
    expect(room.resources.p1!.hp.current).toBe(25);
  });

  it('действие «Отход» отменяет атаку по возможности при движении', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки')], x: 150, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.resources.p1 = casterResources();
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    registerCombatHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'disengage' });
    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't1',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
      ],
    });

    expect(combatOf(room).turns.e1!.disengaged).toBe(true);
    expect(combatOf(room).turns.e2?.reactionUsed ?? false).toBe(false);
    expect(room.resources.p1!.hp.current).toBe(30);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack' && m.author === 't2')).toBe(false);
  });

  it('Мантия вдохновения: эффект отменяет атаки по возможности при движении', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки')], x: 150, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.resources.p1 = casterResources();
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerCombatHandlers(f.ctx);

    f.manager.applyEffect(room, room.scene.maps[0]!.tokens[0]!, {
      id: 'mantle1',
      name: 'Мантия вдохновения',
      sourceKey: 'class:bard.glamour:mantleOfInspiration',
      sourceId: 'bard',
      duration: { type: 'endOfTurn', of: 'target' },
      modifiers: [],
      restrictions: { ignoresOpportunityAttacks: true },
    });
    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't1',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
      ],
    });

    expect(pendingOffers('TEST')).toHaveLength(0);
    expect(combatOf(room).turns.e2?.reactionUsed ?? false).toBe(false);
  });

  it('действие «Уклонение» помечает ход и даёт помеху на атаки по токену', () => {
    const room = makeRoom(
      [
        makeToken('t1', { x: 100, y: 100, ac: '20', hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки', 'd20')], x: 150, y: 100, faction: 'enemy' }),
      ],
      {}
    );
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dodge' });
    expect(room.scene.maps[0]!.tokens[0]!.effects.some((e) => e.name === 'Уклонение')).toBe(true);

    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const rand = vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1); // 19 и 3
    f.invoke('action:use', { mapId: 'm1', tokenId: 't2', actionId: 'attack', attackIndex: 0, targetIds: ['t1'] });
    rand.mockRestore();

    const attack = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'attack') as
      | { roll?: { total?: number } }
      | undefined;
    expect(attack?.roll?.total).toBe(3); // помеха: взят меньший бросок
    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBe(30);
  });

  it('Терпеливая оборона (фокус): помеха держится и после конца хода монаха', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, ac: '20', hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки', 'd20')], x: 150, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = { ...casterSheet(), classes: [{ className: 'monk', level: 2 }], spells: [] };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [{ id: 'r1', key: 'monk:focus', name: 'Фокус', current: 2, max: 2, reset: 'short' }],
    };
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    const f2 = makeCtx(room, { dm: true });
    registerActionHandlers(f2.ctx);
    registerCombatHandlers(f2.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:monk:focus/patientDefense' });
    expect(room.scene.maps[0]!.tokens[0]!.effects.some((e) => e.name === 'Уклонение')).toBe(true);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);

    f2.invoke('combat:endTurn', { mapId: 'm1' });
    expect(room.scene.maps[0]!.tokens[0]!.effects.some((e) => e.name === 'Уклонение')).toBe(true);

    const rand = vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1); // 19 и 3
    f2.invoke('action:use', { mapId: 'm1', tokenId: 't2', actionId: 'attack', attackIndex: 0, targetIds: ['t1'] });
    rand.mockRestore();

    const attack = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'attack') as
      | { roll?: { total?: number } }
      | undefined;
    expect(attack?.roll?.total).toBe(3); // помеха
  });

  it('формулы «1d20…»/«D20…» не теряют помеху от Уклонения', () => {
    const room = makeRoom(
      [
        makeToken('t1', { x: 100, y: 100, ac: '20', hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t2', {
          attacks: [
            {
              name: 'Бонк',
              hit: 'D20 + 3 + d4',
              damage: 'd8 + 3',
              damageType: 'bludgeoning',
              rangeType: 'melee',
              rangeNormal: 5,
              rangeLong: 0,
            },
          ],
          x: 150,
          y: 100,
          faction: 'enemy',
        }),
      ],
      {}
    );
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dodge' });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).currentIndex = 1;
    const rand = vi.spyOn(Math, 'random').mockReturnValueOnce(0.2).mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
    f.invoke('action:use', { mapId: 'm1', tokenId: 't2', actionId: 'attack', attackIndex: 0, targetIds: ['t1'] });
    rand.mockRestore();

    const attack = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'attack') as
      | { roll?: { total?: number; dice?: { advantage?: string | null }[] } }
      | undefined;
    expect(attack?.roll?.dice?.[0]?.advantage).toBe('d');
    expect(attack?.roll?.total).toBe(5 + 3 + 1); // меньший d20 (5) + 3 + d4 (1)
  });

  it('Терпеливая оборона + «Щит» (Magic Initiate): помеха сохраняется в окне реакции', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, ac: '19', hpMax: '30', hpCurrent: 30, faction: 'ally' }),
        makeToken('t2', { attacks: [melee('Клыки', 'd20')], x: 150, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, int: 16 },
      ac: '19',
      classes: [{ className: 'monk', level: 2 }],
      spells: [],
      choices: [
        { kind: 'feat', key: 'XPHB:magicInitiate', list: 'wizard', ability: 'int', spell: 'XPHB:Shield' },
      ],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        { id: 'r1', key: 'monk:focus', name: 'Фокус', current: 2, max: 2, reset: 'short' },
        {
          id: 'r2',
          key: 'feat:XPHB:magicInitiate:freeCast',
          name: 'Magic Initiate: каст без ячейки',
          current: 1,
          max: 1,
          reset: 'long',
        },
      ],
    };
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    const f2 = makeCtx(room, { dm: true });
    registerActionHandlers(f2.ctx);
    registerCombatHandlers(f2.ctx);
    registerReactionHandlers(f2.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'class:monk:focus/patientDefense' });
    f2.invoke('combat:endTurn', { mapId: 'm1' });

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9); // оба d20 = 19 — попадание
    f2.invoke('action:use', { mapId: 'm1', tokenId: 't2', actionId: 'attack', attackIndex: 0, targetIds: ['t1'] });
    rand.mockRestore();

    const attack = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'attack') as
      | { roll?: { total?: number; dice?: { advantage?: string | null }[] } }
      | undefined;
    expect(attack?.roll?.dice?.[0]?.advantage).toBe('d'); // помеха на броске

    const offer = pendingOffers('TEST').find((o) => o.options.some((op) => op.id === 'spell:XPHB:Shield'));
    expect(offer).toBeDefined();
    const f3 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f3.ctx);
    f3.invoke('reaction:respond', { id: offer!.id, optionId: 'spell:XPHB:Shield' });
    expect(room.scene.maps[0]!.tokens[0]!.effects.some((e) => e.sourceKey === 'XPHB:Shield')).toBe(true);
    expect(room.resources.p1!.resources.find((r) => r.key === 'feat:XPHB:magicInitiate:freeCast')!.current).toBe(0);
    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBe(30); // AC 19 + 5 → урона нет
  });

  it('после урона открывается окно Hellish Rebuke и бьёт по атакующему', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee()], hpMax: '30', hpCurrent: 30, faction: 'enemy' }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '10', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), ac: '10', spells: [{ key: 'XPHB:Hellish Rebuke', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // без фляков на d20
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    expect(room.resources.p1!.hp.current).toBeLessThan(30);
    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.trigger).toBe('damage');
    expect(offers[0]!.options.map((o) => o.id)).toContain('spell:XPHB:Hellish Rebuke');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'spell:XPHB:Hellish Rebuke' });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBeLessThan(30);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
  });

  it('Невероятное уклонение уменьшает урон вдвое', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '16', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = {
      ...casterSheet(),
      ac: '16',
      classes: [{ className: 'rogue', level: 5 }],
      spells: [],
    };
    room.resources.p1 = { ...casterResources(), spellSlots: [] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17 (попадание), d8 = 7
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('feature:rogue:uncannyDodge');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'feature:rogue:uncannyDodge' });
    rand.mockRestore();

    expect(room.resources.p1!.hp.current).toBe(27); // floor(7 / 2)
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
  });

  it('Парирование тратит кость превосходства и повышает AC', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '16', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = {
      ...casterSheet(),
      ac: '16',
      classes: [{ className: 'fighter', level: 5, subclass: 'battleMaster' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'fighter.battleMaster:superiorityDice',
          name: 'Кости превосходства',
          current: 4,
          max: 4,
          reset: 'short',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17, кость d8 = 7
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('feature:fighter.battleMaster:parry');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'feature:fighter.battleMaster:parry' });
    rand.mockRestore();

    expect(room.resources.p1!.hp.current).toBe(30); // AC 16 + 7 = 23 > 17 → промах
    expect(room.resources.p1!.resources[0]!.current).toBe(3);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
  });

  it('наездники: Божественная ярость (+1d6+полуровень) — один раз за ход', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', subclass: 'zealot', level: 4 }],
      spells: [],
    };
    room.resources.p1 = { ...casterResources(), spellSlots: [], resources: [] };
    const tk = room.scene.maps[0]!.tokens[0]!;
    tk.effects = [
      {
        id: 'rage',
        name: 'Rage',
        sourceKey: 'class:barbarian:rage',
        sourceId: tk.id,
        duration: { type: 'rounds', rounds: 10 },
        modifiers: [],
      },
    ];
    const f = makeCtx(room, { playerId: 'p1' });

    const first = applyAttackRiders(f.ctx, room, tk, 'm1');
    expect(first.expr).toBe('1d6+2');
    expect(first.notes).toHaveLength(1);
    expect(applyAttackRiders(f.ctx, room, tk, 'm1').expr).toBe('');
  });

  it('Псионический удар: окно после попадания тратит кость пси-энергии', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1' }), makeToken('t2', { hpMax: '30', hpCurrent: 30, ac: '5' })],
      { p1: 'lib1' }
    );
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, int: 16 },
      classes: [{ className: 'fighter', subclass: 'psiWarrior', level: 3 }],
      spells: [],
      attacks: [
        {
          name: 'Меч',
          hit: 'd20',
          damage: '1d8',
          damageType: 'slashing',
          rangeType: 'melee',
          rangeNormal: 5,
          rangeLong: 0,
        },
      ],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'fighter.psiWarrior:psionicEnergyDice',
          name: 'Кости пси-энергии',
          current: 4,
          max: 4,
          reset: 'short',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.9); // d20 19, d8 8, d6 6
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    const offer = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'rider:fighter.psiWarrior:psionicStrike')
    );
    expect(offer).toBeDefined();

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offer!.id, optionId: 'rider:fighter.psiWarrior:psionicStrike' });
    rand.mockRestore();

    expect(room.resources.p1!.resources[0]!.current).toBe(3);
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(13); // 30 − (8 + 1d6 6 + Инт 3)
  });

  it('Щит духов союзника снижает урон атаки', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')], x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
        makeToken('t3', { libraryItemId: 'lib2', x: 200, y: 100, hpMax: '30', hpCurrent: 30 }),
      ],
      { p2: 'lib2' }
    );
    room.players.push({ id: 'p2', name: 'P2', role: 'player', isConnected: true, socketId: null });
    room.sheets.p2 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', level: 6, subclass: 'ancestralGuardian' }],
      spells: [],
    };
    room.resources.p2 = casterResources();
    combatOf(room).entries.push({ id: 'e3', tokenId: 't3', name: 'T3', imageUrl: '', initiative: 5, bonus: '' });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 17 (попадение), 1d8 7, 2d6 10
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    const shield = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'feature:barbarian.ancestralGuardian:spiritShield')
    );
    expect(shield).toBeDefined();

    const f2 = makeCtx(room, { playerId: 'p2' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: shield!.id, optionId: 'feature:barbarian.ancestralGuardian:spiritShield' });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30); // 7 − 10 → 0
    expect(combatOf(room).turns.e3!.reactionUsed).toBe(true);
  });

  it('Возмездие: реакция-атака по ударившему в 5 фт', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')], x: 100, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t2', { libraryItemId: 'lib2', x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '5' }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = {
      ...casterSheet(),
      classes: [{ className: 'barbarian', level: 10, subclass: 'berserker' }],
      spells: [],
      attacks: [melee('Топор')],
    };
    room.resources.p1 = { ...casterResources(), spellSlots: [], resources: [] };
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'T2', imageUrl: '', initiative: 5, bonus: '' });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    const offers = pendingOffers('TEST');
    expect(offers.some((o) => o.options.some((op) => op.id === 'feature:barbarian.berserker:retaliation'))).toBe(true);

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'feature:barbarian.berserker:retaliation' });
    rand.mockRestore();

    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack' && m.author === 't2')).toBe(true);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
  });

  it('Направленный удар: +10 к своему промаху без реакции, попадание и урон', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '15' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, wis: 16 },
      classes: [{ className: 'cleric', level: 3, subclass: 'war' }],
      spells: [],
      attacks: [melee('Молот', 'd20+5')],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'cleric:channelDivinity',
          name: 'Проведение божественности',
          current: 2,
          max: 2,
          reset: 'short',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.3); // d20 = 7 (промах), d8 = 3
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const offer = pendingOffers('TEST').find((o) =>
      o.options.some((op) => op.id === 'feature:cleric.war:guidedStrike:self')
    );
    expect(offer).toBeDefined();

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offer!.id, optionId: 'feature:cleric.war:guidedStrike:self' });
    rand.mockRestore();


    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(27); // 12 + 10 ≥ AC 15 → 1d8 3
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(combatOf(room).turns.e1!.reactionUsed).toBe(false);
  });

  it('Кость вдохновения и Направленный удар — одна панель с обеими опциями', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, hpMax: '30', hpCurrent: 30 }),
        makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30, ac: '15' }),
      ],
      { p1: 'lib1' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, wis: 16 },
      classes: [
        { className: 'bard', level: 3 },
        { className: 'cleric', level: 3, subclass: 'war' },
      ],
      spells: [],
      attacks: [melee('Молот', 'd20+5')],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'cleric:channelDivinity',
          name: 'Проведение божественности',
          current: 2,
          max: 2,
          reset: 'short',
        },
      ],
    };
    room.scene.maps[0]!.tokens[0]!.effects = [
      {
        id: 'bi1',
        name: 'Бардовское вдохновение (d6)',
        sourceKey: 'class:bard:bardicInspiration',
        sourceId: 'bard',
        duration: { type: 'rounds', rounds: 600 },
        modifiers: [],
        bonusDie: '1d6',
      },
    ];
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.3); // d20 = 7 — промах
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });
    rand.mockRestore();

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toEqual(
      expect.arrayContaining(['feature:cleric.war:guidedStrike:self', 'bonusdie:bi1'])
    );

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: null });
  });

  it('Absorb Elements уменьшает урон и даёт сопротивление типу', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          attacks: [
            {
              name: 'Огонь',
              hit: 'd20',
              damage: '1d8',
              damageType: 'fire',
              rangeType: 'melee',
              rangeNormal: 5,
              rangeLong: 0,
            },
          ],
        }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '10', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), ac: '10', spells: [{ key: 'XGE:Absorb Elements', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 1, current: 1, max: 1 }] };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.8); // d20 = 17, 1d8 = 7
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('spell:XGE:Absorb Elements');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'spell:XGE:Absorb Elements' });
    rand.mockRestore();

    const defender = room.scene.maps[0]!.tokens[1]!;
    expect(room.resources.p1!.hp.current).toBe(27); // floor(7 / 2)
    expect(room.resources.p1!.spellSlots[0]!.current).toBe(0);
    expect(
      defender.effects.some(
        (e) => e.sourceKey === 'XGE:Absorb Elements' && e.modifiers.some((m) => m.filter?.damageType === 'fire')
      )
    ).toBe(true);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
  });

  it('Counterspell отменяет каст', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 0, y: 0, faction: 'ally' }),
        makeToken('t2', { x: 100, y: 0, hpMax: '30', hpCurrent: 30, faction: 'enemy' }),
        makeToken('t3', { libraryItemId: 'lib3', x: 0, y: 100, faction: 'enemy' }),
      ],
      { p1: 'lib1', p2: 'lib3' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.players.push({ id: 'p2', name: 'P2', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    combatOf(room).entries.push({ id: 'e3', tokenId: 't3', name: 'C', imageUrl: '', initiative: 4, bonus: '' });
    room.sheets.p1 = { ...casterSheet(), spells: [{ key: 'XPHB:Fireball', className: 'wizard' }] };
    room.resources.p1 = { ...casterResources(), spellSlots: [{ level: 3, current: 1, max: 1 }] };
    room.sheets.p2 = { ...casterSheet(), spells: [{ key: 'XPHB:Counterspell', className: 'wizard' }] };
    room.resources.p2 = { ...casterResources(), spellSlots: [{ level: 3, current: 1, max: 1 }] };
    const f = makeCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('spell:cast', {
      mapId: 'm1',
      tokenId: 't1',
      spellKey: 'XPHB:Fireball',
      slotLevel: 3,
      origin: { x: 100, y: 0 },
    });

    // Каст ещё не разрешён: цель невредима, открыто окно Counterspell.
    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30);
    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('spell:XPHB:Counterspell');

    const f2 = makeCtx(room, { playerId: 'p2' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'spell:XPHB:Counterspell' });

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBe(30);
    expect(room.chat.some((m) => m.kind === 'text' && m.system?.code === 'spells.countered')).toBe(true);
    expect(combatOf(room).turns.e3!.reactionUsed).toBe(true);
    expect(room.resources.p2!.spellSlots[0]!.current).toBe(0);
  });

  it('Палящая вспышка даёт помеху до броска и отменяет попадание', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20')] }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '16', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = {
      ...casterSheet(),
      ac: '16',
      classes: [{ className: 'cleric', level: 1, subclass: 'light' }],
      spells: [],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'cleric.light:wardingFlare',
          name: 'Палящая вспышка',
          current: 2,
          max: 2,
          reset: 'long',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1); // 19 и 3
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    // Броска ещё не было — открыто окно до атаки.
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack')).toBe(false);
    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.trigger).toBe('attackRoll');
    expect(offers[0]!.options.map((o) => o.id)).toContain('feature:cleric.light:wardingFlare');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'feature:cleric.light:wardingFlare' });
    rand.mockRestore();

    const attack = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'attack') as
      | { roll?: { total?: number } }
      | undefined;
    expect(attack?.roll?.total).toBe(3); // с помехой взят меньший бросок
    expect(room.resources.p1!.hp.current).toBe(30);
    expect(room.resources.p1!.resources[0]!.current).toBe(1);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
  });

  it('Ответный удар после промаха бьёт по атакующему с костью превосходства', () => {
    const room = makeRoom(
      [
        makeToken('t1', { attacks: [melee('Меч', 'd20+1')], hpMax: '30', hpCurrent: 30 }),
        makeToken('t2', { libraryItemId: 'lib2', ac: '16', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib2' }
    );
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    room.sheets.p1 = {
      ...casterSheet(),
      ac: '16',
      classes: [{ className: 'fighter', level: 5, subclass: 'battleMaster' }],
      spells: [],
      attacks: [melee('Рапира')],
    };
    room.resources.p1 = {
      ...casterResources(),
      spellSlots: [],
      resources: [
        {
          id: 'r1',
          key: 'fighter.battleMaster:superiorityDice',
          name: 'Кости превосходства',
          current: 4,
          max: 4,
          reset: 'short',
        },
      ],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1); // d20 = 3, d8 = 1
    const f = makeCtx(room, { dm: true });
    registerActionHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'attack', attackIndex: 0, targetIds: ['t2'] });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.trigger).toBe('attackMiss');
    expect(offers[0]!.options.map((o) => o.id)).toContain('feature:fighter.battleMaster:riposte');

    const f2 = makeCtx(room, { playerId: 'p1' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'feature:fighter.battleMaster:riposte' });
    rand.mockRestore();

    // Ответный удар (d20+20) попал: 1d8 + кость 1d8 = 2 при моке.
    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBe(28);
    expect(room.resources.p1!.resources[0]!.current).toBe(3);
    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack' && m.author === 't2')).toBe(true);
  });

  it('в режиме тестов окно NPC видят все игроки и может ответить любой', () => {
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100, faction: 'ally' }),
        makeToken('t2', {
          x: 150,
          y: 100,
          faction: 'enemy',
          attacks: [melee('Клыки')],
          statblock: {
            abilities,
            spellcasting: { ability: 'wis', spells: ['XPHB:Shield'], slots: [{ level: 1, max: 1, current: 1 }] },
          },
        }),
      ],
      { p1: 'lib1' }
    );
    room.testMode = true;
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    room.players.push({ id: 'p2', name: 'P2', role: 'player', isConnected: true, socketId: null });
    room.resources.p1 = casterResources();
    combatOf(room).entries.push({ id: 'e2', tokenId: 't2', name: 'B', imageUrl: '', initiative: 5, bonus: '' });
    const f = makeCtx(room, { playerId: 'p1' });
    registerCombatHandlers(f.ctx);
    registerReactionHandlers(f.ctx);

    f.invoke('combat:setMovement', {
      mapId: 'm1',
      tokenId: 't1',
      used: 30,
      path: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
      ],
    });

    const offers = pendingOffers('TEST');
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => o.id)).toContain('opportunity');

    const f2 = makeCtx(room, { playerId: 'p2' });
    registerReactionHandlers(f2.ctx);
    f2.invoke('reaction:respond', { id: offers[0]!.id, optionId: 'opportunity' });

    expect(combatOf(room).turns.e2!.reactionUsed).toBe(true);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'attack' && m.author === 't2')).toBe(true);
  });
});

describe('состояния (ограничения и авто-эффекты)', () => {
  it('состояние не даёт двигать токен игроку', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1', conditions: [{ key: 'grappled', name: 'Схвачен', rounds: null }] })],
      { p1: 'lib1' }
    );
    const f = makeCtx(room, { playerId: 'p1' });
    registerTokenHandlers(f.ctx);

    f.invoke('token:move', { mapId: 'm1', id: 't1', x: 500, y: 500 });

    expect(room.scene.maps[0]!.tokens[0]!.x).toBe(0);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(true);
  });

  it('недееспособный не действует', () => {
    const room = makeRoom(
      [makeToken('t1', { libraryItemId: 'lib1', conditions: [{ key: 'stunned', name: 'Ошеломлён', rounds: null }] })],
      { p1: 'lib1' }
    );
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'dash' });

    expect(combatOf(room).turns.e1!.actionUsed).toBe(false);
    expect(f.emitted.some((e) => e.event === 'chat:error')).toBe(true);
  });

  it('авто-крит по парализованной цели в упор', () => {
    const room = makeRoom(
      [
        makeToken('t1', { x: 100, y: 100 }),
        makeToken('t2', {
          x: 100,
          y: 100,
          hpMax: '50',
          hpCurrent: 50,
          conditions: [{ key: 'paralyzed', name: 'Парализован', rounds: null }],
        }),
      ],
      {}
    );
    room.scene.maps[0]!.tokens[0]!.attacks = [
      { name: 'Меч', hit: 'd20+20', damage: '1d6', damageType: 'slashing', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
    ];
    const f = makeCtx(room, { dm: true });
    registerDiceHandlers(f.ctx);

    f.invoke('dice:attack', { tokenId: 't1', targetId: 't2', attackIndex: 0 });

    const damage = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'damage');
    expect(damage && (damage as { crit?: boolean }).crit).toBe(true);
  });
});

describe('room:settings (режим тестов)', () => {
  it('игрок не может включить режим, ведущий может', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.players = [
      { id: 'p1', name: 'A', role: 'player', isConnected: true, socketId: null },
      { id: 'dm', name: 'D', role: 'dm', isConnected: true, socketId: null },
    ];

    const player = makeCtx(room, { playerId: 'p1' });
    registerRoomHandlers(player.ctx);
    player.invoke('room:settings', { testMode: true });
    expect(room.testMode).toBe(false);

    const dm = makeCtx(room, { playerId: 'dm', dm: true });
    registerRoomHandlers(dm.ctx);
    dm.invoke('room:settings', { testMode: true });
    expect(room.testMode).toBe(true);
    expect(room.chat.some((m) => m.kind === 'text')).toBe(true);
  });
});

describe('отдых и удаление токена', () => {
  it('хит дайс лечит кость + модификатор Телосложения', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.sheets.p1 = {
      ...casterSheet(),
      abilities: { ...casterSheet().abilities, con: 16 },
      classes: [{ className: 'fighter', level: 3 }],
    };
    room.resources.p1 = {
      ...casterResources(),
      hp: { current: 10, max: 30, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      hitDice: [{ die: 10, current: 3, max: 3 }],
    };
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // d10 = 6
    const f = makeCtx(room, { playerId: 'p1' });
    registerResourceHandlers(f.ctx);

    f.invoke('resources:hitDie', { die: 10 });
    rand.mockRestore();

    expect(room.resources.p1!.hitDice[0]!.current).toBe(2);
    expect(room.resources.p1!.hp.current).toBe(10 + 6 + 3); // кость + Телосложение (+3)
    const msg = room.chat.find((m) => m.kind === 'roll') as
      | { roll?: { expression?: string; total?: number }; label?: string; rollKind?: string; labelParams?: { subject?: string } }
      | undefined;
    expect(msg?.roll?.expression).toBe('1d10+3');
    expect(msg?.roll?.total).toBe(9);
    expect(msg?.label).toBeUndefined();
    expect(msg?.rollKind).toBe('plain');
    expect(msg?.labelParams?.subject).toBe('Хит дайс d10 (лечение 9)');
  });

  it('долгий отдых снимает эффекты и восстанавливает HP', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          libraryItemId: 'lib1',
          effects: [
            {
              id: 'ef1',
              name: 'Aid',
              duration: { type: 'permanent' },
              modifiers: [{ id: 'm1', target: 'maxHp', mode: 'add', value: 5 }],
            },
          ],
        }),
      ],
      { p1: 'lib1' }
    );
    room.resources.p1 = {
      ...casterResources(),
      hp: { current: 15, max: 25, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    };
    const f = makeCtx(room, { playerId: 'p1' });
    registerResourceHandlers(f.ctx);

    f.invoke('resources:rest', { type: 'long' });

    expect(room.resources.p1!.hp.max).toBe(20);
    expect(room.resources.p1!.hp.current).toBe(20);
    expect(room.scene.maps[0]!.tokens[0]!.effects).toHaveLength(0);
  });

  it('долгий отдых снимает зоны без концентрации (Daylight)', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.scene.maps[0]!.zones.push({
      id: 'z1',
      name: 'Daylight',
      sourceKey: 'XPHB:Daylight',
      sourceId: 't1',
      origin: { x: 200, y: 100 },
      direction: null,
      area: { shape: 'sphere', size: 60 },
      duration: { type: 'permanent' },
      light: { bright: 60, dim: 60, sunlight: true },
      occupants: [],
    });
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerResourceHandlers(f.ctx);

    f.invoke('resources:rest', { type: 'long' });

    expect(room.scene.maps[0]!.zones).toHaveLength(0);
  });

  it('долгий отдых возвращает из формы (своя Wild Shape и Polymorph-цель)', () => {
    const room = makeRoom(
      [
        makeToken('t1', {
          libraryItemId: 'lib1',
          cells: 2,
          x: 100,
          y: 100,
          shape: { key: 'XMM:Wolf', name: 'Wolf', kind: 'wildShape', hp: 6, maxHp: 6, ownCells: 1 },
          effects: [
            {
              id: 'conc1',
              name: 'Polymorph',
              sourceKey: 'XPHB:Polymorph',
              sourceId: 't1',
              concentration: true,
              duration: { type: 'concentration' },
              modifiers: [],
            },
          ],
        }),
        makeToken('t2', {
          libraryItemId: 'lib1',
          x: 300,
          y: 100,
          shape: { key: 'XMM:Wolf', name: 'Wolf', kind: 'polymorph', hp: 11, maxHp: 11, sourceTokenId: 't1' },
        }),
      ],
      { p1: 'lib1' }
    );
    room.resources.p1 = casterResources();
    const f = makeCtx(room, { playerId: 'p1' });
    registerResourceHandlers(f.ctx);

    f.invoke('resources:rest', { type: 'long' });

    const [t1, t2] = room.scene.maps[0]!.tokens;
    expect(t1!.shape).toBeUndefined();
    expect(t1!.cells).toBe(1); // подошва вернулась к своей
    expect(t1!.effects).toHaveLength(0); // якорь концентрации Polymorph снят
    expect(t2!.shape).toBeUndefined();
  });

  it('удаление кастера снимает его концентрацию с других токенов', () => {
    const room = makeRoom(
      [
        makeToken('t1'),
        makeToken('t2', {
          effects: [
            {
              id: 'ef1',
              name: 'Hex',
              concentration: true,
              sourceId: 't1',
              duration: { type: 'concentration' },
              modifiers: [],
            },
          ],
        }),
      ],
      {}
    );
    const f = makeCtx(room, { dm: true });
    registerTokenHandlers(f.ctx);

    f.invoke('token:remove', { mapId: 'm1', id: 't1' });

    expect(room.scene.maps[0]!.tokens.find((t) => t.id === 't2')?.effects).toHaveLength(0);
  });
});

describe('очередь окон реакций (R6.5)', () => {
  it('второй триггер ждёт в очереди и открывается после первого', () => {
    const room = makeRoom([makeToken('t1'), makeToken('t2')], { p1: 'lib1' });
    room.players.push({ id: 'p1', name: 'P1', role: 'player', isConnected: true, socketId: null });
    const f = makeCtx(room, { playerId: 'p1', dm: true });
    registerReactionHandlers(f.ctx);

    const t1 = room.scene.maps[0]!.tokens[0]!;
    const t2 = room.scene.maps[0]!.tokens[1]!;
    const resumed: string[] = [];
    const offer = (token: typeof t1, name: string) => ({
      token,
      audience: ['p1'],
      options: [{ id: 'op', name, kind: 'opportunity' as const }],
    });

    const first = openReactionWindow(f.ctx, room, {
      mapId: 'm1',
      trigger: 'leaveReach',
      sourceName: 'A',
      offers: [offer(t1, 'OA1')],
      resume: () => resumed.push('first'),
    });
    const second = openReactionWindow(f.ctx, room, {
      mapId: 'm1',
      trigger: 'damage',
      sourceName: 'B',
      offers: [offer(t2, 'OA2')],
      resume: () => resumed.push('second'),
    });

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(pendingOffers('TEST')).toHaveLength(1);
    expect(pendingOffers('TEST')[0]!.options[0]!.name).toBe('OA1');

    f.invoke('reaction:respond', { id: pendingOffers('TEST')[0]!.id, optionId: null });
    expect(resumed).toEqual(['first']);
    expect(pendingOffers('TEST')).toHaveLength(1);
    expect(pendingOffers('TEST')[0]!.options[0]!.name).toBe('OA2');

    f.invoke('reaction:respond', { id: pendingOffers('TEST')[0]!.id, optionId: null });
    expect(resumed).toEqual(['first', 'second']);
    expect(pendingOffers('TEST')).toHaveLength(0);
  });
});

describe('библиотека и статблок', () => {
  it('статблок из библиотеки переезжает на выставленный токен', () => {
    const room = makeRoom([], {});
    const f = makeCtx(room, { dm: true });
    registerLibraryHandlers(f.ctx);
    registerTokenHandlers(f.ctx);
    f.invoke('library:add', {
      name: 'Гоблин',
      description: '',
      imageUrl: '',
      cells: 1,
      round: false,
      initiativeBonus: '',
      isPlayerToken: false,
      owner: '',
      attacks: [],
      ac: '12',
      hpMax: '7',
      showStats: false,
      canInteract: false,
      damageDefenses: [],
      statblock: { abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }, multiattack: 2 },
    });
    const item = room.library[0]!;
    expect(item.statblock?.multiattack).toBe(2);

    f.invoke('token:add', { mapId: 'm1', libraryItemId: item.id, x: 100, y: 100 });
    expect(room.scene.maps[0]!.tokens[0]!.statblock?.multiattack).toBe(2);
    expect(room.scene.maps[0]!.tokens[0]!.hpCurrent).toBe(7); // полное HP при выставлении
  });

  it('игрок не патчит DM-поля предмета библиотеки', () => {
    const room = makeRoom([], {});
    const dm = makeCtx(room, { dm: true });
    registerLibraryHandlers(dm.ctx);
    dm.invoke('library:add', {
      name: 'Гоблин',
      description: '',
      imageUrl: '',
      cells: 1,
      round: false,
      initiativeBonus: '',
      isPlayerToken: false,
      owner: '',
      attacks: [],
      ac: '12',
      hpMax: '7',
      showStats: false,
      canInteract: false,
      damageDefenses: [],
    });
    const item = room.library[0]!;

    const player = makeCtx(room, { playerId: 'p1' });
    registerLibraryHandlers(player.ctx);
    player.invoke('library:update', {
      id: item.id,
      patch: {
        name: 'Новый гоблин',
        owner: 'p1',
        isPlayerToken: true,
        showStats: true,
        canInteract: true,
        statblock: { abilities: { str: 20, dex: 20, con: 20, int: 20, wis: 20, cha: 20 } },
      },
    });

    expect(item.name).toBe('Новый гоблин');
    expect(item.owner).toBe('');
    expect(item.isPlayerToken).toBe(false);
    expect(item.showStats).toBe(false);
    expect(item.canInteract).toBe(false);
    expect(item.statblock).toBeUndefined();
  });

  it('DM патчит DM-поля предмета библиотеки', () => {
    const room = makeRoom([], {});
    const dm = makeCtx(room, { dm: true });
    registerLibraryHandlers(dm.ctx);
    dm.invoke('library:add', {
      name: 'Гоблин',
      description: '',
      imageUrl: '',
      cells: 1,
      round: false,
      initiativeBonus: '',
      isPlayerToken: false,
      owner: '',
      attacks: [],
      ac: '12',
      hpMax: '7',
      showStats: false,
      canInteract: false,
      damageDefenses: [],
    });
    const item = room.library[0]!;

    dm.invoke('library:update', {
      id: item.id,
      patch: {
        owner: 'p1',
        isPlayerToken: true,
        showStats: true,
        canInteract: true,
        statblock: { abilities: { str: 20, dex: 20, con: 20, int: 20, wis: 20, cha: 20 } },
      },
    });

    expect(item.owner).toBe('p1');
    expect(item.isPlayerToken).toBe(true);
    expect(item.showStats).toBe(true);
    expect(item.canInteract).toBe(true);
    expect(item.statblock?.abilities.str).toBe(20);
  });

  it('токен персонажа получает HP из ресурсов игрока', () => {
    const room = makeRoom([], {});
    const f = makeCtx(room, { dm: true });
    registerLibraryHandlers(f.ctx);
    registerTokenHandlers(f.ctx);
    f.invoke('library:add', {
      name: 'Конан',
      description: '',
      imageUrl: '',
      cells: 1,
      round: false,
      initiativeBonus: '',
      isPlayerToken: true,
      owner: '',
      attacks: [],
      ac: '',
      hpMax: '',
      showStats: false,
      canInteract: false,
      damageDefenses: [],
    });
    const item = room.library[0]!;
    room.controllers.p1 = item.id;
    room.resources.p1 = makeResources({ hp: { current: 12, max: 20, temp: 2, deathSuccesses: 0, deathFailures: 0 } });
    room.sheets.p1 = { ...casterSheet(), name: 'Конан', ac: '', hpMax: '' };

    const player = makeCtx(room, { playerId: 'p1' });
    registerTokenHandlers(player.ctx);
    player.invoke('token:add', { mapId: 'm1', libraryItemId: item.id, x: 100, y: 100 });

    const token = room.scene.maps[0]!.tokens[0]!;
    expect(token.hpMax).toBe(''); // у персонажа статы не хранятся в токене
    expect(token.hpCurrent).toBe(0);
    const stats = actorStats(room, token);
    expect(stats.hp).toEqual({ max: 20, current: 12, temp: 2 });
    expect(stats.name).toBe('Конан');
  });
});

describe('анимация броска игрока (шанс)', () => {
  const animOf = (f: ReturnType<typeof makeCtx>) =>
    f.selfEvents('roll:anim')[0]?.payload as { roll: { total: number } } | undefined;

  it('проверка: шанс 100 — анимация с выпавшим d20 и обычное сообщение', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.code = 'RA1';
    const f = makeCtx(room, { playerId: 'p1' });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // d20 = 11
    registerDiceHandlers(f.ctx);
    registerRollAnimHandlers(f.ctx);

    f.invoke('player:rollAnimChance', { value: 100 });
    expect(room.players.find((p) => p.id === 'p1')!.rollAnimChance).toBe(100);

    f.invoke('dice:roll', { expression: 'd20+5', rollKind: 'check', subject: 'Атлетика' });
    rand.mockRestore();

    expect(room.chat.filter((m) => m.kind === 'roll')).toHaveLength(1);
    expect(animOf(f)?.roll.total).toBe(16);
  });

  it('шанс 0: бросок обычный, анимации нет', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.code = 'RA2';
    const f = makeCtx(room, { playerId: 'p1' });
    registerDiceHandlers(f.ctx);
    registerRollAnimHandlers(f.ctx);

    f.invoke('dice:roll', { expression: 'd20+5', rollKind: 'check', subject: 'Атлетика' });

    expect(f.selfEvents('roll:anim')).toHaveLength(0);
    expect(room.chat.filter((m) => m.kind === 'roll')).toHaveLength(1);
  });

  it('настройка зажимается в 0–100', () => {
    const room = makeRoom([], {});
    room.code = 'RA3';
    const f = makeCtx(room, { playerId: 'p1' });
    registerRollAnimHandlers(f.ctx);

    f.invoke('player:rollAnimChance', { value: 150 });
    expect(room.players.find((p) => p.id === 'p1')!.rollAnimChance).toBe(100);
    f.invoke('player:rollAnimChance', { value: -20 });
    expect(room.players.find((p) => p.id === 'p1')!.rollAnimChance).toBe(0);
  });

  it('атака: шанс 100 — анимация у бросающего, атака проходит сразу', () => {
    const sword: AttackEntry = {
      name: 'Клинок',
      hit: 'd20+20',
      damage: '1d8+3',
      damageType: 'slashing',
      rangeType: 'melee',
      rangeNormal: 5,
      rangeLong: 0,
    };
    const room = makeRoom(
      [
        makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
        makeToken('t2', { x: 150, y: 100, ac: '10', hpMax: '30', hpCurrent: 30 }),
      ],
      { p1: 'lib1' }
    );
    room.code = 'RA4';
    room.sheets.p1 = { ...casterSheet(), attacks: [sword] };
    const f = makeCtx(room, { playerId: 'p1' });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    registerDiceHandlers(f.ctx);
    registerRollAnimHandlers(f.ctx);
    f.invoke('player:rollAnimChance', { value: 100 });

    f.invoke('dice:attack', { tokenId: 't1', targetId: 't2', attackIndex: 0 });
    rand.mockRestore();

    expect(combatOf(room).turns.e1!.actionUsed).toBe(true);
    expect(f.selfEvents('roll:anim')).toHaveLength(1);
    expect(room.scene.maps[0]!.tokens.find((t) => t.id === 't2')!.hpCurrent).toBeLessThan(30);
  });

  it('проверка характеристики (Скрыться): анимация при шансе 100', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.code = 'RA5';
    room.sheets.p1 = casterSheet();
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);
    registerRollAnimHandlers(f.ctx);
    f.invoke('player:rollAnimChance', { value: 100 });

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'hide' });

    expect(f.selfEvents('roll:anim')).toHaveLength(1);
    expect(room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'check')).toBe(true);
  });

  it('галка Adv/Dis: Скрыться с преимуществом даёт d20a', () => {
    const room = makeRoom([makeToken('t1', { libraryItemId: 'lib1' })], { p1: 'lib1' });
    room.code = 'RA6';
    room.sheets.p1 = casterSheet();
    const f = makeCtx(room, { playerId: 'p1' });
    registerActionHandlers(f.ctx);

    f.invoke('action:use', { mapId: 'm1', tokenId: 't1', actionId: 'hide', advantage: 'a' });

    const roll = room.chat.find((m) => m.kind === 'roll' && m.rollKind === 'check') as
      | { roll: { dice: { advantage: string | null }[] } }
      | undefined;
    expect(roll?.roll.dice[0]?.advantage).toBe('a');
  });
});
