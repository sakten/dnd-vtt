import { CONDITION_KEYS, spellVariantDef, type AbilityKey, type EffectInstance, type Spell } from 'shared';
import { t, type MessageKey } from '../i18n';
import { abilityName, conditionLabel, damageLabel, effectDurationText, effectSummaryText, skillName } from '../i18n/domain';
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
    const charge = e.charges?.remaining;
    const parts: string[] = [];
    if (summary) parts.push(summary);
    if (charge != null) parts.push(t('ui.effects.charges', { n: charge }));
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
        : variantParam === 'skill'
          ? skillName(e.variant)
          : variantParam === 'command'
            ? t(`ui.command.${e.variant}` as MessageKey)
            : variantParam === 'effect' && (CONDITION_KEYS as string[]).includes(e.variant)
              ? conditionLabel(e.variant)
              : variantParam === 'effect'
                ? t(`ui.spellVariant.${e.variant}` as MessageKey)
                : damageLabel(e.variant)
      : '';
    const label = variantLabel ? `${e.name} (${variantLabel})` : e.name;
    const badge = charge != null ? (charge > 9 ? '9+' : String(charge)) : rounds != null ? (rounds > 9 ? '9+' : String(rounds)) : null;
    return {
      key: e.id,
      title: label,
      node: (
        <span
          className={`eff-chip${ownConcentration ? ' eff-concentration' : ''}${charge != null && charge <= 0 ? ' eff-spent' : ''}`}
          title={`${label} — ${parts.join(' · ')}`}
        >
          {spell ? <SpellIcon spell={spell} className="eff-chip-icon" /> : <span className="eff-chip-dot" />}
          <span className="eff-chip-name">{label}</span>
          {badge != null ? <span className="eff-chip-num">{badge}</span> : null}
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
