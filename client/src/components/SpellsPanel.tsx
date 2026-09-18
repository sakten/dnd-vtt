import { useMemo, useState } from 'react';
import {
  abilityMod,
  casterClasses,
  casterLevelOf,
  cantripsMax,
  choiceSpellGrants,
  grantedSpells,
  maxSpellLevel,
  pactMax,
  poolSpells,
  spellAttackBonus,
  spellListClass,
  spellSaveDc,
  spellSlotMaxes,
  sheetProficiencyBonus,
  spellcastingAbility,
  spellsMax,
  type CharacterSheet,
  type ClassLevel,
  type SheetSpell,
  type Spell,
} from 'shared';
import { useSpells } from '../lib/useSpells';
import { t } from '../i18n';
import { spellDisplayName } from '../i18n/names';
import { abilityName, classLabel } from '../i18n/domain';
import { useSpellText } from '../i18n/useLocalizedText';
import { spellLevelLabel, spellSchoolLabel } from '../lib/spellText';
import SpellIcon from './SpellIcon';
import SpellPicker from './SpellPicker';
import { useSpellTooltip } from './SpellTooltip';

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

interface PanelProps {
  sheet: CharacterSheet;
  onChange: (spells: SheetSpell[]) => void;
}

export default function SpellsPanel({ sheet, onChange }: PanelProps) {
  useSpellText();
  const spells = useSpells();
  const [pickerFor, setPickerFor] = useState<ClassLevel | null>(null);
  const tip = useSpellTooltip();

  const byKey = useMemo(() => new Map((spells ?? []).map((s) => [s.key, s])), [spells]);
  const casters = casterClasses(sheet.classes);
  const granted = useMemo(
    () => [
      ...grantedSpells(sheet.classes),
      ...choiceSpellGrants(sheet.choices).map((g) => ({ ...g, level: 0 })),
    ],
    [sheet.classes, sheet.choices]
  );
  const prof = sheetProficiencyBonus(sheet);

  if (!spells) return <div className="spells-note">{t('ui.common.loadingSpells')}</div>;
  if (casters.length === 0) return <div className="spells-note">{t('ui.spells.noCasters')}</div>;

  const casterLevel = casterLevelOf(sheet.classes);
  const slotMax = spellSlotMaxes(sheet.classes).length;
  const pact = pactMax(sheet.classes);

  return (
    <div className="spells-panel">
      <div className="spells-slots">
        {casterLevel > 0 && (
          <span>{t('ui.spells.slots', { level: casterLevel, max: slotMax })}</span>
        )}
        {pact.count > 0 && (
          <span>{t('ui.spells.pact', { count: pact.count, level: pact.level })}</span>
        )}
      </div>

      {casters.map((entry) => {
        const className = entry.className;
        const ability = spellcastingAbility(className, entry.subclass);
        const mod = ability ? abilityMod(sheet.abilities[ability]) : 0;
        const dc = spellSaveDc(prof, mod);
        const atk = spellAttackBonus(prof, mod);
        const preparedMax = spellsMax(className, entry.level, entry.subclass);
        const cantripMax = cantripsMax(className, entry.level, entry.subclass);
        const maxLvl = maxSpellLevel(className, entry.level, entry.subclass);
        const grantedKeys = new Set(granted.filter((g) => g.className === className).map((g) => g.key));
        const chosen = (sheet.spells ?? [])
          .filter((s) => s.className === className && !grantedKeys.has(s.key))
          .map((s) => byKey.get(s.key))
          .filter((s): s is Spell => !!s);
        const grantedFor = granted
          .filter((g) => g.className === className)
          .map((g) => byKey.get(g.key))
          .filter((s): s is Spell => !!s);
        const rows = [...grantedFor.map((spell) => ({ spell, granted: true })), ...chosen.map((spell) => ({ spell, granted: false }))];
        const leveled = chosen.filter((s) => s.level > 0).length;
        const cantrips = chosen.filter((s) => s.level === 0).length;

        return (
          <section className="spell-class" key={`${className}:${entry.subclass ?? ''}`}>
            <div className="spell-class-head">
              <span className="spell-class-name">{classLabel(className)}</span>
              <span className="spell-class-meta">
                {t('ui.spells.classMeta', {
                  ability: ability ? abilityName(ability) : '—',
                  prepared: leveled,
                  max: preparedMax,
                  maxLevel: maxLvl,
                  dc,
                  attack: signed(atk),
                })}
              </span>
            </div>

            {Array.from({ length: maxLvl + 1 }, (_, lvl) => lvl)
              .filter((lvl) => rows.some((r) => r.spell.level === lvl))
              .map((lvl) => (
                <div className="spell-level" key={lvl}>
                  <div className="spell-level-title">
                    {spellLevelLabel(lvl)}
                    {lvl === 0 && <span className="spell-level-count"> {cantrips}/{cantripMax}</span>}
                  </div>
                  {rows
                    .filter((r) => r.spell.level === lvl)
                    .map((r) => (
                      <div
                        className={`spell-row${r.granted ? ' granted' : ''}`}
                        key={`${r.spell.key}:${r.granted}`}
                        {...tip.handlers(r.spell)}
                      >
                        <SpellIcon spell={r.spell} className="spell-row-icon" />
                        <span className="spell-name">{spellDisplayName(r.spell)}</span>
                        {r.granted && (
                          <span className="spell-granted-tag" title={t('ui.spells.grantedTitle')}>
                            {t('ui.spells.granted')}
                          </span>
                        )}
                        <span className="spell-tags">
                          {r.spell.concentration && (
                            <span title={t('ui.spells.concentration')}>{t('ui.spells.concentrationShort')}</span>
                          )}
                          {r.spell.ritual && <span title={t('ui.spells.ritual')}>{t('ui.spells.ritualShort')}</span>}
                        </span>
                        <span className="spell-school">{spellSchoolLabel(r.spell.school)}</span>
                        {!r.granted && (
                          <button
                            type="button"
                            className="spell-remove"
                            title={t('ui.common.remove')}
                            onClick={() => onChange((sheet.spells ?? []).filter((x) => !(x.className === className && x.key === r.spell.key)))}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              ))}

            <button type="button" className="spell-add" disabled={maxLvl === 0 && cantripMax === 0} onClick={() => setPickerFor(entry)}>
              {t('ui.spells.add')}
            </button>
          </section>
        );
      })}

      {pickerFor && (
        <SheetSpellPicker
          entry={pickerFor}
          sheet={sheet}
          spells={spells}
          onChange={onChange}
          onClose={() => setPickerFor(null)}
        />
      )}
      {tip.node}
    </div>
  );
}

interface PickerProps {
  entry: ClassLevel;
  sheet: CharacterSheet;
  spells: Spell[];
  onChange: (spells: SheetSpell[]) => void;
  onClose: () => void;
}

function SheetSpellPicker({ entry, sheet, spells, onChange, onClose }: PickerProps) {
  const { className, level, subclass } = entry;
  const maxLvl = maxSpellLevel(className, level, subclass);
  const cantripMax = cantripsMax(className, level, subclass);
  const preparedMax = spellsMax(className, level, subclass);
  const listClass = spellListClass(className, subclass);

  const grantedKeys = useMemo(() => {
    const keys = new Set(grantedSpells([entry]).map((g) => g.key));
    for (const g of choiceSpellGrants(sheet.choices)) if (g.className === className) keys.add(g.key);
    return keys;
  }, [entry, className, sheet.choices]);
  const pool = poolSpells([entry]);
  const chosen = (sheet.spells ?? []).filter((s) => s.className === className);
  const chosenKeys = new Set(chosen.map((s) => s.key));
  const chosenSpells = chosen.map((s) => spells.find((x) => x.key === s.key)).filter((s): s is Spell => !!s);
  const cantripCount = chosenSpells.filter((s) => s.level === 0).length;
  const leveledCount = chosenSpells.filter((s) => s.level > 0).length;

  const candidates = useMemo(() => {
    const poolKeys = new Set(pool.map((g) => g.key));
    const seen = new Set<string>();
    const list: Spell[] = [];
    for (const s of spells) {
      if (!(s.classes.includes(listClass) || poolKeys.has(s.key)) || s.level > maxLvl) continue;
      if (seen.has(s.key)) continue;
      seen.add(s.key);
      list.push(s);
    }
    return list;
  }, [spells, listClass, pool, maxLvl]);

  const toggle = (spell: Spell) => {
    if (chosenKeys.has(spell.key)) {
      onChange((sheet.spells ?? []).filter((x) => !(x.className === className && x.key === spell.key)));
    } else {
      onChange([...(sheet.spells ?? []), { key: spell.key, className }]);
    }
  };

  const levels: (number | 'all')[] = ['all', ...Array.from({ length: maxLvl + 1 }, (_, i) => i)];

  return (
    <SpellPicker
      title={t('ui.spells.pickerTitle', { name: classLabel(className) })}
      countLabel={t('ui.spells.pickerCount', {
        cantrips: cantripCount,
        cantripMax,
        leveled: leveledCount,
        preparedMax,
      })}
      candidates={candidates}
      levels={levels}
      stateOf={(s) => {
        const locked = grantedKeys.has(s.key);
        const added = locked || chosenKeys.has(s.key);
        const count = s.level === 0 ? cantripCount : leveledCount;
        const limit = s.level === 0 ? cantripMax : preparedMax;
        const full = !added && count >= limit;
        return {
          added,
          locked,
          disabled: full,
          note: locked ? t('ui.spells.grantedTitle') : full ? t('ui.spells.limitReached') : undefined,
        };
      }}
      onToggle={toggle}
      onClose={onClose}
    />
  );
}
