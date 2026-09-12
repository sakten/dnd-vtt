import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ABILITIES,
  CLASS_LIST,
  MAX_ATTACKS,
  SKILLS,
  abilityMod,
  classSaves,
  computedMaxHp,
  emptyAttack,
  normalizeSheet,
  subclassList,
  type AbilityKey,
  type AttackEntry,
  type CharacterSheet,
  type ClassLevel,
  type SkillLevel,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { bonusPart, defaultSheet, skillPreview } from '../lib/sheet';
import SpellsPanel from './SpellsPanel';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CharacterSheetModal({ open, onClose }: Props) {
  const stored = useGameStore((s) => s.sheet);
  const setSheet = useGameStore((s) => s.setSheet);
  const [draft, setDraft] = useState<CharacterSheet | null>(null);
  const [tab, setTab] = useState<'main' | 'spells'>('main');

  useEffect(() => {
    if (!open) return;
    const base = stored ? normalizeSheet(stored) : defaultSheet();
    if (!base.name.trim()) {
      const { players, selfId } = useGameStore.getState();
      const me = players.find((p) => p.id === selfId);
      if (me?.name) base.name = me.name;
    }
    setDraft(base);
    setTab('main');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сбрасываем черновик только при открытии
  }, [open]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open || !draft) return null;

  const setAbility = (key: AbilityKey, value: number) => {
    const n = Number(value);
    const clamped = Number.isFinite(n) ? Math.min(30, Math.max(0, Math.round(n))) : 10;
    setDraft({ ...draft, abilities: { ...draft.abilities, [key]: clamped } });
  };

  const cycleSkill = (key: string) => {
    const current: SkillLevel = draft.skills[key] ?? 0;
    const next: SkillLevel = ((current + 1) % 3) as SkillLevel;
    setDraft({ ...draft, skills: { ...draft.skills, [key]: next } });
  };

  const setWeapon = (index: number, patch: Partial<AttackEntry>) => {
    setDraft((d) =>
      d ? { ...d, attacks: d.attacks.map((w, i) => (i === index ? { ...w, ...patch } : w)) } : d
    );
  };

  const addWeapon = () =>
    setDraft((d) => (d && d.attacks.length < MAX_ATTACKS ? { ...d, attacks: [...d.attacks, emptyAttack()] } : d));

  const removeWeapon = (index: number) =>
    setDraft((d) => (d && d.attacks.length > 1 ? { ...d, attacks: d.attacks.filter((_, i) => i !== index) } : d));

  const setClassLevel = (index: number, patch: Partial<ClassLevel>) => {
    setDraft((d) => {
      if (!d) return d;
      const classes = [...d.classes];
      while (classes.length <= index) classes.push({ className: '', level: 1 });
      const next = { ...classes[index], ...patch };
      if (patch.className !== undefined) next.subclass = undefined;
      if (next.level < 3) next.subclass = undefined;
      classes[index] = next;
      // Профишенси спасбросков заполняем по основному (первому) классу; их можно менять вручную.
      let saves = d.saves;
      if (index === 0 && patch.className !== undefined) {
        saves = {};
        for (const key of classSaves(patch.className)) saves[key] = true;
      }
      return { ...d, classes, saves };
    });
  };

  const addClassLevel = () =>
    setDraft((d) =>
      d && d.classes.length < 2 ? { ...d, classes: [...d.classes, { className: '', level: 1 }] } : d
    );

  const removeClassLevel = (index: number) =>
    setDraft((d) => (d ? { ...d, classes: d.classes.filter((_, i) => i !== index) } : d));

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal sheet-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <h3>Карточка персонажа</h3>
        <div className="sheet-tabs">
          <button type="button" className={tab === 'main' ? 'active' : ''} onClick={() => setTab('main')}>
            Основное
          </button>
          <button type="button" className={tab === 'spells' ? 'active' : ''} onClick={() => setTab('spells')}>
            Заклинания
          </button>
        </div>
        {tab === 'main' && (
        <>
        <label className="field">
          <span>Имя персонажа</span>
          <input
            type="text"
            value={draft.name}
            maxLength={40}
            placeholder="Необязательно"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>

        <div className="sheet-section-title">Классы (до 2)</div>
        {draft.classes.map((cl, i) => (
          <div className="class-row" key={i}>
            <label className="field">
              <span>Класс</span>
              <select value={cl.className} onChange={(e) => setClassLevel(i, { className: e.target.value })}>
                <option value="">— не выбран —</option>
                {CLASS_LIST.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field class-level">
              <span>Ур.</span>
              <input
                type="number"
                min={1}
                max={20}
                value={cl.level}
                onChange={(e) =>
                  setClassLevel(i, { level: Math.min(20, Math.max(1, Number(e.target.valueAsNumber) || 1)) })
                }
              />
            </label>
            {cl.className && cl.level >= 3 && subclassList(cl.className).length > 0 && (
              <label className="field subclass-field">
                <span>Подкласс</span>
                <select
                  value={cl.subclass ?? ''}
                  onChange={(e) => setClassLevel(i, { subclass: e.target.value || undefined })}
                >
                  <option value="">— не выбран —</option>
                  {subclassList(cl.className).map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name} ({s.source})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="class-remove" title="Убрать класс" onClick={() => removeClassLevel(i)}>
              ✕
            </button>
          </div>
        ))}
        {draft.classes.length < 2 && (
          <button className="class-add" onClick={addClassLevel}>
            + Добавить класс
          </button>
        )}

        <label className="field">
          <span>Макс. хиты (пусто — авто: класс + Телосложение)</span>
          <input
            type="text"
            value={draft.hpMax}
            placeholder={String(computedMaxHp(draft.classes, draft.abilities))}
            maxLength={10}
            onChange={(e) => setDraft({ ...draft, hpMax: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Класс брони (AC)</span>
          <input
            type="number"
            min={0}
            max={99}
            value={draft.ac}
            placeholder="10"
            onChange={(e) => setDraft({ ...draft, ac: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Скорость, фт</span>
          <input
            type="number"
            min={0}
            max={1000}
            value={draft.speed}
            placeholder="30"
            onChange={(e) =>
              setDraft({ ...draft, speed: Math.max(0, Math.round(Number(e.target.valueAsNumber) || 0)) })
            }
          />
        </label>

        <div className="sheet-section-title">Характеристики</div>
        <div className="ability-grid">
          {ABILITIES.map((a) => {
            const mod = abilityMod(draft.abilities[a.key]);
            return (
              <div className="ability-cell" key={a.key}>
                <span className="ability-name">{a.name}</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={draft.abilities[a.key]}
                  onChange={(e) => setAbility(a.key, e.target.valueAsNumber)}
                />
                <span className={`mod-badge ${mod >= 0 ? 'pos' : 'neg'}`}>
                  {mod >= 0 ? '+' : ''}
                  {mod}
                </span>
              </div>
            );
          })}
        </div>

        <label className="field">
          <span>Профишенси бонус (число или куб)</span>
          <input
            type="text"
            value={draft.proficiencyBonus}
            maxLength={10}
            onChange={(e) => setDraft({ ...draft, proficiencyBonus: e.target.value })}
          />
        </label>

        <div className="sheet-section-title">Спасброски (по основному классу — можно менять)</div>
        <div className="save-grid">
          {ABILITIES.map((a) => {
            const mod = abilityMod(draft.abilities[a.key]);
            return (
              <label className="checkbox-row" key={a.key}>
                <input
                  type="checkbox"
                  checked={draft.saves[a.key] === true}
                  onChange={(e) =>
                    setDraft({ ...draft, saves: { ...draft.saves, [a.key]: e.target.checked } })
                  }
                />
                {a.name}{' '}
                <span className="mod-badge pos">
                  {mod >= 0 ? '+' : ''}
                  {mod}
                  {draft.saves[a.key] ? bonusPart(draft.proficiencyBonus, 1) : ''}
                </span>
              </label>
            );
          })}
        </div>

        <div className="sheet-section-title">Навыки (клик: нет → профишенси → экспертиза)</div>
        <div className="skills-list">
          {SKILLS.map((s) => {
            const level = draft.skills[s.key] ?? 0;
            return (
              <div
                className={`skill-row level-${level}`}
                key={s.key}
                title="Клик — изменить уровень владения"
                onClick={() => cycleSkill(s.key)}
              >
                <span className="skill-name">{s.name}</span>
                <span className="skill-ability">{ABILITIES.find((a) => a.key === s.ability)?.name}</span>
                <span className="skill-bonus">{skillPreview(draft, s.key)}</span>
              </div>
            );
          })}
        </div>

        <div className="sheet-section-title">
          Оружие ({draft.attacks.length}/{MAX_ATTACKS})
        </div>
        {draft.attacks.map((weapon, i) => (
          <div className="weapon-block" key={i}>
            <div className="weapon-head">
              <span>Оружие {i + 1}</span>
              {draft.attacks.length > 1 && (
                <button type="button" className="weapon-remove" onClick={() => removeWeapon(i)}>
                  Удалить
                </button>
              )}
            </div>
            <label className="field">
              <span>Название</span>
              <input
                type="text"
                value={weapon.name}
                maxLength={40}
                placeholder="Например: Меч"
                onChange={(e) => setWeapon(i, { name: e.target.value })}
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Формула попадания</span>
                <input
                  type="text"
                  value={weapon.hit}
                  placeholder="d20+5"
                  onChange={(e) => setWeapon(i, { hit: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Формула урона</span>
                <input
                  type="text"
                  value={weapon.damage}
                  placeholder="d8+3"
                  onChange={(e) => setWeapon(i, { damage: e.target.value })}
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Дистанция</span>
                <select
                  value={weapon.rangeType}
                  onChange={(e) => setWeapon(i, { rangeType: e.target.value as AttackEntry['rangeType'] })}
                >
                  <option value="melee">Ближняя</option>
                  <option value="ranged">Дальняя</option>
                  <option value="none">Без дальности</option>
                </select>
              </label>
              {weapon.rangeType === 'melee' && (
                <label className="field">
                  <span>Досягаемость, фт</span>
                  <input
                    type="number"
                    min={0}
                    value={weapon.rangeNormal}
                    onChange={(e) => setWeapon(i, { rangeNormal: Number(e.target.value) })}
                  />
                </label>
              )}
              {weapon.rangeType === 'ranged' && (
                <>
                  <label className="field">
                    <span>Обычная, фт</span>
                    <input
                      type="number"
                      min={0}
                      value={weapon.rangeNormal}
                      onChange={(e) => setWeapon(i, { rangeNormal: Number(e.target.value) })}
                    />
                  </label>
                  <label className="field">
                    <span>Дальняя, фт</span>
                    <input
                      type="number"
                      min={0}
                      value={weapon.rangeLong}
                      onChange={(e) => setWeapon(i, { rangeLong: Number(e.target.value) })}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="weapon-add"
          onClick={addWeapon}
          disabled={draft.attacks.length >= MAX_ATTACKS}
        >
          + Добавить атаку
        </button>
        </>
        )}

        {tab === 'spells' && (
          <SpellsPanel sheet={draft} onChange={(spells) => setDraft((d) => (d ? { ...d, spells } : d))} />
        )}

        <div className="modal-actions">
          <button
            className="primary"
            onClick={() => {
              setSheet(draft);
              onClose();
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
