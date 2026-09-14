import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ABILITIES, type AbilityKey, type Spell, type TokenStatblock } from 'shared';
import { useSpells } from '../lib/useSpells';
import { spellMechanicsShort } from '../lib/spellText';
import SpellIcon from './SpellIcon';

type Spellcasting = NonNullable<TokenStatblock['spellcasting']>;

interface Props {
  statblock: TokenStatblock;
  onChange: (value: TokenStatblock) => void;
}

const SLOT_LEVELS = [1, 2, 3, 4, 5, 6];
const levelLabel = (level: number) => (level === 0 ? 'Фокусы' : `${level} круг`);

/** Вкладка «Заклинания» статблока: характеристика, ячейки и список заклинаний монстра. */
export default function StatblockSpells({ statblock, onChange }: Props) {
  const sc = statblock.spellcasting;
  const spells = useSpells();
  const [pickerOpen, setPickerOpen] = useState(false);

  const byKey = useMemo(() => new Map(spells.map((s) => [s.key, s])), [spells]);
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
          <span>Характеристика</span>
          <select value={sc.ability} onChange={(e) => patch({ ability: e.target.value as AbilityKey })}>
            {ABILITIES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Сложность (DC)</span>
          <input
            type="number"
            min={0}
            max={40}
            value={sc.dc ?? ''}
            onChange={(e) => patch({ dc: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })}
          />
        </label>
        <label className="field">
          <span>Атака</span>
          <input
            type="number"
            min={0}
            max={40}
            value={sc.attack ?? ''}
            onChange={(e) => patch({ attack: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })}
          />
        </label>
      </div>

      <div className="sheet-section-title">Ячейки</div>
      <div className="slots-grid">
        <div className="slot-cell slot-head">
          <span className="slot-level">Ур.</span>
          <span className="slot-cap">Макс</span>
          <span className="slot-cap">Остаток</span>
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
                title={`Максимум ячеек ${level} круга`}
                onChange={(e) => setSlotMax(level, Number(e.target.value))}
              />
              <input
                type="number"
                min={0}
                max={slot?.max ?? 0}
                value={slot?.current ?? 0}
                disabled={!slot}
                title="Остаток"
                onChange={(e) => setSlotCurrent(level, Number(e.target.value))}
              />
            </div>
          );
        })}
      </div>

      <div className="sheet-section-title">Список заклинаний</div>
      {chosen.length === 0 && <div className="spells-note">Список пуст — кастовать нечего.</div>}
      {chosen.map((s) => (
        <div className="spell-row" key={s.key}>
          <SpellIcon spell={s} className="spell-row-icon" />
          <span className="spell-name">{s.name}</span>
          <span className="spell-school">{levelLabel(s.level)}</span>
          <button type="button" className="spell-remove" title="Убрать" onClick={() => toggleSpell(s.key)}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="spell-add" onClick={() => setPickerOpen(true)}>
        + Добавить заклинание
      </button>

      {pickerOpen && (
        <SpellPicker
          spells={spells}
          chosen={new Set(sc.spells ?? [])}
          onToggle={toggleSpell}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

interface PickerProps {
  spells: Spell[];
  chosen: Set<string>;
  onToggle: (key: string) => void;
  onClose: () => void;
}

function SpellPicker({ spells, chosen, onToggle, onClose }: PickerProps) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<number | 'all'>('all');

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spells
      .filter((s) => (level === 'all' ? true : s.level === level))
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [spells, level, query]);

  return createPortal(
    <div className="modal-backdrop spell-picker-backdrop" onMouseDown={onClose}>
      <div className="modal spell-picker" onMouseDown={(e) => e.stopPropagation()}>
        <h3>
          Заклинания статблока
          <span className="spell-picker-count">выбрано {chosen.size}</span>
        </h3>

        <div className="spell-picker-filters">
          <input type="text" placeholder="Поиск по названию" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={String(level)} onChange={(e) => setLevel(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">Все круги</option>
            {Array.from({ length: 7 }, (_, i) => i).map((l) => (
              <option key={l} value={String(l)}>
                {levelLabel(l)}
              </option>
            ))}
          </select>
        </div>

        <div className="spell-picker-list">
          {candidates.length === 0 && <div className="spells-note">Ничего не найдено.</div>}
          {candidates.map((s) => (
            <button
              type="button"
              key={s.key}
              className={`spell-pick${chosen.has(s.key) ? ' added' : ''}`}
              onClick={() => onToggle(s.key)}
            >
              <SpellIcon spell={s} className="spell-pick-icon" />
              <span className="spell-pick-name">{s.name}</span>
              <span className="spell-pick-meta">{levelLabel(s.level)}</span>
              <span className="spell-pick-desc">{spellMechanicsShort(s)}</span>
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
