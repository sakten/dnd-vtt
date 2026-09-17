import type { RollKind, RollLabelParams } from 'shared';
import { t, type MessageKey } from './index';
import { damageLabel } from './domain';

const DEATH_OUTCOME_KEY: Record<NonNullable<RollLabelParams['outcome']>, MessageKey> = {
  critSuccess: 'roll.death.critSuccess',
  critFail: 'roll.death.critFail',
  success: 'roll.death.success',
  fail: 'roll.death.fail',
};

/** Готовый текст метки броска из структурных полей (i18n). */
export function rollLabelText(kind: RollKind, params: RollLabelParams = {}): string {
  switch (kind) {
    case 'attack':
    case 'damage':
    case 'heal': {
      const head = t(kind === 'attack' ? 'roll.attack' : kind === 'heal' ? 'roll.heal' : 'roll.damage');
      let out = t('roll.labelSubject', { head, subject: params.subject ?? head });
      if (typeof params.distanceFeet === 'number') out = t('roll.distance', { label: out, feet: Math.round(params.distanceFeet) });
      if (params.disadvantage) {
        const reason = t(params.disadvantage === 'adjacent' ? 'roll.adjacent' : 'roll.long');
        out = t('roll.disadvantage', { label: out, reason });
      }
      if (kind === 'attack' && params.penalty) {
        out = t('roll.penalty', { label: out, sign: params.penalty > 0 ? '+' : '', penalty: params.penalty });
      }
      if (kind === 'attack' && params.hit) out = t(params.hit === 'hit' ? 'roll.hit' : 'roll.miss', { label: out });
      if (kind === 'damage' && params.damageType) {
        out = t('roll.damageType', { label: out, type: damageLabel(params.damageType) });
      }
      if (kind === 'damage' && params.damageNote) {
        out = t('roll.damageNote', { label: out, note: t(`roll.defense.${params.damageNote}` as MessageKey) });
      }
      return out;
    }
    case 'save': {
      let out = t('roll.save', { subject: params.subject ?? '' });
      if (params.saveOutcome) out = t(params.saveOutcome === 'success' ? 'roll.success' : 'roll.fail', { label: out });
      return out;
    }
    case 'check': {
      let out = t('roll.check', { subject: params.subject ?? '' });
      if (typeof params.dc === 'number') out = t('roll.dc', { label: out, dc: params.dc });
      if (params.checkOutcome) out = t(params.checkOutcome === 'success' ? 'roll.success' : 'roll.fail', { label: out });
      return out;
    }
    case 'death':
      return t('roll.death', {
        outcome: t(DEATH_OUTCOME_KEY[params.outcome ?? 'fail']),
        successes: params.successes ?? 0,
        failures: params.failures ?? 0,
      });
    case 'plain':
    default:
      return params.subject ?? '';
  }
}

/** Текст метки сообщения: из структуры, если она есть, иначе — сохранённый `label`. */
export function rollMessageLabel(message: {
  rollKind?: RollKind;
  labelParams?: RollLabelParams;
  label?: string;
}): string | undefined {
  if (!message.rollKind) return message.label;
  return rollLabelText(message.rollKind, message.labelParams) || message.label;
}
