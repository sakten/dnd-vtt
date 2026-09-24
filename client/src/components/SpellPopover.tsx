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
  spellCastAreaOverride,
  spellRangeFeet,
  spellVariantDef,
  type AbilityKey,
  type ActionCost,
  type Spell,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { spellDisplayName } from '../i18n/names';
import { abilityName, damageLabel, skillName } from '../i18n/domain';
import { tokenById } from '../store/selectors';
import { actionCostText, castLevelsForSpell, featFreeCastKeys, spellCastInfo, type CasterInfo } from '../lib/actionRules';
import { t, type MessageKey } from '../i18n';
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
  const startScatter = useGameStore((s) => s.startScatter);
  const [adv, setAdv] = useState(false);
  const [dis, setDis] = useState(false);

  const castToken = tokenById(map, tokenId);
  const selectedTokenId = useGameStore((s) => s.selectedTokenId);
  const selectedTarget =
    selectedTokenId && selectedTokenId !== tokenId ? tokenById(map, selectedTokenId) : null;
  // CR цели-монстра известен заранее: список Polymorph сразу ограничиваем её лимитом.
  const maxTargetCr = selectedTarget?.statblock?.cr ? crValue(selectedTarget.statblock.cr) : undefined;
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
  // Misty Step и подобные: режим точки — выбор клетки телепорта в пределах дистанции.
  const teleportDef = (() => {
    const def = automationForSpell(spell, { castLevel: info.slotLevel ?? level });
    return def.utility?.kind === 'teleport' ? def.utility : undefined;
  })();
  // Scatter: до N целей, затем точка назначения на каждую.
  const scatterDef = (() => {
    const def = automationForSpell(spell, { castLevel: info.slotLevel ?? level });
    return def.utility?.kind === 'scatter' ? def.utility : undefined;
  })();
  // Self-заклинание, выбирающее цель-существо (Eyebite): вместо каста «в себя» — клик по цели.
  const targetCreatureDef = (() => {
    const def = automationForSpell(spell, { castLevel: info.slotLevel ?? level });
    return def.targeting?.kind === 'creature' ? def : undefined;
  })();
  // Polymorph: форма-зверь выбирается в попапе, цель — кликом по токену.
  const shapeDef = (() => {
    const def = automationForSpell(spell, { castLevel: info.slotLevel ?? level });
    return def.shape;
  })();
  const needBeast = !!shapeDef;
  // Lesser/Greater Restoration: допустимые к снятию состояния; выбор — после клика по цели.
  const endConditionDef = (() => {
    const def = automationForSpell(spell, { castLevel: info.slotLevel ?? level });
    return def.utility?.kind === 'endCondition' ? def.endConditions : undefined;
  })();
  // Вариант каста (Dragon's Breath: тип урона); значение по умолчанию — первый вариант.
  const variantDef = spellVariantDef(spell.key);
  // At-will инвокация «на себя» (Armor of Shadows): цель не выбирается.
  const selfOnlyAtWill =
    !!sheet && sheetCaster && invocationCoversSpell(sheet, spell.key) && invocationAtWillSelfOnly(spell.key);
  const pactChain = hasInvocation(sheet ?? {}, INVOCATION_PACT_KEYS.chain);
  // Зона заклинания (Moonbeam/Flaming Sphere/Faithful Hound): своя геометрия для прицела.
  const zoneDef = automationForSpell(spell, { castLevel: info.slotLevel ?? level }).zone;
  const [form, setForm] = useState('');
  const [forms, setForms] = useState<{ key: string; name: string }[] | null>(null);
  const [showCr0, setShowCr0] = useState(false);
  const [variant, setVariant] = useState(() => variantDef?.options[0] ?? '');
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
              .filter((entry) => maxTargetCr === undefined || crValue(entry.cr) <= maxTargetCr)
              .filter((entry) => showCr0 || crValue(entry.cr) > 0);
        setForms(list.map((entry) => ({ key: entry.key, name: `${entry.name} (CR ${entry.cr})` })));
      })
      .catch(() => void 0);
    return () => {
      alive = false;
    };
  }, [needForm, needBeast, pactChain, showCr0, maxTargetCr]);

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
        spec: spellCastAreaOverride(spell) ?? zoneDef?.area ?? spell.areaSpec,
        originKind: spellAreaOrigin(spell),
        rangeFeet: spellRangeFeet(spell),
        ...(variant ? { variant } : {}),
      });
    } else if (info.multi) {
      startMultiTarget({
        tokenId,
        ...common,
        advantage: mode,
        count: info.multiCount,
        distinct: info.multiKind === 'targets',
        ...(variant ? { variant } : {}),
      });
    } else if (info.autoTargets) {
      // Цели собирает сервер по радиусу (Beacon of Hope): клик по цели не нужен.
      castSpell({
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
        ...(variant ? { variant } : {}),
      });
    } else if (teleportDef) {
      startAim({
        tokenId,
        ...common,
        advantage: mode,
        spec: { shape: 'sphere', size: 0 },
        originKind: 'point',
        rangeFeet: teleportDef.amount ?? 30,
        summon: true,
      });
    } else if (scatterDef) {
      startScatter({
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
        maxTargets: scatterDef.targets ?? 5,
      });
    } else if (info.self && targetCreatureDef) {
      startTargeting({
        kind: 'spell',
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
        label: spellDisplayName(spell),
        ...(variant ? { variant } : {}),
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
    } else if (zoneDef && zoneDef.origin === 'point') {
      // Зона от точки без режима области (Faithful Hound): прицел от кастера, радиус — зона.
      startAim({
        tokenId,
        ...common,
        advantage: mode,
        spec: zoneDef.area,
        originKind: 'point',
        rangeFeet: spellRangeFeet(spell),
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
        ...(variant ? { variant } : {}),
        ...(endConditionDef ? { endConditionKeys: endConditionDef } : {}),
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
              {info.autoTargets
                ? t('ui.spellPopover.alliesAround')
                : info.self || selfOnlyAtWill
                  ? t('ui.spellPopover.self')
                  : t('ui.spellPopover.clickTarget')}
            </span>
          </div>
        )}

        {variantDef && (
          <div className="sp-row">
            <span className="sp-label">
              {variantDef.param === 'ability'
                ? t('ui.spellPopover.abilityChoice')
                : variantDef.param === 'effect'
                  ? t('ui.spellPopover.effectChoice')
                  : variantDef.param === 'skill'
                    ? t('ui.spellPopover.skillChoice')
                    : variantDef.param === 'command'
                      ? t('ui.spellPopover.commandChoice')
                      : t('ui.spellPopover.damageType')}
            </span>
            <select className="sp-select" value={variant} onChange={(e) => setVariant(e.target.value)}>
              {variantDef.options.map((option) => (
                <option key={option} value={option}>
                  {variantDef.param === 'ability'
                    ? abilityName(option as AbilityKey)
                    : variantDef.param === 'effect'
                      ? t(`ui.eyebite.${option}` as MessageKey)
                      : variantDef.param === 'skill'
                        ? skillName(option)
                        : variantDef.param === 'command'
                          ? t(`ui.command.${option}` as MessageKey)
                          : option === 'weapon'
                            ? t('ui.spellPopover.weaponDamage')
                            : damageLabel(option)}
                </option>
              ))}
            </select>
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
                : info.autoTargets
                  ? t('ui.common.apply')
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
