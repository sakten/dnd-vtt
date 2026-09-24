import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { actionTargeting, BASE_ACTIONS, abilityMod, automationForAction, druidLevelOf, featureActionAutomation, hasMoonCircle, invocationAtWillSpells, isUnarmedAttack, legendaryOnly, masteryAccessible, restrictionsFor, SMITE_SPELLS, slotSpendable, weaponByKey, weaponHasProperty, weaponMastery, type ActionCost, type ActionDef, type AttackEntry, type Spell } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { aimOriginKind } from '../domain/interaction';
import { spellDisplayName } from '../i18n/names';
import {
  canSpendSlot,
  canUseFeature,
  featureSlot,
  featFreeCastKeys,
  maxCastableForSpell,
  sortPanelSpells,
  spellSlotOf,
  type TurnContext,
} from '../lib/actionRules';
import { useActionContext } from '../lib/useActionContext';
import { useActiveMap } from '../store/hooks';
import { spellMechanics } from '../lib/spellText';
import { t } from '../i18n';
import { baseActionLabel, masteryLabel } from '../i18n/domain';
import { featureDisplayName } from '../i18n/names';
import { useDragSize } from '../lib/useDragSize';
import { useSpellByKey } from '../lib/useSpells';
import ActionIcon from './ActionIcon';
import ActionGlyph, { hasActionIcon } from './actionIcons';
import ConditionChips from './ConditionChips';
import EffectChips from './EffectChips';
import FeatureIcon from './featureIcons';
import LoadoutPanel from './LoadoutPanel';
import SpellIcon from './SpellIcon';
import ShapePicker from './ShapePicker';
import SpellPopover from './SpellPopover';
import WeaponIcon from './WeaponIcon';

/** Базовые действия, которые по правилам являются атаками (бейдж-меч). */
const ATTACK_BADGED = new Set(['unarmedStrike', 'grapple', 'shove']);

/** Ширины колонок нижней панели: одна иконная полоса по умолчанию, минимум и остаток для «Действий». */
const COL_MIN = 92;
const COL_DEFAULT = 92;
const COL_ACTIONS_MIN = 200;
type ColKind = 'bonus' | 'split' | 'other';

/** Тултип иконки: рисуется порталом, чтобы не резался скроллом панели. */
interface IconTipState {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

function IconTip({ tip }: { tip: IconTipState }) {
  return createPortal(
    <div className={`ap-tip${tip.below ? ' below' : ''}`} style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>,
    document.body
  );
}

/** Иконка классовой черты по ключу ресурса (fallback — искра). */
function featureIconId(f: ActionDef): string {
  const k = `${f.resourceKey ?? ''} ${f.id}`.toLowerCase();
  if (k.includes('inspiration')) return 'inspiration';
  if (k.includes('channeldivinity')) return 'channel';
  if (k.includes('focus/')) return 'flurry';
  if (k.includes('wildshape')) return 'beast';
  if (k.includes('rage')) return 'rage';
  if (k.includes('surge')) return 'surge';
  if (k.includes('secondwind') || k.includes('layonhands') || k.includes('healing') || k.includes('balm')) return 'heal';
  if (k.includes('ward') || k.includes('shield') || k.includes('defense') || k.includes('defences')) return 'shield';
  if (k.includes('eye') || k.includes('omen') || k.includes('portent') || k.includes('third')) return 'eye';
  if (k.includes('dice') || k.includes('maneuver') || k.includes('metamagic')) return 'dice';
  return 'spark';
}

function Dots({ total, remaining, tone }: { total: number; remaining: number; tone: string }) {
  return (
    <span className={`ap-dots ${tone}`}>
      {Array.from({ length: Math.max(0, total) }, (_, i) => (
        <span key={i} className={`ap-dot${i < remaining ? ' on' : ''}`} />
      ))}
    </span>
  );
}

export default function ActionPanel() {
  const resources = useGameStore((s) => s.resources);
  const sheet = useGameStore((s) => s.sheet);
  const setSheet = useGameStore((s) => s.setSheet);
  const setSheetOpen = useGameStore((s) => s.setSheetOpen);
  const runAction = useGameStore((s) => s.runAction);
  const startTargeting = useGameStore((s) => s.startTargeting);
  const startMultiTarget = useGameStore((s) => s.startMultiTarget);
  const startAim = useGameStore((s) => s.startAim);
  const rollMode = useGameStore((s) => s.rollMode);
  const setRollMode = useGameStore((s) => s.setRollMode);
  const spellByKey = useSpellByKey();
  const info = useActionContext();
  const activeMap = useActiveMap();
  const [casting, setCasting] = useState<{ spell: Spell; ability?: ActionDef } | null>(null);
  const [tip, setTip] = useState<IconTipState | null>(null);
  const [shapeOpen, setShapeOpen] = useState(false);
  const shapeToken = useGameStore((s) => s.shapeToken);
  const revertShape = useGameStore((s) => s.revertShape);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vtt-action-panel') === 'collapsed');
  const panelRef = useRef<HTMLDivElement>(null);

  const clampHeight = useCallback((v: number) => Math.max(140, Math.min(v, window.innerHeight - 80)), []);
  const measureHeight = useCallback(() => panelRef.current?.offsetHeight ?? 320, []);
  const {
    size: panelHeight,
    onPointerDown: onResizeDown,
    onPointerMove: onResizeMove,
  } = useDragSize('vtt-action-height', 'y', clampHeight, null, measureHeight);

  /** Ширины колонок (px); null — дефолт из CSS: бонус и «прочие» по одной полосе, действия — остаток. */
  const [cols, setCols] = useState<{ bonus: number; other: number } | null>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('vtt-action-cols') ?? 'null') as {
        bonus?: unknown;
        other?: unknown;
      } | null;
      if (typeof parsed?.bonus === 'number' && typeof parsed.other === 'number') {
        return { bonus: parsed.bonus, other: parsed.other };
      }
    } catch {
      /* повреждённое значение — дефолт */
    }
    return null;
  });
  const bodyRef = useRef<HTMLDivElement>(null);
  const colDrag = useRef<{ kind: ColKind; x: number; bonus: number; other: number } | null>(null);

  useEffect(() => {
    if (cols) {
      localStorage.setItem('vtt-action-cols', JSON.stringify({ bonus: Math.round(cols.bonus), other: Math.round(cols.other) }));
    }
  }, [cols]);

  const onColDown = (kind: ColKind) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const current = cols ?? { bonus: COL_DEFAULT, other: COL_DEFAULT };
    colDrag.current = { kind, x: e.clientX, bonus: current.bonus, other: current.other };
    setCols(current);
  };

  const onColMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = colDrag.current;
    if (!drag || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const bodyW = bodyRef.current?.clientWidth ?? 1200;
    const maxSum = Math.max(COL_MIN * 2, bodyW - 32 - COL_ACTIONS_MIN);
    const dx = e.clientX - drag.x;
    let { bonus, other } = drag;
    if (drag.kind === 'bonus') {
      bonus = Math.max(COL_MIN, Math.min(bonus - dx, maxSum - other));
    } else if (drag.kind === 'other') {
      other = Math.max(COL_MIN, Math.min(other + dx, maxSum - bonus));
    } else {
      const total = bonus + other;
      bonus = Math.max(COL_MIN, Math.min(bonus + dx, total - COL_MIN, maxSum - COL_MIN));
      other = total - bonus;
    }
    setCols({ bonus, other });
  };

  const onColUp = () => {
    colDrag.current = null;
  };

  const resetCols = () => {
    colDrag.current = null;
    localStorage.removeItem('vtt-action-cols');
    setCols(null);
  };

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      localStorage.setItem('vtt-action-panel', v ? 'open' : 'collapsed');
      return !v;
    });
  };

  const showTip = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (!el) {
      setTip(null);
      return;
    }
    const text = el.dataset.tip ?? '';
    const rect = el.getBoundingClientRect();
    const below = rect.top < 56;
    const next: IconTipState = {
      text,
      x: rect.left + rect.width / 2,
      y: below ? rect.bottom + 8 : rect.top - 8,
      below,
    };
    setTip((prev) =>
      prev && prev.text === next.text && prev.x === next.x && prev.y === next.y && prev.below === next.below
        ? prev
        : next
    );
  };

  if (!info) return null;
  const {
    token,
    turn,
    ownTurn,
    isActive,
    controlled,
    combatActive,
    isCharacter,
    incapacitated: incap,
    weapons,
    features,
    abilities,
    attacksPer,
    panelSpells,
    legendarySlot,
    legendaryRemaining,
    legendaryMax,
  } = info;

  const turnCtx: TurnContext = {
    combatActive,
    isActive,
    turn,
    ownTurn,
    incapacitated: incap,
    controlled,
    restrictions: restrictionsFor(token.conditions, token.effects),
  };

  /** Клик по кнопке: цели не нужны — применяем сразу, иначе входим в режим выбора цели. */
  const fire = (actionId: string, slot: ActionCost, attackIndex?: number, label?: string) => {
    const def = BASE_ACTIONS.find((a) => a.id === actionId);
    // Галка Adv/Dis над ROLL даёт преимущество на чеки в игре (Скрыться, Поиск).
    const isCheck = actionId.startsWith('escape:') || !!def && automationForAction(def)?.utility?.kind === 'check';
    const advantage = isCheck ? rollMode ?? undefined : undefined;
    if (def?.targeting?.kind === 'creature') {
      startTargeting({
        kind: 'action',
        tokenId: token.id,
        actionId,
        slot,
        attackIndex,
        advantage,
        label: label ?? baseActionLabel(actionId, def.name),
      });
      if (advantage) setRollMode(null);
      return;
    }
    runAction(token.id, actionId, { attackIndex, slot, advantage });
    if (advantage) setRollMode(null);
  };

  const resourceLeft = (f: ActionDef): number | null => {
    if (!f.resourceKey) return null;
    return resources?.resources.find((r) => r.key === f.resourceKey)?.current ?? 0;
  };

  const actionTotal = turn ? 1 + turn.extraActions : 0;
  const actionRemaining = turn ? (turn.actionUsed ? 0 : 1) + turn.extraActions : 0;
  const bonusTotal = turn ? 1 + turn.extraBonusActions : 0;
  const bonusRemaining = turn ? (turn.bonusActionUsed ? 0 : 1) + turn.extraBonusActions : 0;
  const reactionTurn = isActive ? turn : ownTurn;
  const reactionTotal = reactionTurn ? 1 : 0;
  const reactionRemaining = reactionTurn && !reactionTurn.reactionUsed ? 1 : 0;
  const moveLeft = turn ? turn.movementMax - turn.movementUsed : 0;
  const attacksLeft = turn
    ? (turn.attacksRemaining > 0 ? turn.attacksRemaining : turn.actionUsed ? 0 : attacksPer) +
      turn.extraActions * attacksPer
    : attacksPer;
  const attacksTotal = Math.max(attacksPer, attacksLeft);

  const featuresAction = features.filter((f) => f.costs.includes('action'));
  const featuresBonus = features.filter((f) => f.costs.includes('bonus'));
  const featuresOther = features.filter(
    (f) => !f.costs.includes('action') && !f.costs.includes('bonus') && !f.costs.includes('reaction')
  );
  const legendaryAbilities = abilities.filter(legendaryOnly);

  const spellsAction = sortPanelSpells(panelSpells.filter((s) => spellSlotOf(s) === 'action'));
  const spellsBonus = sortPanelSpells(panelSpells.filter((s) => spellSlotOf(s) === 'bonus'));
  const spellsOther = sortPanelSpells(panelSpells.filter((s) => spellSlotOf(s) === 'other'));

  // Атака второй рукой (Light): бьёт оружие из левой руки; триггер — прошлая атака другим лёгким.
  // Оружие с Nick и доступом к мастерствам — в «Свободных и прочих» (не тратит бонусное действие).
  const leftHandAttack = info.leftHand;
  const lightWeapons = weapons.filter(
    ({ entry }) =>
      !!leftHandAttack && entry.id === leftHandAttack.id && weaponHasProperty(entry, 'L')
  );
  const lastWeapon = turn?.lastWeaponKey ? weaponByKey(turn.lastWeaponKey) : undefined;
  const lastIsLight = !!lastWeapon?.properties.includes('L');
  const hasMastery = masteryAccessible(sheet?.classes);
  const isNickWeapon = (entry: AttackEntry) =>
    hasMastery && !!entry.weaponKey && !!weaponByKey(entry.weaponKey)?.mastery.includes('Nick');
  const nickWeapons = lightWeapons.filter(({ entry }) => isNickWeapon(entry));
  const bonusOffhand = lightWeapons.filter(({ entry }) => !isNickWeapon(entry));
  const canOffhand = controlled && !incap && lightWeapons.length >= 1;
  const offhandReady = (entry: AttackEntry) =>
    !combatActive || (lastIsLight && entry.weaponKey !== turn?.lastWeaponKey);
  // Cleave: после попадания оружием с «Прорубающим» сервер помечает цель (раз в ход).
  const cleaveWeapon = turn?.cleaveWeapon ? weaponByKey(turn.cleaveWeapon) : undefined;
  const cleaveEntry =
    !turn?.cleaveUsed && turn?.cleaveFrom && cleaveWeapon
      ? weapons.find(({ entry }) => entry.weaponKey === turn.cleaveWeapon)
      : undefined;

  const spellDisabled = (spell: Spell): boolean => {
    // Смайты применяются райдером после попадания оружием — из панели не кастуются.
    if (SMITE_SPELLS.has(spell.key)) return true;
    // Блокируем по экономике действий (действие/бонус/реакция уже потрачены).
    const slot = spellSlotOf(spell);
    if (!canSpendSlot(turnCtx, slot === 'other' ? 'special' : slot, spell.key)) return true;
    if (slot === 'reaction' && spell.level > 0) {
      const maxLevel = maxCastableForSpell(spell, {
        isCharacter,
        resources,
        token,
        freeCastKeys: featFreeCastKeys(sheet, resources),
      atWillKeys: sheet ? new Set(invocationAtWillSpells(sheet)) : undefined,
      });
      if (maxLevel < spell.level) return true;
    }
    return false;
  };

  const spellButton = (spell: Spell) => {
    const level = spell.level === 0 ? t('ui.action.cantrip') : t('ui.action.level', { n: spell.level });
    const smite = SMITE_SPELLS.has(spell.key);
    const tip = [
      `${spellDisplayName(spell)} · ${level}`,
      ...spellMechanics(spell),
      ...(smite ? [t('ui.action.smiteOnHit')] : []),
    ].join('\n');
    return (
      <button
        key={`spell:${spell.key}`}
        className="ap-icon-btn ap-spell-btn"
          data-tip={tip}
          aria-label={spellDisplayName(spell)}
        disabled={spellDisabled(spell)}
        onClick={() => setCasting({ spell })}
      >
        <SpellIcon spell={spell} className="ap-icon" />
      </button>
    );
  };

  const featureButton = (f: ActionDef) => {
    const left = resourceLeft(f);
    // Имя — конкретной черты (Божественная искра / Изгнание нежити), а не ресурса-пула:
    // у Channel Divinity и подобных пулов одна кнопка-ресурс на несколько способностей.
    const featureKey = f.id.startsWith('class:') ? f.id.slice('class:'.length) : undefined;
    const base = featureDisplayName(featureKey, f.name);
    const label = left !== null ? `${base} (${left})` : base;
    return (
      <button
        key={f.id}
        className="ap-icon-btn"
        data-tip={label}
        aria-label={label}
        disabled={!canUseFeature(f, turnCtx, resourceLeft(f))}
        onClick={() => {
          // «Дикий облик»: открываем выбор известной формы (принятие — сервер).
          if (f.id === 'class:druid:wildShape') {
            if (isCharacter && sheet && !token.shape) setShapeOpen(true);
            return;
          }
          const slot = featureSlot(f, turnCtx);
          const auto = sheet ? featureActionAutomation(f.id, sheet.classes) : undefined;
          const maxTargets = auto?.targetsAbility
            ? Math.max(1, abilityMod(sheet?.abilities[auto.targetsAbility] ?? 10))
            : auto?.targets ?? 1;
          // Галка Adv/Dis над ROLL даёт преимущество на чеки-черты (в т.ч. «Выпутаться»).
          const isCheck = f.id.startsWith('escape:') || auto?.utility?.kind === 'check';
          const advantage = isCheck ? rollMode ?? undefined : undefined;
          // Действие зоны (перемещение/удар): прицел с якорем от текущего центра зоны.
          if (f.zoneId && (f.targeting?.kind === 'point' || f.targeting?.kind === 'area')) {
            const zone = (activeMap?.zones ?? []).find((z) => z.id === f.zoneId);
            const targeting = f.targeting;
            if (zone && targeting) {
              startAim({
                tokenId: token.id,
                actionId: f.id,
                slot: featureSlot(f, turnCtx),
                spec: targeting.kind === 'area' ? targeting.area! : zone.area,
                originKind: 'point',
                rangeFeet: targeting.range ?? null,
                anchor: zone.origin,
              });
              return;
            }
          }
          // Действие-область из эффекта (Dragon's Breath): прицел от носителя эффекта.
          if (f.targeting?.kind === 'area' && f.targeting.area) {
            startAim({
              tokenId: token.id,
              actionId: f.id,
              slot: featureSlot(f, turnCtx),
              spec: f.targeting.area,
              originKind: 'self',
              rangeFeet: f.targeting.range ?? null,
            });
            return;
          }
          // Выданный телепорт (Far Step): прицел точки назначения в пределах дальности.
          if (f.source === 'spell' && !f.zoneId && f.targeting?.kind === 'point') {
            startAim({
              tokenId: token.id,
              actionId: f.id,
              slot: featureSlot(f, turnCtx),
              spec: { shape: 'sphere', size: 0 },
              originKind: 'point',
              rangeFeet: f.targeting.range ?? null,
            });
            return;
          }
          if (f.targeting?.kind === 'creature' && maxTargets > 1) {
            startMultiTarget({ tokenId: token.id, actionId: f.id, slot, count: maxTargets, distinct: true });
          } else if (f.targeting?.kind === 'creature') {
            startTargeting({ kind: 'action', tokenId: token.id, actionId: f.id, slot, advantage, label: base });
          } else {
            runAction(token.id, f.id, { slot, advantage });
          }
          if (advantage) setRollMode(null);
        }}
      >
        {hasActionIcon(f.iconKey) ? (
          <ActionGlyph iconKey={f.iconKey} className="ap-icon" />
        ) : (
          <FeatureIcon id={f.id} fallback={featureIconId(f)} className="ap-icon" />
        )}
      </button>
    );
  };

  const abilitySlot = (a: ActionDef): ActionCost => {
    const state = isActive ? turn : ownTurn;
    if (state) {
      const available = a.costs.find((c) => slotSpendable(state, turnCtx.restrictions, c));
      if (available) return available;
    }
    return a.costs[0] ?? 'action';
  };

  const cooldownLeft = (a: ActionDef): number => turn?.abilityCooldowns?.[a.id] ?? 0;

  const abilityDisabled = (a: ActionDef): boolean => {
    if (incap || !controlled) return true;
    if (cooldownLeft(a) > 0) return true;
    const cost = a.legendaryCost ?? 0;
    if (!combatActive) return cost > 0;
    const only = legendaryOnly(a);
    if (legendarySlot) return !only || cost > legendaryRemaining;
    if (only) return true;
    if (cost > legendaryRemaining) return true;
    return !canSpendSlot(turnCtx, abilitySlot(a), a.id);
  };

  const abilityLabel = (a: ActionDef): string => {
    const parts = [a.name];
    if (a.legendaryCost) parts.push(t('ui.action.legendaryCost', { n: a.legendaryCost }));
    if (legendaryOnly(a) && !legendarySlot && combatActive) parts.push(t('ui.action.legendaryHint'));
    const cd = cooldownLeft(a);
    if (cd > 0) parts.push(t('ui.action.recharging', { n: cd }));
    return parts.join(' · ');
  };

  const activateAbility = (a: ActionDef) => {
    const slot = abilitySlot(a);
    if (a.spellKey) {
      const spell = spellByKey.get(a.spellKey);
      if (spell) setCasting({ spell, ability: a });
      return;
    }
    // Таргетинг — единый аксессор (`actionTargeting`): канон — на действии.
    const targeting = actionTargeting(a);
    if (targeting?.kind === 'area' && targeting.area) {
      startAim({
        tokenId: token.id,
        actionId: a.id,
        slot,
        spec: targeting.area,
        originKind: aimOriginKind(targeting.area.shape),
        rangeFeet: targeting.range ?? 30,
      });
      return;
    }
    if (targeting?.kind === 'creature') {
      const count = targeting.targets ?? 1;
      if (a.ability?.attack && count > 1) {
        startMultiTarget({ tokenId: token.id, actionId: a.id, slot, count, distinct: true });
        return;
      }
      startTargeting({ kind: 'action', tokenId: token.id, actionId: a.id, slot, label: a.name });
      return;
    }
    runAction(token.id, a.id, { slot });
  };

  const abilityButton = (a: ActionDef) => (
    <button
      key={`ability:${a.id}`}
      className="ap-icon-btn"
      data-tip={abilityLabel(a)}
      aria-label={a.name}
      disabled={abilityDisabled(a)}
      onClick={() => activateAbility(a)}
    >
      <FeatureIcon id={a.id} fallback={featureIconId(a)} className="ap-icon" />
      {!!a.legendaryCost && <span className="ap-legendary-badge" data-tip={t('ui.action.legendaryCost', { n: a.legendaryCost })}>✦</span>}
    </button>
  );

  /** Атака второй рукой (Light/Nick): урон без модификатора; `nick` — частью «Атаки» без бонусного. */
  const offhandButton = (entry: AttackEntry, index: number, kind: 'light' | 'nick') => {
    const label = entry.name.trim() || t('ui.action.weaponN', { n: index + 1 });
    const tip = t(kind === 'nick' ? 'ui.action.nickLabel' : 'ui.action.offhandLabel', { name: label });
    const disabled =
      !controlled ||
      incap ||
      (combatActive &&
        (!isActive ||
          !turn ||
          !offhandReady(entry) ||
          (kind === 'nick' ? !!turn.nickUsed : !canSpendSlot(turnCtx, 'bonus', `offhand:${index}`))));
    return (
      <button
        key={`${kind}:${index}`}
        className="ap-icon-btn"
        data-tip={tip}
        aria-label={tip}
        disabled={disabled}
        onClick={() =>
          startTargeting({
            kind: 'action',
            tokenId: token.id,
            actionId: 'attack',
            slot: 'bonus',
            attackIndex: index,
            offhand: true,
            label: tip,
          })
        }
      >
        <WeaponIcon name={entry.name} className="ap-icon" />
        <span className="ap-attack-badge">
          <ActionIcon id="sword" className="ap-badge-icon" />
        </span>
      </button>
    );
  };

  /** Прорубить (Cleave): вторая цель после попадания; часть «Атаки», бонус не тратит. */
  const cleaveButton = (entry: AttackEntry, index: number) => {
    const label = entry.name.trim() || t('ui.action.weaponN', { n: index + 1 });
    const tip = t('ui.action.cleaveLabel', { name: label });
    return (
      <button
        key={`cleave:${index}`}
        className="ap-icon-btn"
        data-tip={tip}
        aria-label={tip}
        disabled={!controlled || incap || (combatActive && !isActive)}
        onClick={() =>
          startTargeting({
            kind: 'action',
            tokenId: token.id,
            actionId: 'attack',
            slot: 'action',
            attackIndex: index,
            cleave: true,
            label: tip,
          })
        }
      >
        <WeaponIcon name={entry.name} className="ap-icon" />
        <span className="ap-attack-badge">
          <ActionIcon id="sword" className="ap-badge-icon" />
        </span>
      </button>
    );
  };

  const renderButtons = (slot: ActionCost) => {
    const buttons: ReactNode[] = [];
    const hasAttack = BASE_ACTIONS.some((a) => a.id === 'attack' && a.costs.includes(slot));
    if (hasAttack) {
      if (weapons.length === 0) {
        buttons.push(
          <button
            key={`${slot}:attack:none`}
            className="ap-icon-btn"
            data-tip={t('ui.action.attackNoWeapon')}
            aria-label={t('ui.action.attackNoWeapon')}
            disabled
          >
            <WeaponIcon name="" className="ap-icon" />
          </button>
        );
      } else {
        for (const { entry, index } of weapons) {
          const label = entry.name.trim() || t('ui.action.weaponN', { n: index + 1 });
          const mastery = weaponMastery(entry, sheet?.classes);
          const attackLabel = t('ui.action.attackLabel', { name: label });
          const tip = mastery ? `${attackLabel} · ${masteryLabel(mastery)}` : attackLabel;
          buttons.push(
            <button
              key={`${slot}:attack:${index}`}
              className="ap-icon-btn"
              data-tip={tip}
              aria-label={tip}
              disabled={!canSpendSlot(turnCtx, slot, 'attack', isUnarmedAttack(entry))}
              onClick={() => fire('attack', slot, index, t('ui.action.attackLabel', { name: label }))}
            >
              <WeaponIcon name={entry.name} className="ap-icon" />
              <span className="ap-attack-badge">
                <ActionIcon id="sword" className="ap-badge-icon" />
              </span>
            </button>
          );
        }
      }
    }
    if (slot === 'bonus' && token.shape?.kind === 'wildShape') {
      // Досрочный выход из Wild Shape — бонусное действие (XPHB).
      buttons.push(
        <button
          key="shape:revert"
          className="ap-icon-btn"
          data-tip={t('ui.shape.revertAction')}
          aria-label={t('ui.shape.revertAction')}
          disabled={!controlled || !canSpendSlot(turnCtx, 'bonus', 'shape:revert')}
          onClick={() => revertShape(token.id)}
        >
          <FeatureIcon id="class:druid:wildShape" fallback="beast" className="ap-icon" />
        </button>
      );
    }
    for (const a of BASE_ACTIONS.filter((x) => x.costs.includes(slot) && x.id !== 'attack')) {
      // В форме зверя нет «безоружного удара»: у формы свои естественные атаки.
      if (token.shape && a.id === 'unarmedStrike') continue;
      // Безоружный удар, захват и толчок — тоже атаки: меч-бейдж и метка «Атака: …».
      const isAttack = ATTACK_BADGED.has(a.id);
      const name = baseActionLabel(a.id, a.name);
      const label = isAttack ? t('ui.action.attackLabel', { name }) : name;
      buttons.push(
        <button
          key={`${slot}:${a.id}`}
          className="ap-icon-btn"
          data-tip={label}
          aria-label={label}
          disabled={!canSpendSlot(turnCtx, slot, a.id)}
          onClick={() => fire(a.id, slot, undefined, label)}
        >
          <ActionIcon id={a.id} className="ap-icon" />
          {isAttack && (
            <span className="ap-attack-badge">
              <ActionIcon id="sword" className="ap-badge-icon" />
            </span>
          )}
        </button>
      );
    }
    if (slot === 'action' || slot === 'bonus') {
      const featureList = slot === 'action' ? featuresAction : featuresBonus;
      const spellList = slot === 'action' ? spellsAction : spellsBonus;
      buttons.push(...featureList.map(featureButton));
      buttons.push(...spellList.map(spellButton));
    }
    buttons.push(...abilities.filter((a) => !legendaryOnly(a) && a.costs.includes(slot)).map(abilityButton));
    if (buttons.length === 0) return slot === 'bonus' && canOffhand && bonusOffhand.length > 0 ? null : <span className="ap-empty">{t('ui.action.none')}</span>;
    return buttons;
  };

  return (
    <div
      ref={panelRef}
      className={`action-panel${!controlled ? ' ap-locked' : ''}${collapsed ? ' collapsed' : ''}${!collapsed && panelHeight != null ? ' resized' : ''}`}
      style={!collapsed && panelHeight != null ? { height: panelHeight } : undefined}
      onMouseOver={showTip}
      onMouseLeave={() => setTip(null)}
    >
      {!collapsed && (
        <div className="ap-resizer" onPointerDown={onResizeDown} onPointerMove={onResizeMove} />
      )}
      <div className="ap-head">
        <span className="ap-token">{token.name}</span>
        {token.conditions.length > 0 && <ConditionChips conditions={token.conditions} spellByKey={spellByKey} />}
        {token.effects.some((e) => !e.hidden) && (
          <EffectChips effects={token.effects} spellByKey={spellByKey} tokenId={token.id} />
        )}
        {incap && <span className="ap-incap">{t('ui.action.incapacitated')}</span>}
        {combatActive && legendarySlot ? (
          <span className="ap-count legendary">
            {t('ui.action.legendaryLeft', { n: legendaryRemaining, max: legendaryMax })}
          </span>
        ) : combatActive && turn ? (
          <span className="ap-counters">
            <span className="ap-counter" title={t('ui.action.reaction')}>
              {t('ui.action.reaction')} <Dots total={reactionTotal} remaining={reactionRemaining} tone="reaction" />
            </span>
            <span className="ap-counter attack-left" title={t('ui.action.attacksTitle')}>
              {Array.from({ length: attacksTotal }, (_, i) => (
                <ActionIcon key={i} id="sword" className={`ap-sword${i < attacksLeft ? '' : ' spent'}`} />
              ))}
            </span>
            <span className={`ap-counter move${moveLeft < 0 ? ' over' : ''}`} title={t('ui.common.movementLeftTitle')}>
              {t('ui.common.feet', { n: moveLeft })}
            </span>
          </span>
        ) : combatActive && reactionTurn ? (
          <span className="ap-count dim">
            {t('ui.action.notYourTurn')}{' '}
            <Dots total={reactionTotal} remaining={reactionRemaining} tone="reaction" />
          </span>
        ) : (
          <span className="ap-count dim">{controlled ? t('ui.action.outOfCombat') : t('ui.action.notYourToken')}</span>
        )}
        <button
          className="icon ap-collapse"
          title={collapsed ? t('ui.action.expandPanel') : t('ui.action.collapsePanel')}
          onClick={toggleCollapsed}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>
      {!collapsed && (
        <>
      {shapeOpen && isCharacter && sheet && (
        <div className="ap-shape-picker">
          <ShapePicker
            known={sheet.wildShape?.known ?? []}
            level={druidLevelOf(sheet.classes)}
            moon={hasMoonCircle(sheet.classes)}
            onPick={(key) => {
              shapeToken(token.id, key);
              setShapeOpen(false);
            }}
            onClose={() => setShapeOpen(false)}
          />
        </div>
      )}
      <div className="ap-body" ref={bodyRef}>
        {isCharacter && sheet && (
          <LoadoutPanel
            token={token}
            sheet={sheet}
            resources={resources ?? undefined}
            readOnly={!controlled}
            onOpenSheet={() => setSheetOpen(true)}
            onChange={(hands) => {
              const next = { ...sheet };
              if (hands) next.hands = hands;
              else delete next.hands;
              setSheet(next);
            }}
          />
        )}
        {legendarySlot ? (
          <section className="ap-panel legendary">
            <div className="ap-panel-head">
              <span className="ap-panel-title">{t('ui.action.legendaryActions')}</span>
              <span className="ap-count">
                {legendaryRemaining}/{legendaryMax}
              </span>
            </div>
            <div className="ap-icons">{legendaryAbilities.map(abilityButton)}</div>
          </section>
        ) : (
          <>
        <section className="ap-panel actions">
          <div className="ap-panel-head">
            <span className="ap-panel-title">{t('ui.action.actions')}</span>
            {combatActive && turn && <Dots total={actionTotal} remaining={actionRemaining} tone="action" />}
          </div>
          <div className="ap-icons">{renderButtons('action')}</div>
          <div
            className="ap-col-resizer"
            data-tip={t('ui.action.resizeCols')}
            onPointerDown={onColDown('bonus')}
            onPointerMove={onColMove}
            onPointerUp={onColUp}
            onDoubleClick={resetCols}
          />
        </section>
        <section className="ap-panel bonus" style={cols ? { flex: `0 0 ${cols.bonus}px` } : undefined}>
          <div className="ap-panel-head">
            <span className="ap-panel-title">{t('ui.action.bonusActions')}</span>
            {combatActive && turn && <Dots total={bonusTotal} remaining={bonusRemaining} tone="bonus" />}
          </div>
          <div className="ap-icons">
            {renderButtons('bonus')}
            {canOffhand && bonusOffhand.map(({ entry, index }) => offhandButton(entry, index, 'light'))}
          </div>
          <div
            className="ap-col-resizer"
            data-tip={t('ui.action.resizeCols')}
            onPointerDown={onColDown('split')}
            onPointerMove={onColMove}
            onPointerUp={onColUp}
            onDoubleClick={resetCols}
          />
        </section>
        {(featuresOther.length > 0 || spellsOther.length > 0 || (canOffhand && nickWeapons.length > 0) || !!cleaveEntry) && (
          <section className="ap-panel other" style={cols ? { flex: `0 0 ${cols.other}px` } : undefined}>
            <div className="ap-panel-head">
              <span className="ap-panel-title">{t('ui.action.other')}</span>
            </div>
            <div className="ap-icons">
              {featuresOther.map(featureButton)}
              {spellsOther.map(spellButton)}
              {canOffhand && nickWeapons.map(({ entry, index }) => offhandButton(entry, index, 'nick'))}
              {cleaveEntry && cleaveButton(cleaveEntry.entry, cleaveEntry.index)}
            </div>
            <div
              className="ap-col-resizer"
              data-tip={t('ui.action.resizeCols')}
              onPointerDown={onColDown('other')}
              onPointerMove={onColMove}
              onPointerUp={onColUp}
              onDoubleClick={resetCols}
            />
          </section>
        )}
        {legendaryAbilities.length > 0 && (
          <section className="ap-panel legendary">
            <div className="ap-panel-head">
              <span className="ap-panel-title">{t('ui.action.legendaryActions')}</span>
              {combatActive && turn && turn.legendaryMax > 0 && (
                <span className="ap-count legendary">
                  {turn.legendaryRemaining}/{turn.legendaryMax}
                </span>
              )}
            </div>
            <div className="ap-icons">{legendaryAbilities.map(abilityButton)}</div>
          </section>
        )}
          </>
        )}
      </div>
        </>
      )}
      {casting && (
        <SpellPopover
          spell={casting.spell}
          tokenId={token.id}
          abilityAction={casting.ability ? { id: casting.ability.id, slot: abilitySlot(casting.ability) } : undefined}
          onClose={() => setCasting(null)}
        />
      )}
      {tip && <IconTip tip={tip} />}
    </div>
  );
}
