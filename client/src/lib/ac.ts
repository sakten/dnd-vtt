import { DEFAULT_AC, modifiedValue, statNumber, type AbilityKey, type Token } from 'shared';
import { t } from '../i18n';

export interface AcBreakdown {
  /** Базовый AC (данные токена/листа, иначе дефолт 13). */
  base: number;
  /** AC с модификаторами эффектов (Щит, Магический доспех и т.п.). */
  effective: number;
  bonus: number;
  /** AC взят из дефолта: в записи пусто. */
  byDefault: boolean;
}

/** Базовый AC и его значение с эффектами — общий расчёт для панелей и меню токена. */
export function acBreakdownOf(
  ac: string | number | undefined,
  effects: Token['effects'] | undefined,
  abilities: Partial<Record<AbilityKey, number>> | undefined
): AcBreakdown {
  const explicit = statNumber(ac);
  const base = explicit > 0 ? explicit : DEFAULT_AC;
  const effective = modifiedValue(base, effects, 'ac', {}, abilities);
  return { base, effective, bonus: effective - base, byDefault: explicit <= 0 };
}

/** Тултип AC: база и вклад эффектов (как в меню токена). */
export function acTipOf(info: AcBreakdown): string {
  if (info.bonus !== 0) {
    return t('ui.tokenMenu.acBaseWithEffects', {
      base: info.base,
      default: info.byDefault ? t('ui.tokenMenu.defaultSuffix') : '',
      effective: info.effective,
    });
  }
  return t('ui.tokenMenu.ac', { default: info.byDefault ? t('ui.tokenMenu.acDefault13') : '' });
}
