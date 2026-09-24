import { describe, expect, it } from 'vitest';
import type { ConditionInstance, EffectInstance } from '../domain/effects';
import { collectAttackSources, sourcesCounts, sourcesMode } from './attackSources';
import { countAttackAdvantage } from './combat';

const cond = (key: ConditionInstance['key']): ConditionInstance => ({ key, name: key });

const effect = (name: string, mode: 'advantage' | 'disadvantage'): EffectInstance => ({
  id: name,
  name,
  duration: { type: 'permanent' },
  modifiers: [{ id: `${name}-m`, target: 'attack', mode, value: 0 }],
});

describe('collectAttackSources', () => {
  it('состояния: prone даёт преимущество в ближнем и помеху в дальнем', () => {
    expect(collectAttackSources({ targetConditions: [cond('prone')], rangeType: 'melee' })).toEqual([
      { side: 'advantage', kind: 'condition', key: 'prone' },
    ]);
    expect(collectAttackSources({ targetConditions: [cond('prone')], rangeType: 'ranged' })).toEqual([
      { side: 'disadvantage', kind: 'condition', key: 'prone' },
    ]);
  });

  it('дистанция/невидимость/тяжёлое — со своими кодами', () => {
    const sources = collectAttackSources({
      forcedDisadvantage: true,
      forcedDisadvantageCode: 'long',
      heavy: true,
      unseenTarget: true,
      unseenAttacker: true,
    });
    expect(sources).toEqual([
      { side: 'disadvantage', kind: 'range', key: 'long' },
      { side: 'disadvantage', kind: 'weapon', key: 'heavy' },
      { side: 'disadvantage', kind: 'unseen', key: 'target' },
      { side: 'advantage', kind: 'unseen', key: 'attacker' },
    ]);
  });

  it('эффекты атакующего и цели именуются, стороны считаются и гасятся', () => {
    const sources = collectAttackSources({
      attackerEffects: [effect('Ярость', 'advantage')],
      targetEffects: [effect('Уклонение', 'disadvantage')],
      effectContext: { rangeType: 'melee' },
    });
    expect(sources).toEqual([
      { side: 'advantage', kind: 'effect', name: 'Ярость' },
      { side: 'disadvantage', kind: 'effect', name: 'Уклонение' },
    ]);
    expect(sourcesCounts(sources)).toEqual({ advantage: 1, disadvantage: 1 });
    expect(sourcesMode(sources)).toBeUndefined();
  });

  it('countAttackAdvantage совпадает со сборщиком (обратная совместимость)', () => {
    const result = countAttackAdvantage({
      attackerConditions: [cond('poisoned')],
      targetConditions: [cond('prone')],
      rangeType: 'ranged',
    });
    expect(result).toEqual({ advantage: 0, disadvantage: 2, mode: 'd' });
  });

  it('See Invisibility снимает adv невидимого атакующего и dis по невидимой цели', () => {
    const invisible = [cond('invisible')];
    expect(collectAttackSources({ attackerConditions: invisible })).toEqual([
      { side: 'advantage', kind: 'condition', key: 'invisible' },
    ]);
    expect(collectAttackSources({ attackerConditions: invisible, targetSeesInvisible: true })).toEqual([]);
    expect(collectAttackSources({ targetConditions: invisible })).toEqual([
      { side: 'disadvantage', kind: 'condition', key: 'invisible' },
    ]);
    expect(collectAttackSources({ targetConditions: invisible, attackerSeesInvisible: true })).toEqual([]);
  });

  it('Shadow Blade: цель в сумерках/темноте — преимущество (dusk)', () => {
    expect(collectAttackSources({ dusk: true })).toEqual([{ side: 'advantage', kind: 'rule', key: 'shadowBlade' }]);
    expect(collectAttackSources({ dusk: false })).toEqual([]);
  });
});
