import { describe, expect, it, vi } from 'vitest';
import { automationForSpell, type CharacterSheet, type SpellDef } from 'shared';
import { hydrateRoom } from '../roomNormalize';
import { toPersistedRoom, type Room } from '../roomTypes';
import { findSpell } from '../spells';
import { makeConnCtx } from '../test/ctx';
import { makeResources, makeRoom, makeToken } from '../test/fixtures';
import { registerCustomHandlers } from './custom';
import { registerSpellHandlers } from './spells';

/** Копия канона: Jallarzi с огнём и параличом (пример R16 в AUTOMATION.md §5). */
const JALLARZI_COPY = JSON.stringify({
  extends: "XPHB:Jallarzi's Storm of Radiance",
  key: 'CUSTOM:Jallarzi Fire',
  name: 'Jallarzi Fire',
  patch: {
    'damage.parts': [{ dice: '5d10', type: 'fire' }],
    'zone.triggers.enter.damage.parts': [{ dice: '5d10', type: 'fire' }],
    'zone.triggers.endOfTurn.damage.parts': [{ dice: '5d10', type: 'fire' }],
    'zone.aura.effects.storm.conditions': ['paralyzed'],
  },
});

const FIREBOLT_COPY = JSON.stringify({
  extends: 'XPHB:Fire Bolt',
  key: 'CUSTOM:Ледяной снаряд',
  name: 'Ледяной снаряд',
  patch: { 'damage.types': ['cold'] },
});

function dmSetup() {
  const room = makeRoom();
  const f = makeConnCtx(room, { dm: true });
  registerCustomHandlers(f.ctx);
  return { room, f };
}

function casterSheet(customKey: string): CharacterSheet {
  return {
    name: 'Кастер',
    senses: [],
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    proficiencyBonus: '3',
    saves: {},
    skills: {},
    attacks: [],
    classes: [{ className: 'wizard', level: 5 }],
    spells: [{ key: customKey, className: 'wizard' }],
    hpMax: '30',
    ac: '12',
    speed: 30,
    damageDefenses: [],
  };
}

describe('кастомные заклинания комнаты (R16 срез 5)', () => {
  it('копия extends+patch: механика меняется, база наследуется', () => {
    const { room, f } = dmSetup();
    f.invoke('custom:import', { json: JALLARZI_COPY });

    expect(room.customSpecs).toHaveLength(1);
    const custom = room.customSpecs[0]!;
    expect(custom.key).toBe('CUSTOM:Jallarzi Fire');
    expect(custom.level).toBe(5);

    const def = automationForSpell(custom, { castLevel: 5, characterLevel: 5 });
    expect(def.damage?.dice).toBe('5d10fire');
    expect(def.zone?.triggers?.endOfTurn?.damage?.dice).toBe('5d10fire');
    expect(def.zone?.aura?.effects?.[0]?.conditions).toEqual(['paralyzed']);
    expect(f.emitted.some((e) => e.event === 'room:customSpecs')).toBe(true);
  });

  it('каст кастомного заклинания: сервер находит его в комнате', () => {
    const room = makeRoom({ controllers: { p1: 'lib1' } });
    room.scene.maps[0]!.tokens.push(
      makeToken('t1', { libraryItemId: 'lib1', x: 100, y: 100 }),
      makeToken('t2', { x: 150, y: 100, hpMax: '30', hpCurrent: 30 })
    );
    const dm = makeConnCtx(room, { dm: true });
    registerCustomHandlers(dm.ctx);
    dm.invoke('custom:import', { json: FIREBOLT_COPY });

    const key = 'CUSTOM:Ледяной снаряд';
    expect(automationForSpell(findSpell(key, room)!, { characterLevel: 5 }).damage?.types).toEqual(['cold']);

    room.sheets.p1 = casterSheet(key);
    room.resources.p1 = makeResources({ spellSlots: [{ level: 3, current: 1, max: 1 }] });
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerSpellHandlers(f.ctx);

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    f.invoke('spell:cast', { mapId: 'm1', tokenId: 't1', spellKey: key, targetIds: ['t2'] });
    rand.mockRestore();

    expect(room.scene.maps[0]!.tokens[1]!.hpCurrent).toBeLessThan(30);
    expect(room.chat.some((m) => m.kind === 'roll')).toBe(true);
  });

  it('кастом призыва несёт профиль скейла из записи (срез 5b)', () => {
    const { room, f } = dmSetup();
    f.invoke('custom:import', {
      json: JSON.stringify({
        extends: 'XPHB:Summon Fey',
        key: 'CUSTOM:Фея-скейл',
        name: 'Фея-скейл',
        patch: { 'summon.profile.hpPerLevel': 100 },
      }),
    });
    const custom = room.customSpecs[0]!;
    const def = automationForSpell(custom, { castLevel: 4, characterLevel: 5 });
    // Профиль пришёл из канонической записи (перенесён `npm run catalog` из бестиария)…
    expect(def.summon?.profile).toMatchObject({ baseLevel: 3, hpPerLevel: 100 });
    // …и цель/инициатива призыва не потерялись при копировании.
    expect(def.summon).toMatchObject({ creature: 'XPHB:Fey Spirit', initiative: 'afterCaster' });
  });

  it('импорт без прав DM игнорируется', () => {
    const room = makeRoom();
    const f = makeConnCtx(room, { playerId: 'p1' });
    registerCustomHandlers(f.ctx);
    f.invoke('custom:import', { json: JALLARZI_COPY });
    expect(room.customSpecs).toHaveLength(0);
  });

  it('битый JSON и несуществующая база — chat:error customInvalid, записи нет', () => {
    const { room, f } = dmSetup();
    f.invoke('custom:import', { json: '{не json' });
    f.invoke('custom:import', { json: JSON.stringify({ extends: 'XPHB:Нет такого', name: 'X' }) });
    expect(room.customSpecs).toHaveLength(0);
    expect(f.selfEvents('chat:error').map((e) => (e.payload as { code: string }).code)).toEqual([
      'customInvalid',
      'customInvalid',
    ]);
  });

  it('повторный импорт того же ключа заменяет запись, remove удаляет', () => {
    const { room, f } = dmSetup();
    f.invoke('custom:import', { json: JALLARZI_COPY });
    f.invoke('custom:import', {
      json: JSON.stringify({
        extends: "XPHB:Jallarzi's Storm of Radiance",
        key: 'CUSTOM:Jallarzi Fire',
        name: 'Jallarzi Fire v2',
        patch: { 'zone.aura.effects.storm.conditions': ['stunned'] },
      }),
    });
    expect(room.customSpecs).toHaveLength(1);
    expect(room.customSpecs[0]!.name).toBe('Jallarzi Fire v2');

    f.invoke('custom:remove', 'CUSTOM:Jallarzi Fire');
    expect(room.customSpecs).toHaveLength(0);
  });

  it('кастомы переживают сохранение/загрузку комнаты', () => {
    const { room, f } = dmSetup();
    f.invoke('custom:import', { json: JALLARZI_COPY });
    const restored: Room = hydrateRoom(toPersistedRoom(room));
    expect(restored.customSpecs.map((s: SpellDef) => s.key)).toEqual(['CUSTOM:Jallarzi Fire']);
    expect(findSpell('CUSTOM:Jallarzi Fire', restored)?.name).toBe('Jallarzi Fire');
  });
});
