import { useMemo, useState, type ReactNode } from 'react';
import type { Spell } from 'shared';
import { SPELL_SCHOOL_RU, spellLevelLabel, spellMechanicsShort } from '../lib/spellText';
import { t } from '../i18n';
import Modal from './Modal';
import SpellIcon from './SpellIcon';
import { useSpellTooltip } from './SpellTooltip';

export interface PickerSpellState {
  /** Заклинание уже выбрано (подсветка). */
  added: boolean;
  /** Выдано классом/подклассом — клики игнорируются. */
  locked?: boolean;
  /** Достигнут лимит — клики игнорируются. */
  disabled?: boolean;
  /** Примечание в тултипе. */
  note?: string;
}

interface Props {
  /** Кандидаты до фильтров поиска/круга. */
  candidates: Spell[];
  title: ReactNode;
  countLabel?: ReactNode;
  /** Варианты фильтра по кругу. */
  levels: (number | 'all')[];
  stateOf: (spell: Spell) => PickerSpellState;
  onToggle: (spell: Spell) => void;
  onClose: () => void;
}

/** Общий пикер заклинаний: поиск, фильтр по кругу, список с состоянием выбора. */
export default function SpellPicker({ candidates, title, countLabel, levels, stateOf, onToggle, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<number | 'all'>('all');
  const tip = useSpellTooltip();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((s) => (level === 'all' ? true : s.level === level))
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [candidates, level, query]);

  return (
    <Modal
      onClose={onClose}
      className="spell-picker"
      backdropClassName="spell-picker-backdrop"
      title={
        <>
          {title}
          {countLabel !== undefined && <span className="spell-picker-count">{countLabel}</span>}
        </>
      }
    >
      <div className="spell-picker-filters">
        <input type="text" placeholder={t('ui.spellPicker.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={String(level)} onChange={(e) => setLevel(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          {levels.map((l) => (
            <option key={String(l)} value={String(l)}>
              {l === 'all' ? t('ui.spellPicker.allLevels') : spellLevelLabel(l)}
            </option>
          ))}
        </select>
      </div>

      <div className="spell-picker-list">
        {shown.length === 0 && <div className="spells-note">{t('ui.common.notFoundDot')}</div>}
        {shown.map((s) => {
          const state = stateOf(s);
          const blocked = state.locked || state.disabled;
          return (
            <button
              type="button"
              key={s.key}
              className={`spell-pick${state.added ? ' added' : ''}${state.locked ? ' granted' : ''}`}
              aria-disabled={blocked || undefined}
              {...tip.handlers(s, state.note)}
              onClick={() => {
                if (!blocked) onToggle(s);
              }}
            >
              <SpellIcon spell={s} className="spell-pick-icon" />
              <span className="spell-pick-name">{s.name}</span>
              <span className="spell-pick-meta">
                {spellLevelLabel(s.level)} · {SPELL_SCHOOL_RU[s.school] ?? s.school}
                {s.concentration ? ` · ${t('ui.spells.concentrationShort')}` : ''}
                {s.ritual ? ` · ${t('ui.spells.ritualShort')}` : ''}
              </span>
              <span className="spell-pick-desc">{spellMechanicsShort(s)}</span>
            </button>
          );
        })}
      </div>

      <div className="modal-actions">
        <button className="primary" onClick={onClose}>
          {t('ui.common.done')}
        </button>
      </div>
      {tip.node}
    </Modal>
  );
}
