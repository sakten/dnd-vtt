import { type EffectInstance, type Spell } from 'shared';
import { t } from '../i18n';
import { effectDurationText, effectSummaryText } from '../i18n/domain';
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
    return {
      key: e.id,
      title: e.name,
      node: (
        <span className={`eff-chip${ownConcentration ? ' eff-concentration' : ''}`} title={`${e.name} — ${parts.join(' · ')}`}>
          {spell ? <SpellIcon spell={spell} className="eff-chip-icon" /> : <span className="eff-chip-dot" />}
          <span className="eff-chip-name">{e.name}</span>
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
