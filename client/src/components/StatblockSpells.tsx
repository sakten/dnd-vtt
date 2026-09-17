import { useMemo, useState } from 'react';
import { ABILITIES, type AbilityKey, type Spell, type TokenStatblock } from 'shared';
import { useSpells } from '../lib/useSpells';
import { t } from '../i18n';
import { abilityName } from '../i18n/domain';
import { spellLevelLabel } from '../lib/spellText';
import SpellIcon from './SpellIcon';
import SpellPicker from './SpellPicker';

type Spellcasting = NonNullable<TokenStatblock['spellcasting']>;

interface Props {
  statblock: TokenStatblock;
  onChange: (value: TokenStatblock) => void;
}

const SLOT_LEVELS = [1, 2, 3, 4, 5, 6];

/** Вкладка «Заклинания» статблока: характеристика, ячейки и список заклинаний монстра. */
export default function StatblockSpells({ statblock, onChange }: Props) {
  const sc = statblock.spellcasting;
  const spells = useSpells();
  const [pickerOpen, setPickerOpen] = useState(false);

  const byKey = useMemo(() => new Map((spells ?? []).map((s) => [s.key, s])), [spells]);
  if (!sc) return null;

  const patch = (p: Partial<Spellcasting>) => onChange({ ...statblock, spellcasting: { ...sc, ...p } });
  const chosen = (sc.spells ?? []).map((k) => byKey.get(k)).filter((s): s is Spell => !!s);
  const slotAt = (level: number) => (sc.slots ?? []).find((s) => s.level === level);

  const setSlotMax = (level: number, raw: number) => {
    const max = Math.max(0, Math.min(99, Math.round(raw) || 0));
    const rest = (sc.slots ?? []).filter((s) => s.level !== level);
    if (max > 0) {
      const prev = slotAt(level);
      rest.push({ level, max, current: Math.min(prev?.current ?? max, max) });
    }
    rest.sort((a, b) => a.level - b.level);
    patch({ slots: rest.length ? rest : undefined });
  };

  const setSlotCurrent = (level: number, raw: number) => {
    const slot = slotAt(level);
    if (!slot) return;
    const current = Math.max(0, Math.min(slot.max, Math.round(raw) || 0));
    patch({ slots: (sc.slots ?? []).map((s) => (s.level === level ? { ...s, current } : s)) });
  };

  const toggleSpell = (key: string) => {
    const keys = sc.spells ?? [];
    patch({ spells: keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key] });
  };

  return (
    <div className="statblock-spells">
      <div className="field-row">
        <label className="field">
          <span>{t('ui.statblockSpells.ability')}</span>
          <select value={sc.ability} onChange={(e) => patch({ ability: e.target.value as AbilityKey })}>
            {ABILITIES.map((a) => (
              <option key={a.key} value={a.key}>
                {abilityName(a.key)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('ui.statblockSpells.dc')}</span>
          <input
            type="number"
            min={0}
            max={40}
            value={sc.dc ?? ''}
            onChange={(e) => patch({ dc: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })}
          />
        </label>
        <label className="field">
          <span>{t('ui.statblockSpells.attack')}</span>
          <input
            type="number"
            min={0}
            max={40}
            value={sc.attack ?? ''}
            onChange={(e) => patch({ attack: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })}
          />
        </label>
      </div>

      <div className="sheet-section-title">{t('ui.statblockSpells.slots')}</div>
      <div className="slots-grid">
        <div className="slot-cell slot-head">
          <span className="slot-level">{t('ui.common.levelShort')}</span>
          <span className="slot-cap">{t('ui.statblockSpells.max')}</span>
          <span className="slot-cap">{t('ui.statblockSpells.current')}</span>
        </div>
        {SLOT_LEVELS.map((level) => {
          const slot = slotAt(level);
          return (
            <div className="slot-cell" key={level}>
              <span className="slot-level">{level}</span>
              <input
                type="number"
                min={0}
                max={99}
                value={slot?.max ?? 0}
                title={t('ui.statblockSpells.slotMaxTitle', { n: level })}
                onChange={(e) => setSlotMax(level, Number(e.target.value))}
              />
              <input
                type="number"
                min={0}
                max={slot?.max ?? 0}
                value={slot?.current ?? 0}
                disabled={!slot}
                title={t('ui.statblockSpells.currentTitle')}
                onChange={(e) => setSlotCurrent(level, Number(e.target.value))}
              />
            </div>
          );
        })}
      </div>

      <div className="sheet-section-title">{t('ui.statblockSpells.spellList')}</div>
      {chosen.length === 0 && <div className="spells-note">{t('ui.statblockSpells.empty')}</div>}
      {chosen.map((s) => (
        <div className="spell-row" key={s.key}>
          <SpellIcon spell={s} className="spell-row-icon" />
          <span className="spell-name">{s.name}</span>
          <span className="spell-school">{spellLevelLabel(s.level)}</span>
          <button type="button" className="spell-remove" title={t('ui.common.remove')} onClick={() => toggleSpell(s.key)}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="spell-add" onClick={() => setPickerOpen(true)}>
        {t('ui.spells.add')}
      </button>

      {pickerOpen && (
        <SpellPicker
          title={t('ui.statblockSpells.pickerTitle')}
          countLabel={t('ui.statblockSpells.pickerCount', { n: (sc.spells ?? []).length })}
          candidates={spells ?? []}
          levels={['all', ...SLOT_LEVELS]}
          stateOf={(s) => ({ added: (sc.spells ?? []).includes(s.key) })}
          onToggle={(s) => toggleSpell(s.key)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
