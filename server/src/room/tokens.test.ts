import { describe, expect, it } from 'vitest';
import { normalizeTokenFields, type LibraryItem } from 'shared';
import { makeRoom } from '../test/fixtures';
import { addToken, clearCharacterStats } from './tokens';

const deps = { saveSoon: () => void 0 };

const item = (over: Partial<LibraryItem> = {}): LibraryItem => ({
  ...normalizeTokenFields({
    name: 'Гоблин',
    ac: '15',
    hpMax: '7',
    attacks: [{ name: 'Скимитар', hit: '+4', damage: '1d6+2', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 }],
  }),
  id: 'l1',
  ...over,
});

describe('clearCharacterStats', () => {
  it('обнуляет все производные поля', () => {
    const room = makeRoom();
    const token = addToken(deps, room, 'm1', item(), 0, 0, '')!;
    clearCharacterStats(token);
    expect(token).toMatchObject({
      ac: '',
      hpMax: '',
      hpCurrent: 0,
      hpTemp: 0,
      attacks: [],
      damageDefenses: [],
      initiativeBonus: '',
    });
  });
});

describe('addToken: статы персонажа и монстра', () => {
  it('монстру статы из предмета, персонажу — пустые (истина в листе)', () => {
    const monsterRoom = makeRoom();
    const monster = addToken(deps, monsterRoom, 'm1', item(), 0, 0, '')!;
    expect(monster).toMatchObject({ ac: '15', hpMax: '7', hpCurrent: 7 });
    expect(monster.attacks).toHaveLength(1);

    const charRoom = makeRoom({ controllers: { p1: 'l1' } });
    const character = addToken(deps, charRoom, 'm1', item({ isPlayerToken: true }), 0, 0, '')!;
    expect(character).toMatchObject({
      ac: '',
      hpMax: '',
      hpCurrent: 0,
      attacks: [],
      damageDefenses: [],
      initiativeBonus: '',
    });
  });
});
