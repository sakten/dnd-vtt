import { describe, expect, it } from 'vitest';
import type { ConditionInstance, ConditionKey } from '../types';
import {
  advantageAgainst,
  attackerAdvantage,
  attackerDisadvantage,
  autoCrit,
  autoFailSave,
  conditionKeyOf,
  conditionName,
  disadvantageAgainst,
  exhaustionLevel,
  exhaustionRollPenalty,
  exhaustionSpeedPenalty,
  isIncapacitated,
  movementBlocked,
} from './conditions';

const c = (key: ConditionKey, level?: number): ConditionInstance => ({ key, name: key, rounds: null, level });

describe('каталог состояний', () => {
  it('ключ по названию/слагу и обратное имя', () => {
    expect(conditionKeyOf('Frightened')).toBe('frightened');
    expect(conditionKeyOf('Сбит с ног')).toBe('prone');
    expect(conditionKeyOf('blinded')).toBe('blinded');
    expect(conditionKeyOf('неведомое')).toBe('custom');
    expect(conditionName('prone')).toBe('Сбит с ног');
  });
});

describe('авто-эффекты', () => {
  it('преимущество/помеха атакующему', () => {
    expect(attackerAdvantage([c('invisible')])).toBe(true);
    expect(attackerAdvantage([c('poisoned')])).toBe(false);
    expect(attackerDisadvantage([c('poisoned')])).toBe(true);
    expect(attackerDisadvantage([c('prone')])).toBe(true);
    expect(attackerDisadvantage([c('charmed')])).toBe(false);
  });

  it('преимущество/помеха по цели', () => {
    expect(advantageAgainst([c('paralyzed')], 'ranged')).toBe(true);
    expect(advantageAgainst([c('prone')], 'melee')).toBe(true);
    expect(advantageAgainst([c('prone')], 'ranged')).toBe(false);
    expect(disadvantageAgainst([c('invisible')], 'melee')).toBe(true);
    expect(disadvantageAgainst([c('prone')], 'ranged')).toBe(true);
    expect(disadvantageAgainst([c('prone')], 'melee')).toBe(false);
  });

  it('авто-крит в пределах 5 фт (ближний бой)', () => {
    expect(autoCrit([c('paralyzed')], 5, 'melee')).toBe(true);
    expect(autoCrit([c('unconscious')], 5, 'melee')).toBe(true);
    expect(autoCrit([c('paralyzed')], 10, 'melee')).toBe(false);
    expect(autoCrit([c('paralyzed')], 5, 'ranged')).toBe(false);
  });

  it('авто-провал спасбросков Str/Dex', () => {
    expect(autoFailSave([c('paralyzed')], 'str')).toBe(true);
    expect(autoFailSave([c('stunned')], 'dex')).toBe(true);
    expect(autoFailSave([c('paralyzed')], 'con')).toBe(false);
    expect(autoFailSave([c('blinded')], 'dex')).toBe(false);
  });

  it('запрет движения и действий', () => {
    expect(movementBlocked([c('grappled')])).toBe(true);
    expect(movementBlocked([c('blinded')])).toBe(false);
    expect(isIncapacitated([c('stunned')])).toBe(true);
    expect(isIncapacitated([c('blinded')])).toBe(false);
  });

  it('истощение: уровень, штрафы к роллам и скорости', () => {
    expect(exhaustionLevel([c('exhaustion', 3)])).toBe(3);
    expect(exhaustionLevel([c('poisoned')])).toBe(0);
    expect(exhaustionRollPenalty([c('exhaustion', 3)])).toBe(-6);
    expect(exhaustionSpeedPenalty([c('exhaustion', 2)])).toBe(-10);
  });
});
