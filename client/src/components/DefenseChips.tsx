import { DAMAGE_TYPES, type DamageDefense } from 'shared';
import { t, type MessageKey } from '../i18n';
import { damageLabel, defenseLabel } from '../i18n/domain';

const DEFENSE_DESCRIPTION: Record<DamageDefense['type'], MessageKey> = {
  immunity: 'ui.defChips.desc.immunity',
  resistance: 'ui.defChips.desc.resistance',
  vulnerability: 'ui.defChips.desc.vulnerability',
};

const ABBR: Record<string, MessageKey> = {
  slashing: 'ui.defChips.abbr.slashing',
  piercing: 'ui.defChips.abbr.piercing',
  bludgeoning: 'ui.defChips.abbr.bludgeoning',
  acid: 'ui.defChips.abbr.acid',
  cold: 'ui.defChips.abbr.cold',
  fire: 'ui.defChips.abbr.fire',
  force: 'ui.defChips.abbr.force',
  lightning: 'ui.defChips.abbr.lightning',
  necrotic: 'ui.defChips.abbr.necrotic',
  poison: 'ui.defChips.abbr.poison',
  psychic: 'ui.defChips.abbr.psychic',
  radiant: 'ui.defChips.abbr.radiant',
  thunder: 'ui.defChips.abbr.thunder',
};

const DAMAGE_KEYS = new Set(DAMAGE_TYPES.map((d) => d.key));

/** Иконки защит от урона (сопротивление/иммунитет/уязвимость). */
export default function DefenseChips({ defenses, className }: { defenses: DamageDefense[]; className?: string }) {
  if (!defenses.length) return null;
  return (
    <div className={`def-chips${className ? ` ${className}` : ''}`}>
      {defenses.map((d) => {
        const typeName = DAMAGE_KEYS.has(d.damageType) ? damageLabel(d.damageType) : d.damageType;
        const abbr = ABBR[d.damageType];
        return (
          <span
            key={d.id}
            className={`def-chip def-${d.type}`}
            title={`${defenseLabel(d.type)}: ${typeName} — ${t(DEFENSE_DESCRIPTION[d.type])}`}
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
            <span className="def-chip-abbr">{abbr ? t(abbr) : d.damageType.slice(0, 2)}</span>
          </span>
        );
      })}
    </div>
  );
}
