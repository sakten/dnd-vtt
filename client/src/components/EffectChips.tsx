import { spellVariantDef, type AbilityKey, type EffectInstance, type Spell } from 'shared';
import { t } from '../i18n';
import { abilityName, damageLabel, effectDurationText, effectSummaryText } from '../i18n/domain';
import ChipRow from './ChipRow';
import SpellIcon from './SpellIcon';

interface Props {
  effects: EffectInstance[];
  spellByKey?: Map<string, Spell>;
  className?: string;
  /** Максимум чипов; null — показать все. */
  max?: number | null;
  /** id токена-владельца: концентрация помечается только у своего кастера. */
  tokenId?: string;
}

/** Чипы активных эффектов (Ф8): иконка источника, суть эффекта в тултипе. */
export default function EffectChips({ effects, spellByKey, className, max = 3, tokenId }: Props) {
  const items = effects
    .filter((e) => !e.hidden)
    .map((e) => {
    const spell = e.sourceKey ? spellByKey?.get(e.sourceKey) : undefined;
    const ownConcentration = e.concentration === true && e.sourceId === tokenId;
    const summary = effectSummaryText(e);
    const parts: string[] = [];
    if (summary) parts.push(summary);
    if (ownConcentration) parts.push(t('ui.effects.concentration'));
    if (!parts.length) {
      parts.push(e.duration.type === 'concentration' ? t('ui.effects.mark') : effectDurationText(e.duration));
    } else if (e.duration.type === 'rounds' || e.duration.type === 'untilSave') {
      parts.push(effectDurationText(e.duration));
    }
    const rounds = e.duration.type === 'rounds' ? e.duration.rounds : undefined;
    // Выбранный вариант (Dragon's Breath: тип урона; Enhance Ability: характеристика) — в скобках к имени.
    const variantParam = e.sourceKey ? spellVariantDef(e.sourceKey)?.param : undefined;
    const variantLabel = e.variant
      ? variantParam === 'ability'
        ? abilityName(e.variant as AbilityKey)
        : damageLabel(e.variant)
      : '';
    const label = variantLabel ? `${e.name} (${variantLabel})` : e.name;
    return {
      key: e.id,
      title: label,
      node: (
        <span className={`eff-chip${ownConcentration ? ' eff-concentration' : ''}`} title={`${label} — ${parts.join(' · ')}`}>
          {spell ? <SpellIcon spell={spell} className="eff-chip-icon" /> : <span className="eff-chip-dot" />}
          <span className="eff-chip-name">{label}</span>
          {rounds != null ? <span className="eff-chip-num">{rounds > 9 ? '9+' : rounds}</span> : null}
        </span>
      ),
    };
  });

  return (
    <ChipRow
      items={items}
      className={`eff-chips${className ? ` ${className}` : ''}`}
      moreClass="eff-chip eff-more"
      max={max}
    />
  );
}
