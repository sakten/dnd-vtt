import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEED,
  MAX_ATTACKS,
  activeAttacks,
  emptyCombatState,
  emptyTurnState,
  normalizeActions,
  normalizeAttacks,
  normalizeCombatState,
  normalizeConditions,
  normalizeEffects,
  normalizeSheet,
  normalizeStatblock,
  normalizeTurnState,
} from './types';

describe('normalizeAttacks', () => {
  it('по умолчанию — одна пустая строка', () => {
    expect(normalizeAttacks(undefined)).toHaveLength(1);
    expect(normalizeAttacks([])).toHaveLength(1);
  });

  it('сохраняет динамическую длину и обрезает пустые строки в конце', () => {
    expect(normalizeAttacks([{ name: 'Меч' }, { name: 'Лук' }])).toHaveLength(2);
    expect(normalizeAttacks([{ name: 'Меч' }, { name: '' }])).toHaveLength(1);
    expect(normalizeAttacks([{ name: '' }, { name: 'Меч' }])).toHaveLength(2);
  });

  it('ограничивает список сверху MAX_ATTACKS', () => {
    const many = Array.from({ length: MAX_ATTACKS + 5 }, (_, i) => ({ name: `A${i}` }));
    expect(normalizeAttacks(many)).toHaveLength(MAX_ATTACKS);
  });

  it('переносит старую одиночную атаку', () => {
    const attacks = normalizeAttacks(undefined, { name: 'Лук', hit: 'd20+7', damage: 'd8+3' });
    expect(attacks).toEqual([
      { name: 'Лук', hit: 'd20+7', damage: 'd8+3', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
    ]);
  });

  it('не перетирает существующий список legacy-атакой', () => {
    const attacks = normalizeAttacks([{ name: 'Меч', hit: 'd20+5', damage: 'd8+3' }], {
      name: 'Старое',
      hit: 'd20',
      damage: 'd6',
    });
    expect(attacks[0].name).toBe('Меч');
  });
});

describe('normalizeSheet', () => {
  it('мигрирует старую карточку с attack в attacks', () => {
    const sheet = normalizeSheet({
      name: 'Конан',
      proficiencyBonus: 'd4',
      attack: { name: 'Меч', hit: 'd20+5', damage: 'd8+3' },
    });
    expect(sheet.attacks).toHaveLength(1);
    expect(sheet.attacks[0].name).toBe('Меч');
    expect(sheet.abilities.str).toBe(10);
  });

  it('сохраняет уже новый список оружия', () => {
    const sheet = normalizeSheet({
      attacks: [
        { name: 'A', hit: 'd20', damage: 'd6', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
        { name: 'B', hit: 'd20', damage: 'd4', rangeType: 'ranged', rangeNormal: 80, rangeLong: 320 },
        { name: 'C', hit: '', damage: '', rangeType: 'none', rangeNormal: 0, rangeLong: 0 },
      ],
    });
    expect(sheet.attacks.map((a) => a.name)).toEqual(['A', 'B', 'C']);
  });

  it('нормализует класс брони (AC)', () => {
    expect(normalizeSheet({}).ac).toBe('');
    expect(normalizeSheet({ ac: '18' }).ac).toBe('18');
    expect(normalizeSheet({ ac: 'x'.repeat(20) }).ac).toHaveLength(10);
  });
});

describe('activeAttacks', () => {
  it('отбрасывает пустые и без формул', () => {
    const sheet = normalizeSheet({
      attacks: [
        { name: 'Меч', hit: 'd20+5', damage: 'd8+3', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
        { name: 'Только имя', hit: '', damage: '', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
        { name: '', hit: '', damage: '', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
      ],
    });
    expect(activeAttacks(sheet).map((a) => a.name)).toEqual(['Меч']);
  });
});

describe('normalizeSheet speed', () => {
  it('дефолт и зажим', () => {
    expect(normalizeSheet({}).speed).toBe(DEFAULT_SPEED);
    expect(normalizeSheet({ speed: 25 }).speed).toBe(25);
    expect(normalizeSheet({ speed: -5 }).speed).toBe(0);
    expect(normalizeSheet({ speed: 'abc' } as never).speed).toBe(DEFAULT_SPEED);
  });
});

describe('turn state', () => {
  it('emptyTurnState заполняет поля', () => {
    expect(emptyTurnState()).toEqual({
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      movementUsed: 0,
      diagonalsUsed: 0,
      movementMax: DEFAULT_SPEED,
      extraActions: 0,
      extraBonusActions: 0,
      attacksRemaining: 0,
      legendaryRemaining: 0,
      legendaryMax: 0,
      concentrationId: null,
    });
  });

  it('normalizeTurnState чинит мусор', () => {
    const turn = normalizeTurnState({ actionUsed: 1, movementUsed: -10, concentrationId: 42 });
    expect(turn.actionUsed).toBe(false);
    expect(turn.movementUsed).toBe(0);
    expect(turn.concentrationId).toBeNull();
  });
});

describe('normalizeCombatState', () => {
  it('legacy без round/currentIndex/turns получает дефолты', () => {
    const entry = { id: 'e1', tokenId: null, name: 'A', imageUrl: '', initiative: 10, bonus: '' };
    const combat = normalizeCombatState({ active: true, entries: [entry] });
    expect(combat.active).toBe(true);
    expect(combat.entries).toHaveLength(1);
    expect(combat.round).toBe(0);
    expect(combat.currentIndex).toBe(-1);
    expect(combat.turns).toEqual({});
  });

  it('нормализует turns и зажимает currentIndex', () => {
    const entry = { id: 'e1', tokenId: null, name: 'A', imageUrl: '', initiative: 10, bonus: '' };
    const combat = normalizeCombatState({
      active: true,
      entries: [entry],
      round: 3,
      currentIndex: 99,
      turns: { e1: { actionUsed: true, movementMax: 30 } },
    });
    expect(combat.currentIndex).toBe(0);
    expect(combat.turns.e1.actionUsed).toBe(true);
    expect(combat.turns.e1.movementMax).toBe(30);
  });

  it('пустой/мусорный вход', () => {
    expect(normalizeCombatState(undefined)).toEqual(emptyCombatState());
    expect(normalizeCombatState('x')).toEqual(emptyCombatState());
  });
});

describe('normalizeConditions', () => {
  it('добирает дефолты и уровень истощения', () => {
    const list = normalizeConditions([
      { key: 'prone', name: 'Сбит с ног', rounds: 2 },
      { key: 'exhaustion', level: 9 },
      { key: 'custom' },
      null,
    ]);
    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({ key: 'prone', name: 'Сбит с ног', rounds: 2 });
    expect(list[1].level).toBe(6);
    expect(list[2].name).toBe('custom');
    expect(list[2].rounds).toBeNull();
  });
});

describe('normalizeEffects', () => {
  it('отбрасывает битые эффекты и модификаторы', () => {
    const effects = normalizeEffects([
      {
        id: 'ef1',
        name: 'Bless',
        duration: { type: 'rounds', rounds: 10 },
        modifiers: [
          { target: 'attack', mode: 'add', value: '1d4' },
          { target: 'nope', mode: 'add', value: 1 },
          { target: 'ac', mode: 'nope', value: 1 },
        ],
      },
      { duration: { type: 'bad' } },
    ]);
    expect(effects).toHaveLength(1);
    expect(effects[0].modifiers).toHaveLength(1);
    expect(effects[0].modifiers[0].value).toBe('1d4');
  });
});

describe('normalizeActions', () => {
  it('читает costs и legacy cost, чинит пустые стоимости', () => {
    const list = normalizeActions([
      { name: 'Dash', costs: ['action', 'bonus'] },
      { name: 'Bite', cost: 'action' },
      { name: 'Weird', costs: ['nope'] },
      { name: '', costs: ['action'] },
      null,
    ]);
    expect(list.map((a) => a.name)).toEqual(['Dash', 'Bite', 'Weird']);
    expect(list[0].costs).toEqual(['action', 'bonus']);
    expect(list[1].costs).toEqual(['action']);
    expect(list[2].costs).toEqual(['action']);
  });
});

describe('normalizeStatblock', () => {
  it('дефолтные характеристики и фильтрация', () => {
    const statblock = normalizeStatblock({ abilities: { str: 15, dex: 99 }, saves: { str: 5 } });
    expect(statblock?.abilities.str).toBe(15);
    expect(statblock?.abilities.dex).toBe(30);
    expect(statblock?.abilities.int).toBe(10);
    expect(statblock?.saves?.str).toBe(5);
    expect(normalizeStatblock(undefined)).toBeUndefined();
  });
});
