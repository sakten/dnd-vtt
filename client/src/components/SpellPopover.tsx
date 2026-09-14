import { useState } from 'react';
import {
  characterLevel,
  isHealingSpell,
  maxCastableLevel,
  spellActionCost,
  spellAreaOrigin,
  spellAttackCount,
  spellDamageExpression,
  spellAutomated,
  spellEffectDefs,
  spellHasArea,
  spellRangeFeet,
  spellTargetKind,
  type Spell,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import SpellIcon from './SpellIcon';

interface Props {
  spell: Spell;
  tokenId: string;
  onClose: () => void;
}

const COST_TEXT: Record<string, string> = {
  action: 'Действие',
  bonus: 'Бонусное действие',
  reaction: 'Реакция',
  special: 'Особое',
};

/** Поповер накладывания заклинания: круг (апкаст), цель, преимущество. */
export default function SpellPopover({ spell, tokenId, onClose }: Props) {
  const resources = useGameStore((s) => s.resources);
  const sheet = useGameStore((s) => s.sheet);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const map = useGameStore((s) => s.scene.maps.find((m) => m.id === s.viewMapId) ?? null);
  const castSpell = useGameStore((s) => s.castSpell);
  const startAim = useGameStore((s) => s.startAim);
  const startMultiTarget = useGameStore((s) => s.startMultiTarget);
  const startTargeting = useGameStore((s) => s.startTargeting);
  const [level, setLevel] = useState(spell.level);
  const [adv, setAdv] = useState(false);
  const [dis, setDis] = useState(false);

  const isCantrip = spell.level === 0;
  const castToken = map?.tokens.find((t) => t.id === tokenId) ?? null;
  const sheetCaster = !!sheet && currentCharacterId !== null && castToken?.libraryItemId === currentCharacterId;
  const maxLevel = sheetCaster
    ? maxCastableLevel(spell, resources)
    : maxCastableLevel(spell, null, castToken?.statblock?.spellcasting?.slots);
  const canCast = isCantrip || maxLevel >= spell.level;
  const area = spellHasArea(spell);
  const self = spellTargetKind(spell) === 'self';
  const projectiles = spellAttackCount(spell, level, sheet ? characterLevel(sheet.classes) : 1);
  const effectTargetCount =
    spellEffectDefs(spell.key)?.reduce((max, d) => Math.max(max, d.to === 'targets' ? d.targets ?? 1 : 0), 0) ?? 0;
  const multi = !area && (projectiles > 1 || effectTargetCount > 1);
  const multiCount = effectTargetCount > 1 ? effectTargetCount : projectiles;
  const attacky = !!spell.spellAttack || !!spell.save;
  const expression = spellDamageExpression(spell, level, sheet ? characterLevel(sheet.classes) : 1);
  const damageText =
    expression && spell.damage
      ? `${isHealingSpell(spell) ? 'Лечение' : 'Урон'}: ${expression}${
          spell.damage.types.length ? ` (${spell.damage.types.join(', ')})` : ''
        }`
      : null;

  const levels = isCantrip || !canCast ? [] : Array.from({ length: maxLevel - spell.level + 1 }, (_, i) => spell.level + i);

  const mode: 'a' | 'd' | undefined = adv && !dis ? 'a' : dis && !adv ? 'd' : undefined;

  const submit = () => {
    if (!canCast) return;
    if (area && spell.areaSpec) {
      startAim({
        tokenId,
        spellKey: spell.key,
        slotLevel: isCantrip ? undefined : level,
        advantage: mode,
        spec: spell.areaSpec,
        originKind: spellAreaOrigin(spell),
        rangeFeet: spellRangeFeet(spell),
      });
    } else if (multi) {
      startMultiTarget({
        tokenId,
        spellKey: spell.key,
        slotLevel: isCantrip ? undefined : level,
        advantage: mode,
        count: multiCount,
      });
    } else if (self) {
      castSpell({
        tokenId,
        spellKey: spell.key,
        slotLevel: isCantrip ? undefined : level,
        advantage: mode,
      });
    } else {
      startTargeting({
        kind: 'spell',
        tokenId,
        spellKey: spell.key,
        slotLevel: isCantrip ? undefined : level,
        advantage: mode,
        label: spell.name,
      });
    }
    onClose();
  };

  return (
    <>
      <div className="spell-popover-backdrop" onMouseDown={onClose} />
      <div className="spell-popover" role="dialog" aria-label={spell.name}>
        <div className="sp-head">
          <SpellIcon spell={spell} className="sp-icon" />
          <div className="sp-head-text">
            <div className="sp-name">{spell.name}</div>
            <div className="sp-meta">
              {isCantrip ? 'Фокус' : `${spell.level} круг`} · {COST_TEXT[spellActionCost(spell)] ?? 'Особое'}
            </div>
          </div>
          <button className="sp-close" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </div>

        {levels.length > 1 && (
          <div className="sp-row">
            <span className="sp-label">Круг ячейки</span>
            <div className="sp-levels">
              {levels.map((l) => (
                <button
                  key={l}
                  className={`sp-level${l === level ? ' on' : ''}`}
                  onClick={() => setLevel(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {!canCast && <div className="sp-warn">Нет ячейки доступного круга</div>}

        {area ? (
          <div className="sp-row">
            <span className="sp-label">Область</span>
            <span className="sp-target">
              {spell.areaSpec?.shape === 'cone'
                ? 'конус'
                : spell.areaSpec?.shape === 'line'
                  ? 'линия'
                  : spell.areaSpec?.shape === 'cube'
                    ? 'куб'
                    : 'сфера'}{' '}
              {spell.areaSpec?.size} фт · выбор на карте
            </span>
          </div>
        ) : multi ? (
          <div className="sp-row">
            <span className="sp-label">{effectTargetCount > 1 ? 'Цели' : 'Снаряды'}</span>
            <span className="sp-target">
              {effectTargetCount > 1
                ? `до ${effectTargetCount} · выбор на карте`
                : `${projectiles} шт. · цель для каждого на карте`}
            </span>
          </div>
        ) : (
          <div className="sp-row">
            <span className="sp-label">Цель</span>
            <span className="sp-target">{self ? 'На себя' : 'клик по цели на карте'}</span>
          </div>
        )}

        {damageText && <div className="sp-damage">{damageText}</div>}

        {!spellAutomated(spell) && (
          <div className="sp-note">Эффект не автоматизирован: в чат уйдёт название и описание, механику ведёт мастер</div>
        )}

        {attacky && spell.spellAttack && (
          <div className="sp-row">
            <div className="sp-adv">
              <label className="adv-check">
                <input
                  type="checkbox"
                  checked={adv}
                  onChange={(e) => {
                    setAdv(e.target.checked);
                    if (e.target.checked) setDis(false);
                  }}
                />
                Adv
              </label>
              <label className="adv-check">
                <input
                  type="checkbox"
                  checked={dis}
                  onChange={(e) => {
                    setDis(e.target.checked);
                    if (e.target.checked) setAdv(false);
                  }}
                />
                Dis
              </label>
            </div>
          </div>
        )}

        <div className="sp-actions">
          <button className="sp-cancel" onClick={onClose}>
            Отмена
          </button>
          <button className="sp-cast" disabled={!canCast} onClick={submit}>
            {area ? 'Выбрать область' : multi ? 'Выбрать цели' : self ? 'Применить' : 'Выбрать цель'}
          </button>
        </div>
      </div>
    </>
  );
}
