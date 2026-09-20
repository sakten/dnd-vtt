import { describe, expect, it } from 'vitest';
import {
  TOKEN_FIELD_SPECS,
  normalizeTokenFields,
  normalizeTokenFieldsPatch,
  redactLibraryItem,
  redactToken,
} from './fields';
import { DEFAULT_ABILITIES } from './domain/core';
import type { LibraryItem, Token, TokenFields } from './domain/token';

const FULL_FIELDS: TokenFields = {
  name: 'Гоблин',
  description: 'Описание',
  imageUrl: '/uploads/goblin.png',
  cells: 2,
  round: true,
  initiativeBonus: '+2',
  isPlayerToken: true,
  owner: 'Влад',
  attacks: [
    { name: 'Меч', hit: 'd20+3', damage: 'd6+1', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
  ],
  ac: '15',
  hpMax: '40',
  showStats: true,
  canInteract: true,
  damageDefenses: [{ id: 'd1', type: 'resistance', damageType: 'fire' }],
  statblock: { abilities: { ...DEFAULT_ABILITIES }, multiattack: 2 },
};

const FULL_TOKEN: Token = {
  ...FULL_FIELDS,
  id: 't1',
  libraryItemId: 'l1',
  x: 100,
  y: 100,
  w: 100,
  h: 100,
  scale: 1,
  rotation: 0,
  z: 1,
  visible: true,
  ownerId: '',
  lockedBy: null,
  hpCurrent: 30,
  hpTemp: 5,
  faction: 'enemy',
  speed: 30,
  senses: [],
  conditions: [],
  effects: [],
};

describe('реестр полей', () => {
  it('покрывает все поля TokenFields и заполняет их', () => {
    const expected: (keyof TokenFields)[] = [
      'name',
      'description',
      'imageUrl',
      'cells',
      'round',
      'initiativeBonus',
      'isPlayerToken',
      'owner',
      'attacks',
      'ac',
      'hpMax',
      'showStats',
      'canInteract',
      'damageDefenses',
      'statblock',
      'summon',
    ];
    expect(Object.keys(TOKEN_FIELD_SPECS).sort()).toEqual([...expected].sort());

    const fields = normalizeTokenFields({}, 40);
    for (const key of Object.keys(TOKEN_FIELD_SPECS) as (keyof TokenFields)[]) {
      if (key === 'statblock' || key === 'summon') {
        expect(fields[key]).toBeUndefined();
        continue;
      }
      expect(fields[key], key).toBeDefined();
    }
  });
});

describe('normalizeTokenFields', () => {
  it('обрезает строки и принимает AC/HP только парой', () => {
    const fields = normalizeTokenFields({ name: 'x'.repeat(80), ac: '15', hpMax: '' });
    expect(fields.name).toHaveLength(40);
    expect(fields.ac).toBe('');
    expect(fields.hpMax).toBe('');
    const paired = normalizeTokenFields({ name: 'Дракон', ac: '15', hpMax: '40' });
    expect(paired.ac).toBe('15');
    expect(paired.hpMax).toBe('40');
  });

  it('имя предмета библиотеки — до 60 символов', () => {
    expect(normalizeTokenFields({ name: 'y'.repeat(80) }, 60).name).toHaveLength(60);
  });

  it('keepAcHp сохраняет непарные AC/HP из старых данных', () => {
    const fields = normalizeTokenFields({ hpMax: '17' }, 40, { keepAcHp: true });
    expect(fields.hpMax).toBe('17');
    expect(fields.ac).toBe('');
  });
});

describe('normalizeTokenFieldsPatch', () => {
  it('меняет только присланные поля, AC — парой с текущим HP', () => {
    expect(normalizeTokenFieldsPatch({ ac: '15' }, { ac: '', hpMax: '' })).not.toHaveProperty('ac');
    expect(normalizeTokenFieldsPatch({ ac: '15' }, { ac: '', hpMax: '10' }).ac).toBe('15');
    expect(normalizeTokenFieldsPatch({ name: 'Гоблин' }, { ac: '', hpMax: '' })).toEqual({ name: 'Гоблин' });
    // Картинка приходит отдельным событием загрузки, патчем — игнор.
    expect(normalizeTokenFieldsPatch({ imageUrl: '/x.png' }, { ac: '', hpMax: '' })).toEqual({});
  });

  it('поля DM (owner/showStats) — только с includeDm', () => {
    expect(normalizeTokenFieldsPatch({ showStats: true }, { ac: '', hpMax: '' })).not.toHaveProperty('showStats');
    expect(
      normalizeTokenFieldsPatch({ showStats: true }, { ac: '', hpMax: '' }, { includeDm: true }).showStats
    ).toBe(true);
  });
});

describe('redactToken / redactLibraryItem', () => {
  it('токен: скрывает AC/HP, текущие HP, статблок и защиты, остальное сохраняет', () => {
    const redacted = redactToken(FULL_TOKEN);
    expect(redacted).toMatchObject({
      ac: '',
      hpMax: '',
      hpCurrent: 0,
      damageDefenses: [],
      name: 'Гоблин',
      attacks: FULL_TOKEN.attacks,
      hpTemp: 5,
      faction: 'enemy',
      speed: 30,
    });
    expect(redacted.statblock).toBeUndefined();
  });

  it('предмет библиотеки: скрывает AC/HP, атаки, защиты и статблок', () => {
    const item: LibraryItem = { ...FULL_FIELDS, id: 'l1' };
    const redacted = redactLibraryItem(item);
    expect(redacted).toMatchObject({
      ac: '',
      hpMax: '',
      attacks: [],
      damageDefenses: [],
      name: 'Гоблин',
      imageUrl: '/uploads/goblin.png',
    });
    expect(redacted.statblock).toBeUndefined();
  });

  it('не мутирует исходный объект', () => {
    const token = structuredClone(FULL_TOKEN);
    redactToken(token);
    expect(token.ac).toBe('15');
    expect(token.hpCurrent).toBe(30);
    expect(token.statblock).toBeDefined();
  });
});
