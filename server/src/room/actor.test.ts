import { describe, expect, it } from 'vitest';
import { emptyAttack, type CharacterSheet, type Sense } from 'shared';
import { makeResources, makeRoom, makeToken } from '../test/fixtures';
import { actorStats } from './actor';

function sheet(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    name: 'Конан',
    abilities: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 8 },
    proficiencyBonus: '2',
    saves: {},
    skills: {},
    attacks: [{ ...emptyAttack(), name: 'Меч', hit: 'd20+5', damage: 'd8+3' }],
    classes: [],
    spells: [],
    hpMax: '',
    ac: '16',
    speed: 25,
    senses: [{ type: 'darkvision', range: 60 }],
    damageDefenses: [{ id: 'd1', type: 'resistance', damageType: 'fire' }],
    ...overrides,
  };
}

describe('actorStats', () => {
  it('персонаж: имя/статы из листа, HP из ресурсов, инициатива от Ловкости', () => {
    const room = makeRoom({
      controllers: { p1: 'lib1' },
      sheets: { p1: sheet() },
      resources: { p1: makeResources({ hp: { current: 12, max: 20, temp: 3, deathSuccesses: 0, deathFailures: 0 } }) },
    });
    const token = makeToken('t1', {
      libraryItemId: 'lib1',
      name: 'Токен',
      initiativeBonus: '+9',
      ac: '10',
      speed: 30,
      senses: [{ type: 'blindsight', range: 10 }],
    });

    const stats = actorStats(room, token);
    expect(stats.character).toBe(true);
    expect(stats.controllerId).toBe('p1');
    expect(stats.name).toBe('Конан');
    expect(stats.ac).toBe(16);
    expect(stats.speed).toBe(25);
    expect(stats.initiativeBonus).toBe('+2');
    expect(stats.hp).toEqual({ max: 20, current: 12, temp: 3 });
    expect(stats.attacks.map((a) => a.name)).toEqual(['Меч']);
    expect(stats.senses).toEqual([{ type: 'darkvision', range: 60 }]);
    expect(stats.damageDefenses).toEqual([{ id: 'd1', type: 'resistance', damageType: 'fire' }]);
    expect(stats.abilities?.str).toBe(16);
  });

  it('персонаж без настроенных ресурсов: HP из полей токена', () => {
    const room = makeRoom({ controllers: { p1: 'lib1' }, sheets: { p1: sheet() } });
    const token = makeToken('t1', { libraryItemId: 'lib1', hpMax: '9', hpCurrent: 4, hpTemp: 1 });

    expect(actorStats(room, token).hp).toEqual({ max: 9, current: 4, temp: 1 });
  });

  it('пустое имя в листе — фолбэк на имя токена', () => {
    const room = makeRoom({ controllers: { p1: 'lib1' }, sheets: { p1: sheet({ name: '  ' }) } });
    const token = makeToken('t1', { libraryItemId: 'lib1', name: 'Странник' });

    expect(actorStats(room, token).name).toBe('Странник');
  });

  it('монстр/призыв без листа: статы и инициатива из токена', () => {
    const room = makeRoom();
    const senses: Sense[] = [{ type: 'blindsight', range: 30 }];
    const token = makeToken('t1', {
      name: 'Гоблин',
      ac: '15',
      speed: 20,
      hpMax: '12',
      hpCurrent: 7,
      initiativeBonus: '+1',
      senses,
      attacks: [{ ...emptyAttack(), name: 'Кинжал', hit: 'd20+4', damage: 'd4+2' }],
      damageDefenses: [{ id: 'd2', type: 'immunity', damageType: 'poison' }],
      statblock: { abilities: { str: 8, dex: 16, con: 10, int: 10, wis: 8, cha: 8 } },
    });

    const stats = actorStats(room, token);
    expect(stats.character).toBe(false);
    expect(stats.name).toBe('Гоблин');
    expect(stats.ac).toBe(15);
    expect(stats.speed).toBe(20);
    expect(stats.initiativeBonus).toBe('+1');
    expect(stats.hp).toEqual({ max: 12, current: 7, temp: 0 });
    expect(stats.abilities?.dex).toBe(16);
    expect(stats.attacks.map((a) => a.name)).toEqual(['Кинжал']);
    expect(stats.senses).toEqual(senses);
    expect(stats.damageDefenses).toEqual([{ id: 'd2', type: 'immunity', damageType: 'poison' }]);
  });
});
