import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ABILITIES,
  SKILLS,
  abilityMod,
  normalizeSheet,
  type AbilityKey,
  type AttackEntry,
  type CharacterSheet,
  type SkillLevel,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { bonusPart, defaultSheet, skillPreview } from '../lib/sheet';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CharacterSheetModal({ open, onClose }: Props) {
  const stored = useGameStore((s) => s.sheet);
  const setSheet = useGameStore((s) => s.setSheet);
  const [draft, setDraft] = useState<CharacterSheet | null>(null);

  useEffect(() => {
    if (open) setDraft(stored ? normalizeSheet(stored) : defaultSheet());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сбрасываем черновик только при открытии
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal sheet-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <h3>Карточка персонажа</h3>
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

        <div className="sheet-section-title">Характеристики</div>
        <div className="ability-grid">
          {ABILITIES.map((a) => (
            <div className="ability-cell" key={a.key}>
              <span className="ability-name">{a.name}</span>
              <input
                type="number"
                min={0}
                max={30}
                value={draft.abilities[a.key]}
                onChange={(e) => setAbility(a.key, e.target.valueAsNumber)}
              />
              <span className={`mod-badge ${abilityMod(draft.abilities[a.key]) >= 0 ? 'pos' : 'neg'}`}>
                {abilityMod(draft.abilities[a.key]) >= 0 ? '+' : ''}
                {abilityMod(draft.abilities[a.key])}
              </span>
            </div>
          ))}
        </div>

        <label className="field">
          <span>Профишенси бонус (число или куб, например 2 или d4)</span>
          <input
            type="text"
            value={draft.proficiencyBonus}
            maxLength={10}
            onChange={(e) => setDraft({ ...draft, proficiencyBonus: e.target.value })}
          />
        </label>

        <div className="sheet-section-title">Спасброски (профишенси)</div>
        <div className="save-grid">
          {ABILITIES.map((a) => (
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
                {abilityMod(draft.abilities[a.key]) >= 0 ? '+' : ''}
                {abilityMod(draft.abilities[a.key])}
                {draft.saves[a.key] ? bonusPart(draft.proficiencyBonus, 1) : ''}
              </span>
            </label>
          ))}
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

        <div className="sheet-section-title">Оружие (до 3)</div>
        {draft.attacks.map((weapon, i) => (
          <div className="weapon-block" key={i}>
            <label className="field">
              <span>Оружие {i + 1}: название</span>
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
          </div>
        ))}

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
