import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BASE_ACTIONS, actionSlotAvailable, isUnarmedAttack, type ActionCost, type ActionDef, type Spell } from 'shared';
import { useGameStore } from '../store/useGameStore';
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
import { useSpellByKey } from '../lib/useSpells';
import ActionIcon from './ActionIcon';
import ConditionChips from './ConditionChips';
import EffectChips from './EffectChips';
import FeatureIcon from './featureIcons';
import SpellIcon from './SpellIcon';
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
  const spellByKey = useSpellByKey();
  const info = useActionContext();
  const [casting, setCasting] = useState<Spell | null>(null);
  const [tip, setTip] = useState<IconTipState | null>(null);

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
    attacksPer,
    panelSpells,
  } = info;

  const turnCtx: TurnContext = { combatActive, isActive, turn, ownTurn, incapacitated: incap, controlled };

  /** Клик по кнопке: цели не нужны — применяем сразу, иначе входим в режим выбора цели. */
  const fire = (actionId: string, slot: ActionCost, attackIndex?: number, label?: string) => {
    const def = BASE_ACTIONS.find((a) => a.id === actionId);
    if (def?.targeting?.kind === 'creature') {
      startTargeting({
        kind: 'action',
        tokenId: token.id,
        actionId,
        slot,
        attackIndex,
        label: label ?? def.name,
      });
      return;
    }
    runAction(token.id, actionId, { attackIndex, slot });
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
  const hasReaction =
    BASE_ACTIONS.some((a) => a.costs.includes('reaction')) ||
    featuresReaction.length > 0 ||
    panelSpells.some((s) => spellSlotOf(s) === 'reaction');

  const spellsAction = sortPanelSpells(panelSpells.filter((s) => spellSlotOf(s) === 'action'));
  const spellsBonus = sortPanelSpells(panelSpells.filter((s) => spellSlotOf(s) === 'bonus'));
  const spellsReaction = sortPanelSpells(panelSpells.filter((s) => spellSlotOf(s) === 'reaction'));
  const spellsOther = sortPanelSpells(panelSpells.filter((s) => spellSlotOf(s) === 'other'));

  const spellDisabled = (spell: Spell): boolean => {
    if (incap || !controlled) return true;
    if (!combatActive) return false;
    const slot = spellSlotOf(spell);
    if (!isActive && slot !== 'reaction') return true;
    if (slot === 'reaction') {
      const maxLevel = maxCastableForSpell(spell, {
        isCharacter,
        resources,
        token,
        freeCastKeys: featFreeCastKeys(sheet, resources),
      });
      if (spell.level > 0 && maxLevel < spell.level) return true;
      const t = isActive ? turn : ownTurn;
      if (t && !actionSlotAvailable(t, 'reaction')) return true;
    }
    return false;
  };

  const spellButton = (spell: Spell) => {
    const level = spell.level === 0 ? 'фокус' : `${spell.level} круг`;
    return (
      <button
        key={`spell:${spell.key}`}
        className="ap-icon-btn ap-spell-btn"
        data-tip={`${spell.name} · ${level}`}
        aria-label={spell.name}
        disabled={spellDisabled(spell)}
        onClick={() => setCasting(spell)}
      >
        <SpellIcon spell={spell} className="ap-icon" />
      </button>
    );
  };

  const featureButton = (f: ActionDef) => {
    const left = resourceLeft(f);
    const label = left !== null ? `${f.name} (${left})` : f.name;
    return (
      <button
        key={f.id}
        className="ap-icon-btn"
        data-tip={label}
        aria-label={label}
        disabled={!canUseFeature(f, turnCtx, resourceLeft(f))}
        onClick={() => {
          const slot = featureSlot(f, turnCtx);
          if (f.targeting?.kind === 'creature') {
            startTargeting({ kind: 'action', tokenId: token.id, actionId: f.id, slot, label: f.name });
          } else {
            runAction(token.id, f.id, { slot });
          }
        }}
      >
        <FeatureIcon id={f.id} fallback={featureIconId(f)} className="ap-icon" />
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
            data-tip="Атака (нет оружия)"
            aria-label="Атака (нет оружия)"
            disabled
          >
            <WeaponIcon name="" className="ap-icon" />
          </button>
        );
      } else {
        for (const { entry, index } of weapons) {
          const label = entry.name.trim() || `Оружие ${index + 1}`;
          buttons.push(
            <button
              key={`${slot}:attack:${index}`}
              className="ap-icon-btn"
              data-tip={`Атака: ${label}`}
              aria-label={`Атака: ${label}`}
              disabled={!canSpendSlot(turnCtx, slot, 'attack', isUnarmedAttack(entry))}
              onClick={() => fire('attack', slot, index, `Атака: ${label}`)}
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
    for (const a of BASE_ACTIONS.filter((x) => x.costs.includes(slot) && x.id !== 'attack')) {
      // Безоружный удар, захват и толчок — тоже атаки: меч-бейдж и метка «Атака: …».
      const isAttack = ATTACK_BADGED.has(a.id);
      const label = isAttack ? `Атака: ${a.name}` : a.name;
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
    if (buttons.length === 0) return <span className="ap-empty">Нет</span>;
    return buttons;
  };

  return (
    <div
      className={`action-panel${!controlled ? ' ap-locked' : ''}`}
      onMouseOver={showTip}
      onMouseLeave={() => setTip(null)}
    >
      <div className="ap-head">
        <span className="ap-token">{token.name}</span>
        {token.conditions.length > 0 && <ConditionChips conditions={token.conditions} spellByKey={spellByKey} />}
        {token.effects.some((e) => !e.hidden) && (
          <EffectChips effects={token.effects} spellByKey={spellByKey} tokenId={token.id} />
        )}
        {incap && <span className="ap-incap">Недееспособен</span>}
        {combatActive && turn ? (
          <span className="ap-counters">
            <span className="ap-counter" title="Реакция">
              Реакция <Dots total={reactionTotal} remaining={reactionRemaining} tone="reaction" />
            </span>
            <span className="ap-counter attack-left" title="Атаки в действии «Атака»">
              {Array.from({ length: attacksTotal }, (_, i) => (
                <ActionIcon key={i} id="sword" className={`ap-sword${i < attacksLeft ? '' : ' spent'}`} />
              ))}
            </span>
            <span className={`ap-counter move${moveLeft < 0 ? ' over' : ''}`} title="Осталось передвижения">
              {moveLeft} фт
            </span>
          </span>
        ) : combatActive && reactionTurn ? (
          <span className="ap-count dim">
            Не ваш ход · Реакция <Dots total={reactionTotal} remaining={reactionRemaining} tone="reaction" />
          </span>
        ) : (
          <span className="ap-count dim">{controlled ? 'Вне боя' : 'Не ваш токен'}</span>
        )}
      </div>
      <div className="ap-body">
        <section className="ap-panel actions">
          <div className="ap-panel-head">
            <span className="ap-panel-title">Действия</span>
            {combatActive && turn && <Dots total={actionTotal} remaining={actionRemaining} tone="action" />}
          </div>
          <div className="ap-icons">{renderButtons('action')}</div>
        </section>
        <section className="ap-panel bonus">
          <div className="ap-panel-head">
            <span className="ap-panel-title">Бонусные действия</span>
            {combatActive && turn && <Dots total={bonusTotal} remaining={bonusRemaining} tone="bonus" />}
          </div>
          <div className="ap-icons">{renderButtons('bonus')}</div>
        </section>
        {hasReaction && (
          <section className="ap-panel reaction">
            <div className="ap-panel-head">
              <span className="ap-panel-title">Реакция</span>
              {combatActive && reactionTurn && (
                <Dots total={reactionTotal} remaining={reactionRemaining} tone="reaction" />
              )}
            </div>
            <div className="ap-icons">{renderButtons('reaction')}</div>
          </section>
        )}
      </div>
      {(featuresOther.length > 0 || spellsOther.length > 0) && (
        <section className="ap-panel other">
          <div className="ap-panel-head">
            <span className="ap-panel-title">Свободные и прочие</span>
          </div>
          <div className="ap-icons">
            {featuresOther.map(featureButton)}
            {spellsOther.map(spellButton)}
          </div>
        </section>
      )}
      {casting && <SpellPopover spell={casting} tokenId={token.id} onClose={() => setCasting(null)} />}
      {tip && <IconTip tip={tip} />}
    </div>
  );
}
