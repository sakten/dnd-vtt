import { useState } from 'react';
import { spellActionCost, spellAreaOrigin, spellAutomated, spellRangeFeet, type Spell } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { tokenById } from '../store/selectors';
import { ACTION_COST_TEXT, spellCastInfo } from '../lib/actionRules';
import SpellIcon from './SpellIcon';

interface Props {
  spell: Spell;
  tokenId: string;
  onClose: () => void;
}

/** Поповер накладывания заклинания: круг (апкаст), цель, преимущество. */
export default function SpellPopover({ spell, tokenId, onClose }: Props) {
  const resources = useGameStore((s) => s.resources);
  const sheet = useGameStore((s) => s.sheet);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const map = useActiveMap();
  const castSpell = useGameStore((s) => s.castSpell);
  const startAim = useGameStore((s) => s.startAim);
  const startMultiTarget = useGameStore((s) => s.startMultiTarget);
  const startTargeting = useGameStore((s) => s.startTargeting);
  const [level, setLevel] = useState(spell.level);
  const [adv, setAdv] = useState(false);
  const [dis, setDis] = useState(false);

  const castToken = tokenById(map, tokenId);
  const sheetCaster = !!sheet && currentCharacterId !== null && castToken?.libraryItemId === currentCharacterId;
  const info = spellCastInfo(spell, level, {
    isCharacter: sheetCaster,
    resources,
    token: castToken ?? undefined,
    classes: sheet?.classes ?? null,
  });

  const mode: 'a' | 'd' | undefined = adv && !dis ? 'a' : dis && !adv ? 'd' : undefined;

  const submit = () => {
    if (!info.canCast) return;
    if (info.area && spell.areaSpec) {
      startAim({
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
        spec: spell.areaSpec,
        originKind: spellAreaOrigin(spell),
        rangeFeet: spellRangeFeet(spell),
      });
    } else if (info.multi) {
      startMultiTarget({
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
        count: info.multiCount,
      });
    } else if (info.self) {
      castSpell({
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
      });
    } else {
      startTargeting({
        kind: 'spell',
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
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
              {info.isCantrip ? 'Фокус' : `${spell.level} круг`} · {ACTION_COST_TEXT[spellActionCost(spell)]}
            </div>
          </div>
          <button className="sp-close" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </div>

        {info.levels.length > 1 && (
          <div className="sp-row">
            <span className="sp-label">Круг ячейки</span>
            <div className="sp-levels">
              {info.levels.map((l) => (
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

        {!info.canCast && <div className="sp-warn">Нет ячейки доступного круга</div>}

        {info.area ? (
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
        ) : info.multi ? (
          <div className="sp-row">
            <span className="sp-label">{info.effectTargetCount > 1 ? 'Цели' : 'Снаряды'}</span>
            <span className="sp-target">
              {info.effectTargetCount > 1
                ? `до ${info.effectTargetCount} · выбор на карте`
                : `${info.projectiles} шт. · цель для каждого на карте`}
            </span>
          </div>
        ) : (
          <div className="sp-row">
            <span className="sp-label">Цель</span>
            <span className="sp-target">{info.self ? 'На себя' : 'клик по цели на карте'}</span>
          </div>
        )}

        {info.damageText && <div className="sp-damage">{info.damageText}</div>}

        {!spellAutomated(spell) && (
          <div className="sp-note">Эффект не автоматизирован: в чат уйдёт название и описание, механику ведёт мастер</div>
        )}

        {info.attacky && spell.spellAttack && (
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
          <button className="sp-cast" disabled={!info.canCast} onClick={submit}>
            {info.area ? 'Выбрать область' : info.multi ? 'Выбрать цели' : info.self ? 'Применить' : 'Выбрать цель'}
          </button>
        </div>
      </div>
    </>
  );
}
