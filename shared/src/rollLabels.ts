import type { RollKind, RollLabelParams } from './types';

const DISADVANTAGE_TEXT: Record<NonNullable<RollLabelParams['disadvantage']>, string> = {
  adjacent: 'враг рядом',
  long: 'дальняя дистанция',
};

const DEATH_OUTCOME_TEXT: Record<NonNullable<RollLabelParams['outcome']>, string> = {
  critSuccess: 'критический успех',
  critFail: 'критический провал',
  success: 'успех',
  fail: 'провал',
};

/** Готовый текст метки броска из структурных полей (RU). */
export function rollLabelText(kind: RollKind, params: RollLabelParams = {}): string {
  switch (kind) {
    case 'attack':
    case 'damage': {
      const head = kind === 'attack' ? 'Атака' : 'Урон';
      let out = `${head}: ${params.subject ?? head}`;
      if (typeof params.distanceFeet === 'number') out += ` · ${Math.round(params.distanceFeet)} фт`;
      if (params.disadvantage) out += ` (помеха: ${DISADVANTAGE_TEXT[params.disadvantage]})`;
      if (kind === 'attack' && params.hit) out += params.hit === 'hit' ? ' — Попал' : ' — Промах';
      return out;
    }
    case 'save':
      return `Спасбросок: ${params.subject ?? ''}`;
    case 'check':
      return `Проверка: ${params.subject ?? ''}`;
    case 'death':
      return `Спасбросок от смерти: ${DEATH_OUTCOME_TEXT[params.outcome ?? 'fail']} (успехи ${
        params.successes ?? 0
      }/3, провалы ${params.failures ?? 0}/3)`;
    case 'plain':
    default:
      return params.subject ?? '';
  }
}

/**
 * Текст метки сообщения: из структуры, если она есть, иначе — сохранённый `label`
 * (совместимость со старыми сообщениями).
 */
export function rollMessageLabel(message: {
  rollKind?: RollKind;
  labelParams?: RollLabelParams;
  label?: string;
}): string | undefined {
  if (!message.rollKind || message.rollKind === 'plain') return message.label;
  return rollLabelText(message.rollKind, message.labelParams);
}
