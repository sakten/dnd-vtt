import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { actionTargeting, BASE_ACTIONS, abilityMod, automationForAction, druidLevelOf, featureActionAutomation, hasMoonCircle, invocationAtWillSpells, isUnarmedAttack, legendaryOnly, restrictionsFor, slotSpendable, type ActionCost, type ActionDef, type Spell } from 'shared';
import { useGameStore } from '../store/useGameStore';
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
import { baseActionLabel } from '../i18n/domain';
import { featureDisplayName } from '../i18n/names';
import { useDragSize } from '../lib/useDragSize';
import { useSpellByKey } from '../lib/useSpells';
import ActionIcon from './ActionIcon';
import ConditionChips from './ConditionChips';
import EffectChips from './EffectChips';
import FeatureIcon from './featureIcons';
import SpellIcon from './SpellIcon';
import ShapePicker from './ShapePicker';
import SpellPopover from './SpellPopover';
import WeaponIcon from './WeaponIcon';

/** Базовые действия, которые по правилам являются атаками (бейдж-меч). */
const ATTACK_BADGED = new Set(['unarmedStrike', 'grapple', 'shove']);

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
  const featuresReaction = features.filter((f) => f.costs.includes('reaction'));
  const featuresOther = features.filter(
    (f) => !f.costs.includes('action') && !f.costs.includes('bonus') && !f.costs.includes('reaction')
  );
  const legendaryAbilities = abilities.filter(legendaryOnly);
  const hasReaction =
    BASE_ACTIONS.some((a) => a.costs.includes('reaction')) ||
    featuresReaction.length > 0 ||
    panelSpells.some((s) => spellSlotOf(s) === 'reaction');

  const spellsAction = sortPanelSpells(panelSpells.filter((s) => spellSlotOf(s) === 'action'));
  const spellsBonus = sortPanelSpells(panelSpells.filter((s) => spellSlotOf(s) === 'bonus'));
  const spellsReaction = sortPanelSpells(panelSpells.filter((s) => spellSlotOf(s) === 'reaction'));
  const spellsOther = sortPanelSpells(panelSpells.filter((s) => spellSlotOf(s) === 'other'));

  const spellDisabled = (spell: Spell): boolean => {
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
    const tip = [`${spellDisplayName(spell)} · ${level}`, ...spellMechanics(spell)].join('\n');
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
        <FeatureIcon id={f.id} fallback={featureIconId(f)} className="ap-icon" />
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
        originKind: 'point',
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
          buttons.push(
            <button
              key={`${slot}:attack:${index}`}
              className="ap-icon-btn"
              data-tip={t('ui.action.attackLabel', { name: label })}
              aria-label={t('ui.action.attackLabel', { name: label })}
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
    if (slot === 'action' || slot === 'bonus' || slot === 'reaction') {
      const featureList = slot === 'action' ? featuresAction : slot === 'bonus' ? featuresBonus : featuresReaction;
      const spellList = slot === 'action' ? spellsAction : slot === 'bonus' ? spellsBonus : spellsReaction;
      buttons.push(...featureList.map(featureButton));
      buttons.push(...spellList.map(spellButton));
    }
    buttons.push(...abilities.filter((a) => !legendaryOnly(a) && a.costs.includes(slot)).map(abilityButton));
    if (buttons.length === 0) return <span className="ap-empty">{t('ui.action.none')}</span>;
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
      <div className="ap-body">
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
        </section>
        <section className="ap-panel bonus">
          <div className="ap-panel-head">
            <span className="ap-panel-title">{t('ui.action.bonusActions')}</span>
            {combatActive && turn && <Dots total={bonusTotal} remaining={bonusRemaining} tone="bonus" />}
          </div>
          <div className="ap-icons">{renderButtons('bonus')}</div>
        </section>
        {hasReaction && (
          <section className="ap-panel reaction">
            <div className="ap-panel-head">
              <span className="ap-panel-title">{t('ui.action.reaction')}</span>
              {combatActive && reactionTurn && (
                <Dots total={reactionTotal} remaining={reactionRemaining} tone="reaction" />
              )}
            </div>
            <div className="ap-icons">{renderButtons('reaction')}</div>
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
      {!legendarySlot && (featuresOther.length > 0 || spellsOther.length > 0) && (
        <section className="ap-panel other">
          <div className="ap-panel-head">
            <span className="ap-panel-title">{t('ui.action.other')}</span>
          </div>
          <div className="ap-icons">
            {featuresOther.map(featureButton)}
            {spellsOther.map(spellButton)}
          </div>
        </section>
      )}
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
