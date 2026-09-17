import { useState } from 'react';
import { spellActionCost, spellAreaOrigin, spellAutomated, spellRangeFeet, type Spell } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { tokenById } from '../store/selectors';
import { actionCostText, castLevelsForSpell, featFreeCastKeys, spellCastInfo, type CasterInfo } from '../lib/actionRules';
import { t } from '../i18n';
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
  const [adv, setAdv] = useState(false);
  const [dis, setDis] = useState(false);

  const castToken = tokenById(map, tokenId);
  const sheetCaster = !!sheet && currentCharacterId !== null && castToken?.libraryItemId === currentCharacterId;
  const casterInfo: CasterInfo = {
    isCharacter: sheetCaster,
    resources,
    token: castToken ?? undefined,
    freeCastKeys: sheetCaster ? featFreeCastKeys(sheet, resources) : undefined,
  };
  const [level, setLevel] = useState(() => castLevelsForSpell(spell, casterInfo)[0] ?? spell.level);
  const info = spellCastInfo(spell, level, {
    ...casterInfo,
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
        distinct: info.multiKind === 'targets',
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
              {info.isCantrip ? t('ui.spellPopover.cantrip') : t('ui.spellPopover.level', { n: spell.level })} ·{' '}
              {actionCostText(spellActionCost(spell))}
            </div>
          </div>
          <button className="sp-close" aria-label={t('ui.common.close')} onClick={onClose}>
            ×
          </button>
        </div>

        {info.levels.length > 1 && (
          <div className="sp-row">
            <span className="sp-label">{t('ui.spellPopover.slotLevel')}</span>
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

        {!info.canCast && <div className="sp-warn">{t('ui.spellPopover.noSlot')}</div>}

        {info.area ? (
          <div className="sp-row">
            <span className="sp-label">{t('ui.spellPopover.area')}</span>
            <span className="sp-target">
              {t('ui.spellPopover.areaInfo', {
                shape:
                  spell.areaSpec?.shape === 'cone'
                    ? t('ui.spellPopover.shape.cone')
                    : spell.areaSpec?.shape === 'line'
                      ? t('ui.spellPopover.shape.line')
                      : spell.areaSpec?.shape === 'cube'
                        ? t('ui.spellPopover.shape.cube')
                        : t('ui.spellPopover.shape.sphere'),
                size: spell.areaSpec?.size ?? 0,
              })}
            </span>
          </div>
        ) : info.multi ? (
          <div className="sp-row">
            <span className="sp-label">
              {info.multiKind === 'targets' ? t('ui.common.targets') : t('ui.common.projectiles')}
            </span>
            <span className="sp-target">
              {info.multiKind === 'targets'
                ? t('ui.spellPopover.targetsInfo', { n: info.effectTargetCount })
                : t('ui.spellPopover.projectilesInfo', { n: info.projectiles })}
            </span>
          </div>
        ) : (
          <div className="sp-row">
            <span className="sp-label">{t('ui.spellPopover.target')}</span>
            <span className="sp-target">
              {info.self ? t('ui.spellPopover.self') : t('ui.spellPopover.clickTarget')}
            </span>
          </div>
        )}

        {info.damageText && <div className="sp-damage">{info.damageText}</div>}

        {!spellAutomated(spell) && (
          <div className="sp-note">{t('ui.spellPopover.manualNote')}</div>
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
            {t('ui.common.cancel')}
          </button>
          <button className="sp-cast" disabled={!info.canCast} onClick={submit}>
            {info.area
              ? t('ui.spellPopover.chooseArea')
              : info.multi
                ? t('ui.spellPopover.chooseTargets')
                : info.self
                  ? t('ui.common.apply')
                  : t('ui.spellPopover.chooseTarget')}
          </button>
        </div>
      </div>
    </>
  );
}
