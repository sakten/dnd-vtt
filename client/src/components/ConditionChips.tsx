import { conditionDescription, type ConditionInstance, type Spell } from 'shared';
import ConditionIcon from './ConditionIcon';
import SpellIcon from './SpellIcon';

interface Props {
  conditions: ConditionInstance[];
  spellByKey?: Map<string, Spell>;
  className?: string;
  /** Максимум чипов; null — показать все. */
  max?: number | null;
}

/** Чипы состояний/эффектов: по умолчанию 4 + «+N»; иконка заклинания, если есть источник. */
export default function ConditionChips({ conditions, spellByKey, className, max = 4 }: Props) {
  if (!conditions.length) return null;
  const shown = max === null ? conditions : conditions.slice(0, max);
  const extra = conditions.length - shown.length;
  return (
    <div className={`cond-chips${className ? ` ${className}` : ''}`}>
      {shown.map((c, i) => {
        const spell = c.sourceKey ? spellByKey?.get(c.sourceKey) : undefined;
        const num = c.key === 'exhaustion' ? c.level : c.rounds ?? undefined;
        const rounds = num ? ` · ${num}${c.key === 'exhaustion' ? ' ур.' : ' раунд.'}` : '';
        const tip = spell ? `${c.name}${rounds}` : `${c.name}${rounds} — ${conditionDescription(c.key)}`;
        return (
          <span key={`${c.key}-${i}`} className={`cond-chip cond-${c.key}`} title={tip}>
            {spell ? (
              <SpellIcon spell={spell} className="cond-chip-icon" />
            ) : (
              <ConditionIcon condition={c.key} className="cond-chip-icon" />
            )}
            {num ? <span className="cond-chip-num">{num > 9 ? '9+' : num}</span> : null}
          </span>
        );
      })}
      {extra > 0 && (
        <span
          className="cond-chip cond-more"
          title={conditions.slice(shown.length).map((c) => c.name).join(', ')}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
