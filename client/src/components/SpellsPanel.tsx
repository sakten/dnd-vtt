import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ABILITIES,
  CLASSES,
  abilityMod,
  casterClasses,
  casterLevelOf,
  cantripsMax,
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
import { loadSpells } from '../lib/spells';
import { spellMechanics, spellMechanicsShort } from '../lib/spellText';
import SpellIcon from './SpellIcon';

const SCHOOL_RU: Record<string, string> = {
  Abjuration: 'Ограждение',
  Conjuration: 'Вызов',
  Divination: 'Прорицание',
  Enchantment: 'Очарование',
  Evocation: 'Воплощение',
  Illusion: 'Иллюзия',
  Necromancy: 'Некромантия',
  Transmutation: 'Преобразование',
};

const levelLabel = (level: number) => (level === 0 ? 'Фокусы' : `${level} круг`);
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

function abilityName(key: string): string {
  return ABILITIES.find((a) => a.key === key)?.name ?? key;
}

interface HoverState {
  spell: Spell;
  x: number;
  y: number;
  note?: string;
}

const HOVER_DELAY_MS = 1000;

/** Отложенный (1с) тултип с описанием заклинания; подходит для списка и пикера. */
function useSpellTooltip() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const handlers = (spell: Spell, note?: string) => ({
    onMouseEnter: (e: MouseEvent) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      const { clientX: x, clientY: y } = e;
      timer.current = window.setTimeout(() => setHover({ spell, x, y, note }), HOVER_DELAY_MS);
    },
    onMouseMove: (e: MouseEvent) => {
      setHover((h) => (h && h.spell.key === spell.key ? { spell, x: e.clientX, y: e.clientY, note: h.note } : h));
    },
    onMouseLeave: () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      setHover(null);
    },
  });

  return { handlers, node: hover ? <SpellTooltip {...hover} /> : null };
}

function SpellTooltip({ spell, x, y, note }: HoverState) {
  const width = Math.min(440, window.innerWidth - 16);
  const estHeight = Math.min(340, window.innerHeight * 0.5);
  const left = Math.max(8, Math.min(x + 16, window.innerWidth - width - 8));
  const top = y + 16 + estHeight > window.innerHeight ? Math.max(8, y - estHeight - 16) : y + 16;

  return createPortal(
    <div className="spell-tooltip" style={{ left, top, width }}>
      <h4>{spell.name}</h4>
      <div className="tip-meta">
        {levelLabel(spell.level)} · {SCHOOL_RU[spell.school] ?? spell.school}
        {spell.concentration ? ' · концентрация' : ''}
        {spell.ritual ? ' · ритуал' : ''}
      </div>
      <div className="tip-mechanics">
        {spellMechanics(spell).map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      {note && <div className="tip-note">{note}</div>}
      {spell.description.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {spell.higherLevel?.map((p, i) => (
        <p className="tip-higher" key={`h${i}`}>
          {p}
        </p>
      ))}
    </div>,
    document.body
  );
}

interface PanelProps {
  sheet: CharacterSheet;
  onChange: (spells: SheetSpell[]) => void;
}

export default function SpellsPanel({ sheet, onChange }: PanelProps) {
  const [data, setData] = useState<Spell[] | null>(null);
  const [pickerFor, setPickerFor] = useState<ClassLevel | null>(null);
  const tip = useSpellTooltip();

  useEffect(() => {
    let alive = true;
    loadSpells().then((spells) => {
      if (alive) setData(spells);
    });
    return () => {
      alive = false;
    };
  }, []);

  const byKey = useMemo(() => new Map((data ?? []).map((s) => [s.key, s])), [data]);
  const casters = casterClasses(sheet.classes);
  const granted = useMemo(() => grantedSpells(sheet.classes), [sheet.classes]);
  const prof = sheetProficiencyBonus(sheet);

  if (!data) return <div className="spells-note">Загрузка заклинаний…</div>;
  if (casters.length === 0) return <div className="spells-note">Нет заклинательных классов.</div>;

  const casterLevel = casterLevelOf(sheet.classes);
  const slotMax = spellSlotMaxes(sheet.classes).length;
  const pact = pactMax(sheet.classes);

  return (
    <div className="spells-panel">
      <div className="spells-slots">
        {casterLevel > 0 && <span>Слоты: кастер {casterLevel} ур. (до {slotMax} круга)</span>}
        {pact.count > 0 && (
          <span>
            Пакт: {pact.count} × {pact.level} круг
          </span>
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
              <span className="spell-class-name">{CLASSES[className]?.name ?? className}</span>
              <span className="spell-class-meta">
                {ability ? abilityName(ability) : '—'} · подготовка {leveled}/{preparedMax} · до {maxLvl} круга ·
                DC {dc}, атака {signed(atk)}
              </span>
            </div>

            {Array.from({ length: maxLvl + 1 }, (_, lvl) => lvl)
              .filter((lvl) => rows.some((r) => r.spell.level === lvl))
              .map((lvl) => (
                <div className="spell-level" key={lvl}>
                  <div className="spell-level-title">
                    {levelLabel(lvl)}
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
                        <span className="spell-name">{r.spell.name}</span>
                        {r.granted && <span className="spell-granted-tag" title="Выдано классом/подклассом">выдано</span>}
                        <span className="spell-tags">
                          {r.spell.concentration && <span title="Концентрация">К</span>}
                          {r.spell.ritual && <span title="Ритуал">Р</span>}
                        </span>
                        <span className="spell-school">{SCHOOL_RU[r.spell.school] ?? r.spell.school}</span>
                        {!r.granted && (
                          <button
                            type="button"
                            className="spell-remove"
                            title="Убрать"
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
              + Добавить заклинание
            </button>
          </section>
        );
      })}

      {pickerFor && (
        <SpellPicker
          entry={pickerFor}
          sheet={sheet}
          spells={data}
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

function SpellPicker({ entry, sheet, spells, onChange, onClose }: PickerProps) {
  const { className, level, subclass } = entry;
  const [query, setQuery] = useState('');
  const [lvl, setLvl] = useState<number | 'all'>('all');
  const tip = useSpellTooltip();
  const maxLvl = maxSpellLevel(className, level, subclass);
  const cantripMax = cantripsMax(className, level, subclass);
  const preparedMax = spellsMax(className, level, subclass);
  const listClass = spellListClass(className, subclass);

  const grantedKeys = useMemo(() => new Set(grantedSpells([entry]).map((g) => g.key)), [entry]);
  const pool = poolSpells([entry]);
  const chosen = (sheet.spells ?? []).filter((s) => s.className === className);
  const chosenKeys = new Set(chosen.map((s) => s.key));
  const chosenSpells = chosen.map((s) => spells.find((x) => x.key === s.key)).filter((s): s is Spell => !!s);
  const cantripCount = chosenSpells.filter((s) => s.level === 0).length;
  const leveledCount = chosenSpells.filter((s) => s.level > 0).length;

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const poolKeys = new Set(pool.map((g) => g.key));
    const seen = new Set<string>();
    const list: Spell[] = [];
    for (const s of spells) {
      if (!(s.classes.includes(listClass) || poolKeys.has(s.key)) || s.level > maxLvl) continue;
      if (seen.has(s.key)) continue;
      seen.add(s.key);
      list.push(s);
    }
    return list
      .filter((s) => (lvl === 'all' ? true : s.level === lvl))
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [spells, listClass, pool, maxLvl, lvl, query]);

  const toggle = (spell: Spell) => {
    if (grantedKeys.has(spell.key)) return;
    if (chosenKeys.has(spell.key)) {
      onChange((sheet.spells ?? []).filter((x) => !(x.className === className && x.key === spell.key)));
    } else {
      onChange([...(sheet.spells ?? []), { key: spell.key, className }]);
    }
  };

  const levels: (number | 'all')[] = ['all', ...Array.from({ length: maxLvl + 1 }, (_, i) => i)];

  return createPortal(
    <div className="modal-backdrop spell-picker-backdrop" onMouseDown={onClose}>
      <div className="modal spell-picker" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <h3>
          {CLASSES[className]?.name ?? className}: заклинания
          <span className="spell-picker-count">
            фокусы {cantripCount}/{cantripMax} · подготовка {leveledCount}/{preparedMax}
          </span>
        </h3>

        <div className="spell-picker-filters">
          <input type="text" placeholder="Поиск по названию" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={String(lvl)} onChange={(e) => setLvl(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            {levels.map((l) => (
              <option key={String(l)} value={String(l)}>
                {l === 'all' ? 'Все круги' : levelLabel(l)}
              </option>
            ))}
          </select>
        </div>

        <div className="spell-picker-list">
          {candidates.length === 0 && <div className="spells-note">Ничего не найдено.</div>}
          {candidates.map((s) => {
            const grantedFlag = grantedKeys.has(s.key);
            const added = grantedFlag || chosenKeys.has(s.key);
            const limit = s.level === 0 ? cantripMax : preparedMax;
            const count = s.level === 0 ? cantripCount : leveledCount;
            const full = !added && count >= limit;
            return (
              <button
                type="button"
                key={s.key}
                className={`spell-pick${added ? ' added' : ''}${grantedFlag ? ' granted' : ''}`}
                aria-disabled={grantedFlag || full}
                {...tip.handlers(s, grantedFlag ? 'Выдано классом/подклассом' : full ? 'Достигнут лимит' : undefined)}
                onClick={() => {
                  if (!grantedFlag && !full) toggle(s);
                }}
              >
                <SpellIcon spell={s} className="spell-pick-icon" />
                <span className="spell-pick-name">{s.name}</span>
                <span className="spell-pick-meta">
                  {levelLabel(s.level)} · {SCHOOL_RU[s.school] ?? s.school}
                  {s.concentration ? ' · К' : ''}
                  {s.ritual ? ' · Р' : ''}
                </span>
                <span className="spell-pick-desc">{spellMechanicsShort(s)}</span>
              </button>
            );
          })}
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Готово
          </button>
        </div>
        {tip.node}
      </div>
    </div>,
    document.body
  );
}
