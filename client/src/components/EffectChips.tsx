import { effectDurationText, effectSummary, type EffectInstance, type Spell } from 'shared';
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
  if (!effects.length) return null;
  const shown = max === null ? effects : effects.slice(0, max);
  const extra = effects.length - shown.length;
  return (
    <div className={`eff-chips${className ? ` ${className}` : ''}`}>
      {shown.map((e) => {
        const spell = e.sourceKey ? spellByKey?.get(e.sourceKey) : undefined;
        const ownConcentration = e.concentration === true && e.sourceId === tokenId;
        const summary = effectSummary(e);
        const parts: string[] = [];
        if (summary) parts.push(summary);
        if (ownConcentration) parts.push('концентрация');
        if (!parts.length) {
          parts.push(e.duration.type === 'concentration' ? 'метка' : effectDurationText(e.duration));
        } else if (e.duration.type === 'rounds' || e.duration.type === 'untilSave') {
          parts.push(effectDurationText(e.duration));
        }
        const tip = `${e.name} — ${parts.join(' · ')}`;
        const rounds = e.duration.type === 'rounds' ? e.duration.rounds : undefined;
        return (
          <span key={e.id} className={`eff-chip${ownConcentration ? ' eff-concentration' : ''}`} title={tip}>
            {spell ? <SpellIcon spell={spell} className="eff-chip-icon" /> : <span className="eff-chip-dot" />}
            <span className="eff-chip-name">{e.name}</span>
            {rounds != null ? <span className="eff-chip-num">{rounds > 9 ? '9+' : rounds}</span> : null}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="eff-chip eff-more" title={effects.slice(shown.length).map((e) => e.name).join(', ')}>
          +{extra}
        </span>
      )}
    </div>
  );
}
