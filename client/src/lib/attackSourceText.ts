import type { AttackSource } from 'shared';
import { t } from '../i18n';
import { conditionLabel } from '../i18n/domain';

/** Текст источника adv/dis для колонок «+»/«−» и метки броска. */
export function attackSourceLabel(source: AttackSource): string {
  switch (source.kind) {
    case 'condition':
      return conditionLabel(source.key ?? 'custom');
    case 'effect':
      return source.name ?? t('ui.attackSources.effect');
    case 'range':
      return t(source.key === 'long' ? 'roll.long' : 'roll.adjacent');
    case 'unseen':
      return t(source.key === 'attacker' ? 'ui.attackSources.unseenAttacker' : 'ui.attackSources.unseenTarget');
    case 'weapon':
      return t('ui.attackSources.heavy');
    default:
      return t('ui.attackSources.explicit');
  }
}
