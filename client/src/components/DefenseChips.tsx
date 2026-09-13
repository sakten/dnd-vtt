import { DEFENSE_TYPE_NAMES, damageTypeName, type DamageDefense } from 'shared';

const DEFENSE_DESCRIPTION: Record<DamageDefense['type'], string> = {
  immunity: 'урон этого типа не наносится',
  resistance: 'половина урона этого типа',
  vulnerability: 'двойной урон этого типа',
};

const ABBR: Record<string, string> = {
  slashing: 'Ре',
  piercing: 'Ко',
  bludgeoning: 'Др',
  acid: 'Кс',
  cold: 'Хл',
  fire: 'Ог',
  force: 'Сл',
  lightning: 'Мл',
  necrotic: 'Нк',
  poison: 'Яд',
  psychic: 'Пс',
  radiant: 'Из',
  thunder: 'Гр',
};

/** Иконки защит от урона (сопротивление/иммунитет/уязвимость). */
export default function DefenseChips({ defenses, className }: { defenses: DamageDefense[]; className?: string }) {
  if (!defenses.length) return null;
  return (
    <div className={`def-chips${className ? ` ${className}` : ''}`}>
      {defenses.map((d) => {
        const typeName = damageTypeName(d.damageType) ?? d.damageType;
        return (
          <span
            key={d.id}
            className={`def-chip def-${d.type}`}
            title={`${DEFENSE_TYPE_NAMES[d.type]}: ${typeName} — ${DEFENSE_DESCRIPTION[d.type]}`}
          >
            <svg
              viewBox="0 0 24 24"
              className="def-chip-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l7 3v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6z" />
            </svg>
            <span className="def-chip-abbr">{ABBR[d.damageType] ?? d.damageType.slice(0, 2)}</span>
          </span>
        );
      })}
    </div>
  );
}
