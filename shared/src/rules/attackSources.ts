import type { AbilityKey } from '../domain/core';
import type { AttackSource } from '../domain/chat';
import type { ConditionInstance, EffectInstance } from '../domain/effects';
import type { AttackRangeType } from '../domain/token';
import {
  advantageAgainstReasons,
  attackerAdvantageReasons,
  attackerDisadvantageReasons,
  disadvantageAgainstReasons,
} from './conditions';
import { collectModifiers, rollMode, type ModifierContext } from './effects';

/**
 * Единый сборщик источников преимуществ/помех броска атаки (R8.x): сервер
 * считает им реальный бросок, клиент — предпросмотр прицела. Один код — один
 * результат: колонки «+»/«−» не могут разойтись с броском.
 */
export interface AttackSourceInput {
  /** Явный выбор Adv/Dis игрока. */
  explicit?: 'a' | 'd';
  attackerConditions?: ConditionInstance[];
  targetConditions?: ConditionInstance[];
  rangeType?: AttackRangeType;
  /** Принудительная помеха (дистанция/позиция) и её код причины. */
  forcedDisadvantage?: boolean;
  forcedDisadvantageCode?: 'adjacent' | 'long';
  /** «Тяжёлое» оружие при профильной характеристике ниже 13. */
  heavy?: boolean;
  unseenTarget?: boolean;
  unseenAttacker?: boolean;
  /** Эффекты с контекстом: источники с именами; иначе — обезличенный `effectMode`. */
  attackerEffects?: EffectInstance[];
  targetEffects?: EffectInstance[];
  effectContext?: ModifierContext;
  abilities?: Partial<Record<AbilityKey, number>>;
  effectMode?: 'a' | 'd';
  /** Учитывать состояния цели (по умолчанию — да). */
  includeTarget?: boolean;
}

/** Источники преимуществ/помех в порядке значимости (RAW: стороны взаимно гасятся по наличию). */
export function collectAttackSources(input: AttackSourceInput): AttackSource[] {
  const out: AttackSource[] = [];
  const rangeType = input.rangeType ?? 'melee';
  const condition = (side: AttackSource['side'], key: string): AttackSource => ({ side, kind: 'condition', key });

  if (input.explicit === 'a') out.push({ side: 'advantage', kind: 'explicit' });
  if (input.explicit === 'd') out.push({ side: 'disadvantage', kind: 'explicit' });
  for (const key of attackerAdvantageReasons(input.attackerConditions)) out.push(condition('advantage', key));
  for (const key of attackerDisadvantageReasons(input.attackerConditions)) out.push(condition('disadvantage', key));
  if (input.includeTarget !== false) {
    for (const key of advantageAgainstReasons(input.targetConditions, rangeType)) out.push(condition('advantage', key));
    for (const key of disadvantageAgainstReasons(input.targetConditions, rangeType)) {
      out.push(condition('disadvantage', key));
    }
  }
  if (input.forcedDisadvantage) {
    out.push({ side: 'disadvantage', kind: 'range', key: input.forcedDisadvantageCode ?? 'adjacent' });
  }
  if (input.heavy) out.push({ side: 'disadvantage', kind: 'weapon', key: 'heavy' });
  if (input.unseenTarget) out.push({ side: 'disadvantage', kind: 'unseen', key: 'target' });
  if (input.unseenAttacker) out.push({ side: 'advantage', kind: 'unseen', key: 'attacker' });

  if (input.attackerEffects || input.targetEffects) {
    const ctx: ModifierContext = input.effectContext ?? {};
    const groups: [EffectInstance[] | undefined, 'self' | 'against'][] = [
      [input.attackerEffects, 'self'],
      [input.targetEffects, 'against'],
    ];
    for (const [effects, direction] of groups) {
      for (const effect of effects ?? []) {
        for (const mod of collectModifiers([effect], 'attack', { ...ctx, direction })) {
          if (mod.mode !== 'advantage' && mod.mode !== 'disadvantage') continue;
          out.push({
            side: mod.mode === 'advantage' ? 'advantage' : 'disadvantage',
            kind: 'effect',
            name: effect.name,
            ...(effect.sourceKey ? { sourceKey: effect.sourceKey } : {}),
          });
        }
      }
    }
  } else if (input.effectMode === 'a' || input.effectMode === 'd') {
    out.push({ side: input.effectMode === 'a' ? 'advantage' : 'disadvantage', kind: 'effect' });
  }
  return out;
}

/** Число источников по сторонам (для счётчиков и взаимогашения). */
export function sourcesCounts(sources: AttackSource[]): { advantage: number; disadvantage: number } {
  let advantage = 0;
  let disadvantage = 0;
  for (const source of sources) {
    if (source.side === 'advantage') advantage += 1;
    else disadvantage += 1;
  }
  return { advantage, disadvantage };
}

/** Итоговый режим d20 по источникам (взаимогашение: есть и «+», и «−» — обычный бросок). */
export function sourcesMode(sources: AttackSource[]): 'a' | 'd' | undefined {
  const { advantage, disadvantage } = sourcesCounts(sources);
  return rollMode(advantage, disadvantage);
}
