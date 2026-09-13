import { effectDurationText, type EffectInstance, type Spell } from 'shared';
import SpellIcon from './SpellIcon';

interface Props {
  effects: EffectInstance[];
  spellByKey?: Map<string, Spell>;
  className?: string;
  /** Максимум чипов; null — показать все. */
  max?: number | null;
}

/** Чипы активных эффектов (Ф8): иконка заклинания-источника, имя, остаток раундов. */
export default function EffectChips({ effects, spellByKey, className, max = 3 }: Props) {
  if (!effects.length) return null;
  const shown = max === null ? effects : effects.slice(0, max);
  const extra = effects.length - shown.length;
  return (
    <div className={`eff-chips${className ? ` ${className}` : ''}`}>
      {shown.map((e) => {
        const spell = e.sourceKey ? spellByKey?.get(e.sourceKey) : undefined;
        const rounds = e.duration.type === 'rounds' ? e.duration.rounds : undefined;
        const tip = `${e.name} — ${effectDurationText(e.duration)}${e.concentration ? ' · концентрация' : ''}`;
        return (
          <span key={e.id} className={`eff-chip${e.concentration ? ' eff-concentration' : ''}`} title={tip}>
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
