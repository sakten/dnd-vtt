import { describe, expect, it } from 'vitest';
import {
  attackRange,
  attackRollExpression,
  countAttackAdvantage,
  critRangeFor,
  hostileTokens,
  resolveAbilityMods,
  sideMatches,
  tokensNearFeet,
} from './combat';
import { rollMode } from './effects';
import type { ConditionInstance } from '../domain/effects';
import type { Faction } from '../domain/core';

const cond = (key: ConditionInstance['key'], name = key): ConditionInstance => ({ key, name });

describe('countAttackAdvantage', () => {
  it('явный выбор и одиночные состояния дают режим', () => {
    expect(countAttackAdvantage({ explicit: 'a' }).mode).toBe('a');
    expect(countAttackAdvantage({ explicit: 'd' }).mode).toBe('d');
    expect(countAttackAdvantage({ attackerConditions: [cond('invisible')] }).mode).toBe('a');
    expect(countAttackAdvantage({ attackerConditions: [cond('poisoned')] }).mode).toBe('d');
  });

  it('5e: любое преимущество и любая помеха отменяют друг друга (счёт не сальдируется)', () => {
    // 2 преимущества (Невидим + явное Adv) против 1 помехи (Отравлен) → обычный бросок.
    const both = countAttackAdvantage({
      explicit: 'a',
      attackerConditions: [cond('invisible'), cond('poisoned')],
    });
    expect(both.advantage).toBe(2);
    expect(both.disadvantage).toBe(1);
    expect(both.mode).toBeUndefined();
  });

  it('принудительная помеха гасит любое преимущество', () => {
    const both = countAttackAdvantage({ explicit: 'a', forcedDisadvantage: true });
    expect(both.mode).toBeUndefined();
  });

  it('состояния цели: Сбит с ног даёт преимущество в ближнем бою и помеху в дальнем', () => {
    expect(countAttackAdvantage({ targetConditions: [cond('prone')], rangeType: 'melee' }).mode).toBe('a');
    expect(countAttackAdvantage({ targetConditions: [cond('prone')], rangeType: 'ranged' }).mode).toBe('d');
  });

  it('includeTarget=false игнорирует состояния цели', () => {
    expect(countAttackAdvantage({ targetConditions: [cond('prone')], rangeType: 'melee', includeTarget: false }).mode).toBeUndefined();
  });

  it('помеха от эффекта (Уклонение) отменяется любым преимуществом', () => {
    expect(countAttackAdvantage({ effectMode: 'd' }).mode).toBe('d');
    expect(countAttackAdvantage({ effectMode: 'd', explicit: 'a' }).mode).toBeUndefined();
  });

  it('несколько эффектов преимущества и один эффект помехи — отмена', () => {
    const both = countAttackAdvantage({ effectMode: 'a', forcedDisadvantage: true });
    expect(both.mode).toBeUndefined();
  });
});

describe('rollMode', () => {
  it('отменяет режим при любых количествах с обеих сторон', () => {
    expect(rollMode(3, 1)).toBeUndefined();
    expect(rollMode(1, 3)).toBeUndefined();
    expect(rollMode(2, 0)).toBe('a');
    expect(rollMode(0, 2)).toBe('d');
    expect(rollMode(0, 0)).toBeUndefined();
  });
});

describe('attackRange и досягаемость', () => {
  it('бонус досягаемости расширяет melee-дистанцию', () => {
    const sword = { rangeType: 'melee' as const, rangeNormal: 5, rangeLong: 0 };
    expect(attackRange(sword, 10, false).outOfRange).toBe(true);
    expect(attackRange(sword, 10, false, 10).outOfRange).toBe(false);
    expect(attackRange(sword, 15, false, 10).outOfRange).toBe(false);
    expect(attackRange(sword, 20, false, 10).outOfRange).toBe(true);
  });
});

describe('resolveAbilityMods', () => {
  const abilities = { str: 16, dex: 14 };
  it('подставляет модификаторы в формулы', () => {
    expect(resolveAbilityMods('d20+str', abilities)).toBe('d20+3');
    expect(resolveAbilityMods('d20 + str', abilities)).toBe('d20+3');
    expect(resolveAbilityMods('d20-str', abilities)).toBe('d20-3');
    expect(resolveAbilityMods('1d8+dex', abilities)).toBe('1d8+2');
    expect(resolveAbilityMods('d20+5', abilities)).toBe('d20+5');
    expect(resolveAbilityMods('str', abilities)).toBe('+3');
  });

  it('бонус владения: pb/prof', () => {
    expect(resolveAbilityMods('d20+pb', abilities, 3)).toBe('d20+3');
    expect(resolveAbilityMods('1d8+pb', abilities, 4)).toBe('1d8+4');
    expect(resolveAbilityMods('d20+prof', abilities, 2)).toBe('d20+2');
    expect(resolveAbilityMods('d20+pb')).toBe('d20+2');
    expect(resolveAbilityMods('d20-pb', abilities, 3)).toBe('d20-3');
    expect(resolveAbilityMods('1d6+dex+pb', abilities, 3)).toBe('1d6+2+3');
  });

  it('неизвестные характеристики — модификатор 10', () => {
    expect(resolveAbilityMods('d20+cha', abilities)).toBe('d20+0');
    expect(resolveAbilityMods('d20+constitution', abilities)).toBe('d20+constitution');
  });
});

describe('attackRollExpression', () => {
  it('голый бонус бестиария превращается в d20+бонус', () => {
    expect(attackRollExpression('+5')).toBe('d20+5');
    expect(attackRollExpression('5')).toBe('d20+5');
    expect(attackRollExpression('-1')).toBe('d20-1');
    expect(attackRollExpression('d20+str')).toBe('d20+str');
    expect(attackRollExpression('1d20+5')).toBe('1d20+5');
    expect(attackRollExpression('')).toBe('');
  });
});

describe('critRangeFor (Чемпион)', () => {
  it('19–20 с 3 уровня, 18–20 с 15, у прочих — только 20', () => {
    expect(critRangeFor([{ className: 'fighter', level: 3 }])).toBe(20);
    expect(critRangeFor([{ className: 'fighter', subclass: 'champion', level: 3 }])).toBe(19);
    expect(critRangeFor([{ className: 'fighter', subclass: 'champion', level: 15 }])).toBe(18);
    expect(critRangeFor([{ className: 'champion', level: 20 }])).toBe(20);
  });
});

describe('hostileTokens и стороны (фракция, не isPlayerToken)', () => {
  const side = (faction: Faction) => ({ faction });

  it('одна ненейтральная фракция — не враги, даже если isPlayerToken различается', () => {
    expect(hostileTokens(side('ally'), side('ally'))).toBe(false);
    expect(hostileTokens(side('enemy'), side('enemy'))).toBe(false);
  });

  it('разные ненейтральные фракции — враги, даже у однотипных токенов', () => {
    expect(hostileTokens(side('ally'), side('enemy'))).toBe(true);
    expect(hostileTokens(side('enemy'), side('ally'))).toBe(true);
  });

  it('neutral — фон: не враг никому', () => {
    expect(hostileTokens(side('neutral'), side('ally'))).toBe(false);
    expect(hostileTokens(side('neutral'), side('enemy'))).toBe(false);
    expect(hostileTokens(side('neutral'), side('neutral'))).toBe(false);
  });

  it('sideMatches: союзники — та же ненейтральная фракция', () => {
    expect(sideMatches(side('ally'), side('ally'), 'ally')).toBe(true);
    expect(sideMatches(side('ally'), side('neutral'), 'ally')).toBe(false);
    expect(sideMatches(side('neutral'), side('neutral'), 'ally')).toBe(false);
    expect(sideMatches(side('ally'), side('enemy'), 'hostile')).toBe(true);
  });
});

describe('tokensNearFeet (дистанция по подошвам)', () => {
  const box = (x: number, w = 50, y = 100, h = 50) => ({ x, y, w, h });

  it('большой токен вплотную — 5 фт, через пустую клетку — 10 фт', () => {
    const center = box(100, 100, 100, 100); // [50..150]
    const adjacent = box(200, 100, 100, 100); // [150..250] — касается
    const near = box(150); // [125..175] — вплотную к большому
    const oneCellAway = box(225, 50, 100, 50); // [200..250] — пустая клетка от большого
    expect(tokensNearFeet([center, adjacent, near], center, 5, 50)).toEqual([center, adjacent, near]);
    expect(tokensNearFeet([oneCellAway], center, 5, 50)).toEqual([]);
    expect(tokensNearFeet([oneCellAway], center, 10, 50)).toEqual([oneCellAway]);
  });

  it('сортирует от ближних к дальним', () => {
    const center = box(100);
    const far = box(400);
    const near = box(200);
    expect(tokensNearFeet([far, center, near], center, 30, 50)).toEqual([center, near, far]);
  });
});
