import { useEffect, useState } from 'react';
import {
  automationForSpell,
  crValue,
  familiarFormAvailable,
  hasInvocation,
  INVOCATION_PACT_KEYS,
  invocationAtWillSelfOnly,
  invocationAtWillSpells,
  invocationCoversSpell,
  spellActionCost,
  spellAreaOrigin,
  spellAutomated,
  spellRangeFeet,
  type ActionCost,
  type Spell,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { spellDisplayName } from '../i18n/names';
import { tokenById } from '../store/selectors';
import { actionCostText, castLevelsForSpell, featFreeCastKeys, spellCastInfo, type CasterInfo } from '../lib/actionRules';
import { t } from '../i18n';
import SpellIcon from './SpellIcon';

interface Props {
  spell: Spell;
  tokenId: string;
  onClose: () => void;
  /** Легендарная способность-заклинание: применение через `action:use`, без ячейки. */
  abilityAction?: { id: string; slot: ActionCost };
}

/** Поповер накладывания заклинания: круг (апкаст), цель, преимущество. */
export default function SpellPopover({ spell, tokenId, onClose, abilityAction }: Props) {
  const resources = useGameStore((s) => s.resources);
  const sheet = useGameStore((s) => s.sheet);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const map = useActiveMap();
  const castSpell = useGameStore((s) => s.castSpell);
  const runAction = useGameStore((s) => s.runAction);
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
    atWillKeys: sheetCaster && sheet ? new Set(invocationAtWillSpells(sheet)) : undefined,
  };
  const [level, setLevel] = useState(() => castLevelsForSpell(spell, casterInfo)[0] ?? spell.level);
  const info = spellCastInfo(spell, level, {
    ...casterInfo,
    classes: sheet?.classes ?? null,
  });

  const mode: 'a' | 'd' | undefined = adv && !dis ? 'a' : dis && !adv ? 'd' : undefined;

  const summonDef = (() => {
    const def = automationForSpell(spell, { castLevel: info.slotLevel ?? level });
    return def.resolution === 'summon' ? def.summon : undefined;
  })();
  const needForm = !!summonDef?.choices && !summonDef.creature;
  // Polymorph: форма-зверь выбирается в попапе, цель — кликом по токену.
  const shapeDef = (() => {
    const def = automationForSpell(spell, { castLevel: info.slotLevel ?? level });
    return def.shape;
  })();
  const needBeast = !!shapeDef;
  // At-will инвокация «на себя» (Armor of Shadows): цель не выбирается.
  const selfOnlyAtWill =
    !!sheet && sheetCaster && invocationCoversSpell(sheet, spell.key) && invocationAtWillSelfOnly(spell.key);
  const pactChain = hasInvocation(sheet ?? {}, INVOCATION_PACT_KEYS.chain);
  const [form, setForm] = useState('');
  const [forms, setForms] = useState<{ key: string; name: string }[] | null>(null);
  const [showCr0, setShowCr0] = useState(false);
  useEffect(() => {
    if (!needForm && !needBeast) return;
    let alive = true;
    import('shared/bestiaryData')
      .then((mod) => {
        if (!alive) return;
        const list = needForm
          ? mod.default.entries.filter((entry) => familiarFormAvailable(entry.key, entry.familiar, pactChain))
          : mod.default.entries
              .filter((entry) => entry.type === 'beast')
              .filter((entry) => showCr0 || crValue(entry.cr) > 0);
        setForms(list.map((entry) => ({ key: entry.key, name: `${entry.name} (CR ${entry.cr})` })));
      })
      .catch(() => void 0);
    return () => {
      alive = false;
    };
  }, [needForm, needBeast, pactChain, showCr0]);

  const submit = () => {
    if (!abilityAction && !info.canCast) return;
    const common = abilityAction
      ? { actionId: abilityAction.id, slot: abilityAction.slot }
      : { spellKey: spell.key, slotLevel: info.slotLevel };
    if (info.area && spell.areaSpec) {
      startAim({
        tokenId,
        ...common,
        advantage: mode,
        spec: spell.areaSpec,
        originKind: spellAreaOrigin(spell),
        rangeFeet: spellRangeFeet(spell),
      });
    } else if (info.multi) {
      startMultiTarget({
        tokenId,
        ...common,
        advantage: mode,
        count: info.multiCount,
        distinct: info.multiKind === 'targets',
      });
    } else if (info.self || selfOnlyAtWill) {
      if (abilityAction) runAction(tokenId, abilityAction.id, { slot: abilityAction.slot });
      else
        castSpell({
          tokenId,
          spellKey: spell.key,
          slotLevel: info.slotLevel,
          advantage: mode,
          ...(selfOnlyAtWill && !info.self ? { targetIds: [tokenId] } : {}),
        });
    } else if (summonDef) {
      if (needForm && !form) return;
      startAim({
        tokenId,
        ...common,
        advantage: mode,
        spec: { shape: 'sphere', size: 0 },
        originKind: 'point',
        rangeFeet: spellRangeFeet(spell),
        summon: true,
        ...(needForm && form ? { summonKey: form } : {}),
      });
    } else if (shapeDef) {
      if (needBeast && !form) return;
      startTargeting({
        kind: 'spell',
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
        label: spellDisplayName(spell),
        ...(form ? { summonKey: form } : {}),
      });
    } else if (abilityAction) {
      startTargeting({
        kind: 'action',
        tokenId,
        actionId: abilityAction.id,
        slot: abilityAction.slot,
        label: spellDisplayName(spell),
      });
    } else {
      startTargeting({
        kind: 'spell',
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
        label: spellDisplayName(spell),
      });
    }
    onClose();
  };

  return (
    <>
      <div className="spell-popover-backdrop" onMouseDown={onClose} />
      <div className="spell-popover" role="dialog" aria-label={spellDisplayName(spell)}>
        <div className="sp-head">
          <SpellIcon spell={spell} className="sp-icon" />
          <div className="sp-head-text">
            <div className="sp-name">{spellDisplayName(spell)}</div>
            <div className="sp-meta">
              {info.isCantrip ? t('ui.spellPopover.cantrip') : t('ui.spellPopover.level', { n: spell.level })} ·{' '}
              {actionCostText(abilityAction ? abilityAction.slot : spellActionCost(spell))}
            </div>
          </div>
          <button className="sp-close" aria-label={t('ui.common.close')} onClick={onClose}>
            ×
          </button>
        </div>

        {!abilityAction && info.levels.length > 1 && (
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

        {!abilityAction && !info.canCast && <div className="sp-warn">{t('ui.spellPopover.noSlot')}</div>}

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
        ) : summonDef ? (
          <div className="sp-row">
            <span className="sp-label">{t('ui.spellPopover.summon')}</span>
            <span className="sp-target">{t('ui.spellPopover.clickPoint')}</span>
          </div>
        ) : (
          <div className="sp-row">
            <span className="sp-label">{t('ui.spellPopover.target')}</span>
            <span className="sp-target">
              {info.self || selfOnlyAtWill ? t('ui.spellPopover.self') : t('ui.spellPopover.clickTarget')}
            </span>
          </div>
        )}

        {(needForm || needBeast) && (
          <div className="sp-row">
            <span className="sp-label">
              {needForm ? t('ui.spellPopover.summonForm') : t('ui.spellPopover.beastForm')}
            </span>
            <select className="sp-select" value={form} onChange={(e) => setForm(e.target.value)}>
              <option value="">{t('ui.spellPopover.summonFormPick')}</option>
              {(forms ?? []).map((f) => (
                <option key={f.key} value={f.key}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {needBeast && (
          <label className="adv-check">
            <input type="checkbox" checked={showCr0} onChange={(e) => setShowCr0(e.target.checked)} />
            {t('ui.shape.showCr0')}
          </label>
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
          <button
            className="sp-cast"
            disabled={(!abilityAction && !info.canCast) || ((needForm || needBeast) && !form)}
            onClick={submit}
          >
            {info.area
              ? t('ui.spellPopover.chooseArea')
              : info.multi
                ? t('ui.spellPopover.chooseTargets')
                : summonDef
                  ? t('ui.spellPopover.choosePoint')
                  : info.self
                    ? t('ui.common.apply')
                    : t('ui.spellPopover.chooseTarget')}
          </button>
        </div>
      </div>
    </>
  );
}
