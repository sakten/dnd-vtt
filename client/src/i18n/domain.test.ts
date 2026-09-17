import { describe, expect, it } from 'vitest';
import {
  BASE_ACTIONS,
  CLASSES,
  CONDITION_DESCRIPTIONS,
  CONDITION_NAMES,
  reactionFeatures,
  type ClassLevel,
  type EffectInstance,
  type Modifier,
} from 'shared';
import { setLocale } from './index';
import { ru } from './ru';
import {
  baseActionLabel,
  classLabel,
  conditionHint,
  conditionLabel,
  effectDurationText,
  effectSummaryText,
  reactionLabel,
  resourceLabel,
  subclassLabel,
} from './domain';

const ruKey = (key: string) => ru[key as keyof typeof ru];

function allReactionDefs() {
  const seen = new Map<string, { id: string; name: string }>();
  for (const [className, def] of Object.entries(CLASSES)) {
    const subclasses: (string | undefined)[] = [undefined, ...Object.keys(def.subclasses)];
    for (const subclass of subclasses) {
      const entry: ClassLevel = { className, level: 20, ...(subclass ? { subclass } : {}) };
      for (const feature of reactionFeatures([entry])) seen.set(feature.id, feature);
    }
  }
  return [...seen.values()];
}

describe('i18n domain', () => {
  it('состояния: RU совпадает с shared, хинты и fallback', () => {
    setLocale('ru');
    for (const [key, name] of Object.entries(CONDITION_NAMES)) {
      expect(ruKey(`domain.condition.${key}`)).toBe(name);
      expect(ruKey(`domain.conditionHint.${key}`)).toBe(
        CONDITION_DESCRIPTIONS[key as keyof typeof CONDITION_DESCRIPTIONS]
      );
      expect(conditionLabel(key, name)).toBe(name);
      expect(conditionHint(key)).toBe(CONDITION_DESCRIPTIONS[key as keyof typeof CONDITION_DESCRIPTIONS]);
    }
    expect(conditionLabel('custom', 'Моё состояние')).toBe('Моё состояние');
    expect(conditionLabel('custom', '  ')).toBe(CONDITION_NAMES.custom);
  });

  it('классы, подклассы и ресурсы: RU совпадает с shared', () => {
    setLocale('ru');
    for (const def of Object.values(CLASSES)) {
      expect(ruKey(`domain.class.${def.key}`)).toBe(def.name);
      expect(classLabel(def.key, def.name)).toBe(def.name);
      for (const r of def.resources) {
        const full = `${def.key}:${r.key}`;
        expect(ruKey(`domain.resource.${full}`)).toBe(r.name);
        expect(resourceLabel(full, r.name)).toBe(r.name);
      }
      for (const [subKey, sub] of Object.entries(def.subclasses)) {
        expect(ruKey(`domain.subclass.${def.key}.${subKey}`)).toBe(sub.name);
        expect(subclassLabel(def.key, subKey, sub.name)).toBe(sub.name);
        for (const r of sub.resources ?? []) {
          const full = `${def.key}.${subKey}:${r.key}`;
          expect(ruKey(`domain.resource.${full}`)).toBe(r.name);
          expect(resourceLabel(full, r.name)).toBe(r.name);
        }
      }
    }
  });

  it('базовые действия и реакции: RU совпадает с shared', () => {
    setLocale('ru');
    for (const action of BASE_ACTIONS) {
      expect(ruKey(`domain.baseAction.${action.id}`)).toBe(action.name);
      expect(baseActionLabel(action.id, action.name)).toBe(action.name);
    }
    for (const feature of allReactionDefs()) {
      expect(ruKey(`domain.reaction.${feature.id}`)).toBe(feature.name);
      expect(reactionLabel(feature.id, feature.name)).toBe(feature.name);
    }
  });

  it('эффекты: RU-сводка совпадает с прежними строками', () => {
    setLocale('ru');
    const effect = (modifiers: Modifier[]): EffectInstance => ({
      id: 'e1',
      name: 'Effect',
      duration: { type: 'concentration' },
      modifiers,
    });

    const bless = effect([
      { id: 'm1', target: 'attack', mode: 'add', value: '1d4' },
      { id: 'm2', target: 'save', mode: 'add', value: '1d4' },
    ]);
    expect(effectSummaryText(bless)).toBe('+1d4 к атакам, +1d4 к спасброскам');

    const hex = effect([{ id: 'm1', target: 'damage', mode: 'add', value: '1d6', filter: { targetId: 't2' } }]);
    expect(effectSummaryText(hex)).toBe('+1d6 к урону по метке');

    const stoneskin = effect([
      { id: 'm1', target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'slashing' } },
    ]);
    expect(effectSummaryText(stoneskin)).toBe('сопротивление: Режущий');

    const images = effect([]);
    images.misdirect = { charges: 3, die: 'd6', threshold: 3 };
    expect(effectSummaryText(images)).toBe('зеркальные образы (3)');

    expect(effectSummaryText(effect([]))).toBeUndefined();
  });

  it('эффекты: RU-длительности', () => {
    setLocale('ru');
    expect(effectDurationText({ type: 'rounds', rounds: 3 })).toBe('3 раунд.');
    expect(effectDurationText({ type: 'untilSave', ability: 'wis', dc: 13, timing: 'start' })).toBe(
      'до спасброска (начало хода)'
    );
    expect(effectDurationText({ type: 'untilSave', ability: 'wis', dc: 13, timing: 'end' })).toBe(
      'до спасброска (конец хода)'
    );
    expect(effectDurationText({ type: 'endOfTurn', of: 'target' })).toBe('до конца хода цели');
    expect(effectDurationText({ type: 'endOfTurn', of: 'source' })).toBe('до конца хода источника');
    expect(effectDurationText({ type: 'concentration' })).toBe('концентрация');
    expect(effectDurationText({ type: 'permanent' })).toBe('до снятия');
  });

  it('fallback для неизвестных ключей', () => {
    setLocale('ru');
    expect(conditionLabel('unknown', 'Особое')).toBe('Особое');
    expect(conditionLabel('unknown')).toBe('unknown');
    expect(conditionHint('unknown')).toBe('unknown');
    expect(classLabel('unknown', 'Класс')).toBe('Класс');
    expect(classLabel('unknown')).toBe('unknown');
    expect(subclassLabel('unknown', 'sub', 'Подкласс')).toBe('Подкласс');
    expect(subclassLabel('unknown', 'sub')).toBe('unknown.sub');
    expect(resourceLabel('unknown:key', 'Ресурс')).toBe('Ресурс');
    expect(resourceLabel(undefined, 'Ресурс')).toBe('Ресурс');
    expect(resourceLabel(null)).toBe('');
    expect(baseActionLabel('unknown', 'Действие')).toBe('Действие');
    expect(reactionLabel('unknown', 'Реакция')).toBe('Реакция');
    expect(reactionLabel('unknown')).toBe('unknown');
  });
});
