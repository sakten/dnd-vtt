import { useEffect, useState } from 'react';
import {
  abilityMod,
  automationForSpell,
  CAREFUL_SPELL_KEY,
  CAT_SPRING_KEY,
  CONDITION_KEYS,
  crValue,
  familiarFormAvailable,
  hasInvocation,
  HEIGHTENED_SPELL_KEY,
  INVOCATION_PACT_KEYS,
  invocationAtWillSelfOnly,
  invocationAtWillSpells,
  invocationActionCast,
  invocationCoversSpell,
  knownMetamagic,
  metamagicDef,
  metamagicRangeFeet,
  SEEKING_SPELL_KEY,
  spellActionCost,
  spellAreaOrigin,
  spellAutomated,
  spellByDesign,
  spellCastAreaOverride,
  spellVariantDef,
  TRANSMUTABLE_DAMAGE_TYPES,
  TRANSMUTED_SPELL_KEY,
  TWINNED_SPELL_KEY,
  isThinWallSpell,
  wallArea,
  wallMaxPanels,
  type AbilityKey,
  type ActionCost,
  type Spell,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { spellDisplayName } from '../i18n/names';
import { abilityName, conditionLabel, damageLabel, skillName } from '../i18n/domain';
import { tokenById } from '../store/selectors';
import { actionCostText, castLevelsForSpell, featFreeCastKeys, spellCastInfo, type CasterInfo } from '../lib/actionRules';
import { getLocale, t, type MessageKey } from '../i18n';
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
  const [metamagicKey, setMetamagicKey] = useState('');
  const [transmuteType, setTransmuteType] = useState('fire');
  const [seeking, setSeeking] = useState(false);
  const [carefulIds, setCarefulIds] = useState<string[]>([]);

  const castToken = tokenById(map, tokenId);
  const selectedTokenId = useGameStore((s) => s.selectedTokenId);
  const selectedTarget =
    selectedTokenId && selectedTokenId !== tokenId ? tokenById(map, selectedTokenId) : null;
  // CR цели-монстра известен заранее: список Polymorph сразу ограничиваем её лимитом.
  const maxTargetCr = selectedTarget?.statblock?.cr ? crValue(selectedTarget.statblock.cr) : undefined;
  const sheetCaster = !!sheet && currentCharacterId !== null && castToken?.libraryItemId === currentCharacterId;
  const knownMetamagicKeys = sheetCaster && sheet ? knownMetamagic(sheet.choices) : [];
  const metamagicPayload =
    metamagicKey || seeking
      ? {
          metamagic: {
            key: metamagicKey || SEEKING_SPELL_KEY,
            ...(metamagicKey === TRANSMUTED_SPELL_KEY ? { damageType: transmuteType } : {}),
            ...(seeking ? { seeking: true } : {}),
            ...(metamagicKey === CAREFUL_SPELL_KEY ? { careful: carefulIds } : {}),
          },
        }
      : {};
  const pickMetamagic = (key: string) => {
    setMetamagicKey(key);
    if (key === TRANSMUTED_SPELL_KEY) {
      const current = spell.damage?.types ?? [];
      setTransmuteType(TRANSMUTABLE_DAMAGE_TYPES.find((type) => !current.includes(type)) ?? 'fire');
    }
  };
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
  const carefulLimit = sheetCaster && sheet ? Math.max(1, abilityMod(sheet.abilities.cha ?? 10)) : 1;
  const carefulCandidates = (map?.tokens ?? []).filter(
    (token) => token.id !== tokenId && !!castToken && token.faction === castToken.faction
  );
  const twinnedExtra =
    metamagicKey === TWINNED_SPELL_KEY && !!spell.upcast?.targets && spell.level > 0 ? 1 : 0;
  const twinnedMulti = twinnedExtra > 0 && !info.area && info.effectTargetCount > 0;
  const weaponCantrip = !!automationForSpell(spell, { castLevel: info.slotLevel ?? level }).weaponAttack;

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
  // Scatter/Telekinesis: цель(и), затем точка назначения; Telekinesis применяется сразу при касте.
  const scatterDef = (() => {
    const def = automationForSpell(spell, { castLevel: info.slotLevel ?? level });
    return def.utility?.kind === 'scatter' || def.utility?.kind === 'telekinesis' ? def.utility : undefined;
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
  // Steel Wind Strike: после выбора целей — прицел телепорта рядом одной из них.
  const strikeTeleport = automationForSpell(spell, { castLevel: info.slotLevel ?? level }).teleportAfter;
  const needBeast = !!shapeDef;
  // Lesser/Greater Restoration: допустимые к снятию состояния; выбор — после клика по цели.
  const endConditionDef = (() => {
    const def = automationForSpell(spell, { castLevel: info.slotLevel ?? level });
    return def.utility?.kind === 'endCondition' ? def.endConditions : undefined;
  })();
  // Dispel Magic: цель — существо или зона на карте (клик по клеткам зоны).
  const dispelDef = (() => {
    const def = automationForSpell(spell, { castLevel: info.slotLevel ?? level });
    return def.utility?.kind === 'dispel';
  })();
  // Вариант каста (Dragon's Breath: тип урона); значение по умолчанию — первый вариант.
  const variantDef = spellVariantDef(spell);
  // At-will инвокация «на себя» (Armor of Shadows): цель не выбирается.
  const selfOnlyAtWill =
    !!sheet && sheetCaster && invocationCoversSpell(sheet, spell.key) && invocationAtWillSelfOnly(spell.key);
  // Pact of the Chain: Find Familiar кастуется действием (Magic action) без ячейки.
  const invocationAction = !!sheetCaster && !!sheet && invocationActionCast(sheet, spell.key);
  const pactChain = hasInvocation(sheet ?? {}, INVOCATION_PACT_KEYS.chain);
  // Зона заклинания (Moonbeam/Flaming Sphere/Faithful Hound): своя геометрия для прицела.
  const zoneDef = automationForSpell(spell, { castLevel: info.slotLevel ?? level }).zone;
  const [form, setForm] = useState('');
  const [forms, setForms] = useState<{ key: string; name: string }[] | null>(null);
  const [showCr0, setShowCr0] = useState(false);
  const [variant, setVariant] = useState(() => variantDef?.options[0] ?? '');
  // Геометрия каста: стена (вариант формы) / оверрайд (Call Lightning) / зона / данные.
  const castArea = wallArea(spell.key, variant) ?? spellCastAreaOverride(spell) ?? zoneDef?.area ?? spell.areaSpec;
  useEffect(() => {
    if (!needForm && !needBeast) return;
    let alive = true;
    import('shared/bestiaryData')
      .then((mod) => {
        if (!alive) return;
        const list = needForm
          ? mod.default.entries.filter((entry) => familiarFormAvailable(entry, pactChain))
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
    // Тонкая стена цепочкой (Wall of Ice, вариант «wall»): пошаговая постановка секций.
    const chainWall = isThinWallSpell(spell.key) && variant !== 'ring';
    // Cat's Spring (CBT): сначала цель, затем клетка прыжка; точка и цель — в placements.
    if (spell.key === CAT_SPRING_KEY && !abilityAction) {
      startScatter({
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
        maxTargets: 1,
        kind: 'catSpring',
        destFeet: 10,
        ...(variant ? { variant } : {}),
      });
      return;
    }
    if (info.area && castArea) {
      startAim({
        tokenId,
        ...common,
        advantage: mode,
        spec: castArea,
        originKind: spellAreaOrigin(spell),
        rangeFeet: metamagicRangeFeet(spell, undefined, metamagicKey || undefined),
        ...(variant ? { variant } : {}),
        ...metamagicPayload,
        ...(chainWall
          ? { chain: true, wallMax: wallMaxPanels(spell.key) }
          : {}),
      });
    } else if (info.multi || twinnedMulti) {
      startMultiTarget({
        tokenId,
        ...common,
        advantage: mode,
        count: info.multiCount + twinnedExtra,
        distinct: info.multiKind === 'targets' || twinnedMulti,
        ...(variant ? { variant } : {}),
        ...metamagicPayload,
        ...(strikeTeleport
          ? { thenAim: { rangeFeet: null, feet: strikeTeleport.feet } }
          : {}),
      });
    } else if (info.autoTargets) {
      // Цели собирает сервер по радиусу (Beacon of Hope): клик по цели не нужен.
      castSpell({
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
        ...(variant ? { variant } : {}),
        ...metamagicPayload,
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
        ...(teleportDef.passenger ? { passenger: teleportDef.passenger } : {}),
        ...(teleportDef.ignoreSight ? { ignoreSight: true } : {}),
        ...metamagicPayload,
      });
    } else if (scatterDef) {
      const telekinesis = scatterDef.kind === 'telekinesis';
      startScatter({
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
        maxTargets: telekinesis ? 1 : scatterDef.targets ?? 5,
        ...(telekinesis ? { kind: 'telekinesis', destFeet: scatterDef.amount ?? 30 } : {}),
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
        ...metamagicPayload,
      });
    } else if (info.self || selfOnlyAtWill) {
      if (abilityAction) runAction(tokenId, abilityAction.id, { slot: abilityAction.slot });
      else
        castSpell({
          tokenId,
          spellKey: spell.key,
          slotLevel: info.slotLevel,
          advantage: mode,
          ...(variant ? { variant } : {}),
          ...(selfOnlyAtWill && !info.self ? { targetIds: [tokenId] } : {}),
          ...metamagicPayload,
        });
    } else if (summonDef) {
      if (needForm && !form) return;
      startAim({
        tokenId,
        ...common,
        advantage: mode,
        spec: { shape: 'sphere', size: 0 },
        originKind: 'point',
        rangeFeet: metamagicRangeFeet(spell, undefined, metamagicKey || undefined),
        summon: true,
        ...(needForm && form ? { summonKey: form } : {}),
        ...metamagicPayload,
      });
    } else if (zoneDef && zoneDef.origin === 'self') {
      // Зона «в своей клетке» без прицела (Cordon of Arrows): каст сразу.
      castSpell({
        tokenId,
        spellKey: spell.key,
        slotLevel: info.slotLevel,
        advantage: mode,
        ...(variant ? { variant } : {}),
        ...metamagicPayload,
      });
    } else if (zoneDef && zoneDef.origin === 'point') {
      // Зона от точки без режима области (Faithful Hound): прицел от кастера, радиус — зона.
      startAim({
        tokenId,
        ...common,
        advantage: mode,
        spec: zoneDef.area,
        originKind: 'point',
        rangeFeet: metamagicRangeFeet(spell, undefined, metamagicKey || undefined),
        ...(variant ? { variant } : {}),
        ...metamagicPayload,
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
        ...metamagicPayload,
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
        ...(dispelDef ? { zones: true } : {}),
        ...metamagicPayload,
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
              {actionCostText(abilityAction ? abilityAction.slot : invocationAction ? 'action' : spellActionCost(spell))}
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
                  castArea?.shape === 'cone'
                    ? t('ui.spellPopover.shape.cone')
                    : castArea?.shape === 'line'
                      ? t('ui.spellPopover.shape.line')
                      : castArea?.shape === 'cube'
                        ? t('ui.spellPopover.shape.cube')
                        : t('ui.spellPopover.shape.sphere'),
                size: castArea?.size ?? 0,
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
                      ? (CONDITION_KEYS as string[]).includes(option)
                        ? conditionLabel(option)
                        : t(`ui.spellVariant.${option}` as MessageKey)
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

        {!abilityAction && knownMetamagicKeys.length > 0 && (
          <div className="sp-row">
            <span className="sp-label">{t('ui.spellPopover.metamagic')}</span>
            <select
              className="sp-select"
              value={metamagicKey}
              onChange={(e) => pickMetamagic(e.target.value)}
            >
              <option value="">{t('ui.spellPopover.metamagicNone')}</option>
              {knownMetamagicKeys
                .filter((key) => key !== SEEKING_SPELL_KEY)
                .map((key) => {
                  const def = metamagicDef(key);
                  if (!def) return null;
                  const name = getLocale() === 'en' ? def.nameEn : def.name;
                  return (
                    <option key={key} value={key}>
                      {name}
                      {` · ${t('ui.metamagic.cost', { n: def.cost })}`}
                      {!def.automated ? ` ${t('ui.spellPopover.metamagicManual')}` : ''}
                    </option>
                  );
                })}
            </select>
          </div>
        )}

        {!abilityAction &&
          knownMetamagicKeys.includes(SEEKING_SPELL_KEY) &&
          !weaponCantrip &&
          info.attacky &&
          spell.spellAttack && (
            <label className="adv-check">
              <input type="checkbox" checked={seeking} onChange={(e) => setSeeking(e.target.checked)} />
              {t('ui.spellPopover.seekingSpell')}
            </label>
          )}

        {metamagicKey === TRANSMUTED_SPELL_KEY && (
          <div className="sp-row">
            <span className="sp-label">{t('ui.spellPopover.damageType')}</span>
            <select
              className="sp-select"
              value={transmuteType}
              onChange={(e) => setTransmuteType(e.target.value)}
            >
              {TRANSMUTABLE_DAMAGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {damageLabel(type)}
                </option>
              ))}
            </select>
          </div>
        )}

        {metamagicKey === CAREFUL_SPELL_KEY && carefulCandidates.length > 0 && (
          <div className="sp-row">
            <span className="sp-label">{t('ui.spellPopover.carefulSpell')}</span>
            <div className="sp-metamagic-list">
              {carefulCandidates.map((token) => {
                const checked = carefulIds.includes(token.id);
                return (
                  <label className="adv-check" key={token.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && carefulIds.length >= carefulLimit}
                      onChange={(e) =>
                        setCarefulIds((ids) =>
                          e.target.checked ? [...ids, token.id] : ids.filter((id) => id !== token.id)
                        )
                      }
                    />
                    {token.name}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {metamagicKey === HEIGHTENED_SPELL_KEY && (
          <div className="sp-note">{t('ui.spellPopover.heightenedHint')}</div>
        )}
        {twinnedMulti && <div className="sp-note">{t('ui.spellPopover.twinnedHint')}</div>}

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

        {!spellAutomated(spell) && !spellByDesign(spell) && (
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
