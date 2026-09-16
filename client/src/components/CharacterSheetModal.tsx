import { useEffect, useState } from 'react';
import {
  ABILITIES,
  CLASS_LIST,
  MAX_CLASSES,
  SKILLS,
  abilityMod,
  classSaves,
  computedMaxHp,
  normalizeSheet,
  subclassList,
  type AbilityKey,
  type CharacterSheet,
  type ClassLevel,
  type SkillLevel,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { bonusPart, defaultSheet, skillPreview } from '../lib/sheet';
import SensesForm from './SensesForm';
import AttacksForm from './AttacksForm';
import DamageDefensesForm from './DamageDefensesForm';
import FeatsForm from './FeatsForm';
import Modal from './Modal';
import SpellsPanel from './SpellsPanel';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CharacterSheetModal({ open, onClose }: Props) {
  const stored = useGameStore((s) => s.sheet);
  const setSheet = useGameStore((s) => s.setSheet);
  const [draft, setDraft] = useState<CharacterSheet | null>(null);
  const [tab, setTab] = useState<'main' | 'spells' | 'talents'>('main');

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

  const setClassLevel = (index: number, patch: Partial<ClassLevel>) => {
    setDraft((d) => {
      if (!d) return d;
      const classes = [...d.classes];
      while (classes.length <= index) classes.push({ className: '', level: 1 });
      const next: ClassLevel = { ...(classes[index] ?? { className: '', level: 1 }), ...patch };
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
      d && d.classes.length < MAX_CLASSES ? { ...d, classes: [...d.classes, { className: '', level: 1 }] } : d
    );

  const removeClassLevel = (index: number) =>
    setDraft((d) => (d ? { ...d, classes: d.classes.filter((_, i) => i !== index) } : d));

  return (
    <Modal onClose={onClose} title="Карточка персонажа" className="sheet-modal">
        <div className="sheet-tabs">
          <button type="button" className={tab === 'main' ? 'active' : ''} onClick={() => setTab('main')}>
            Основное
          </button>
          <button type="button" className={tab === 'spells' ? 'active' : ''} onClick={() => setTab('spells')}>
            Заклинания
          </button>
          <button type="button" className={tab === 'talents' ? 'active' : ''} onClick={() => setTab('talents')}>
            Таланты
          </button>
        </div>
        <div className="sheet-body">
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

        <div className="sheet-section-title">Классы (до {MAX_CLASSES})</div>
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
        {draft.classes.length < MAX_CLASSES && (
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
            placeholder="13"
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

        <div className="sheet-section-title">Зрение</div>
        <SensesForm value={draft.senses} onChange={(senses) => setDraft({ ...draft, senses })} />

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
                  aria-label={a.name}
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

        <AttacksForm
          attacks={draft.attacks}
          title="Оружие"
          itemLabel="Оружие"
          namePlaceholder="Например: Меч"
          weaponContext={{ abilities: draft.abilities, classes: draft.classes, choices: draft.choices }}
          onChange={(attacks) => setDraft((d) => (d ? { ...d, attacks } : d))}
        />
        <DamageDefensesForm
          value={draft.damageDefenses ?? []}
          onChange={(damageDefenses) => setDraft((d) => (d ? { ...d, damageDefenses } : d))}
        />
        </>
        )}

        {tab === 'spells' && (
          <SpellsPanel sheet={draft} onChange={(spells) => setDraft((d) => (d ? { ...d, spells } : d))} />
        )}

        {tab === 'talents' && (
          <FeatsForm
            choices={draft.choices ?? []}
            classes={draft.classes}
            onChange={(choices) => setDraft((d) => (d ? { ...d, choices } : d))}
          />
        )}
        </div>

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
    </Modal>
  );
}
