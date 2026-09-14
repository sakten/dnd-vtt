import { conditionDescription, type ConditionInstance, type Spell } from 'shared';
import ChipRow from './ChipRow';
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
  const items = conditions.map((c, i) => {
    const spell = c.sourceKey ? spellByKey?.get(c.sourceKey) : undefined;
    const num = c.key === 'exhaustion' ? c.level : c.rounds ?? undefined;
    const rounds = num ? ` · ${num}${c.key === 'exhaustion' ? ' ур.' : ' раунд.'}` : '';
    const tip = spell ? `${c.name}${rounds}` : `${c.name}${rounds} — ${conditionDescription(c.key)}`;
    return {
      key: `${c.key}-${i}`,
      title: c.name,
      node: (
        <span className={`cond-chip cond-${c.key}`} title={tip}>
          {spell ? (
            <SpellIcon spell={spell} className="cond-chip-icon" />
          ) : (
            <ConditionIcon condition={c.key} className="cond-chip-icon" />
          )}
          {num ? <span className="cond-chip-num">{num > 9 ? '9+' : num}</span> : null}
        </span>
      ),
    };
  });

  return (
    <ChipRow
      items={items}
      className={`cond-chips${className ? ` ${className}` : ''}`}
      moreClass="cond-chip cond-more"
      max={max}
    />
  );
}
