import { useMemo, type ReactNode } from 'react';
import {
  BASE_ACTIONS,
  actionSlotAvailable,
  attackIsActive,
  type ActionCost,
  type AttackEntry,
  type TurnState,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import ActionIcon from './ActionIcon';
import WeaponIcon from './WeaponIcon';

/** Базовые действия, которые по правилам являются атаками (бейдж-меч). */
const ATTACK_BADGED = new Set(['unarmedStrike', 'grapple', 'shove']);

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
  const map = useGameStore((s) => s.scene.maps.find((m) => m.id === s.viewMapId) ?? null);
  const selectedTokenId = useGameStore((s) => s.selectedTokenId);
  const targetTokenId = useGameStore((s) => s.targetTokenId);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const role = useGameStore((s) => s.role);
  const sheet = useGameStore((s) => s.sheet);
  const runAction = useGameStore((s) => s.runAction);

  const info = useMemo(() => {
    if (!map) return null;
    const combat = map.combat;
    let tokenId: string | null = null;
    let turn: TurnState | undefined;
    if (combat.active && combat.currentIndex >= 0) {
      const entry = combat.entries[combat.currentIndex];
      tokenId = entry?.tokenId ?? null;
      turn = entry ? combat.turns[entry.id] : undefined;
    } else {
      tokenId = selectedTokenId ?? map.tokens.find((t) => t.libraryItemId === currentCharacterId)?.id ?? null;
    }
    const token = tokenId ? map.tokens.find((t) => t.id === tokenId) : null;
    if (!token) return null;
    const controlled = role === 'dm' || (currentCharacterId !== null && token.libraryItemId === currentCharacterId);
    const inTurn = combat.active && combat.currentIndex >= 0 && controlled;
    const isCharacter = currentCharacterId !== null && token.libraryItemId === currentCharacterId;
    const weapons: { entry: AttackEntry; index: number }[] = (isCharacter ? sheet?.attacks ?? [] : token.attacks)
      .map((entry, index) => ({ entry, index }))
      .filter((x) => attackIsActive(x.entry));
    return { token, turn, controlled, inTurn, combatActive: combat.active, weapons };
  }, [map, selectedTokenId, currentCharacterId, role, sheet]);

  if (!info) return null;
  const { token, turn, controlled, inTurn, combatActive, weapons } = info;

  const targetName = map?.tokens.find((t) => t.id === targetTokenId)?.name;

  const canSpend = (slot: ActionCost, actionId: string) => {
    if (!controlled) return false;
    if (!combatActive) return true;
    if (!inTurn || !turn) return false;
    if (actionId === 'attack') return turn.attacksRemaining > 0 || actionSlotAvailable(turn, slot);
    return actionSlotAvailable(turn, slot);
  };

  const actionTotal = turn ? 1 + turn.extraActions : 0;
  const actionRemaining = turn ? (turn.actionUsed ? 0 : 1) + turn.extraActions : 0;
  const bonusTotal = turn ? 1 + turn.extraBonusActions : 0;
  const bonusRemaining = turn ? (turn.bonusActionUsed ? 0 : 1) + turn.extraBonusActions : 0;
  const reactionTotal = turn ? 1 : 0;
  const reactionRemaining = turn ? (turn.reactionUsed ? 0 : 1) : 0;
  const moveLeft = turn ? turn.movementMax - turn.movementUsed : 0;

  const fire = (actionId: string, slot: ActionCost, attackIndex?: number) => {
    runAction(token.id, actionId, {
      targetIds: targetTokenId ? [targetTokenId] : undefined,
      attackIndex,
      slot,
    });
  };

  const renderButtons = (slot: ActionCost) => {
    const buttons: ReactNode[] = [];
    const hasAttack = BASE_ACTIONS.some((a) => a.id === 'attack' && a.costs.includes(slot));
    if (hasAttack) {
      const enabled = canSpend(slot, 'attack');
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
              disabled={!enabled}
              onClick={() => fire('attack', slot, index)}
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
          disabled={!canSpend(slot, a.id)}
          onClick={() => fire(a.id, slot)}
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
    if (buttons.length === 0) return <span className="ap-empty">Нет</span>;
    return buttons;
  };

  return (
    <div className={`action-panel${!controlled ? ' ap-locked' : ''}`}>
      <div className="ap-head">
        <span className="ap-token">{token.name}</span>
        {targetName && <span className="ap-target">Цель: {targetName}</span>}
        {combatActive && turn ? (
          <span className="ap-counters">
            <span className="ap-counter" title="Реакция">
              Реакция <Dots total={reactionTotal} remaining={reactionRemaining} tone="reaction" />
            </span>
            {turn.attacksRemaining > 0 && (
              <span className="ap-counter" title="Осталось атак в действии «Атака»">
                Атаки <Dots total={turn.attacksRemaining} remaining={turn.attacksRemaining} tone="attack" />
              </span>
            )}
            <span className={`ap-counter move${moveLeft < 0 ? ' over' : ''}`} title="Осталось передвижения">
              {moveLeft} фт
            </span>
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
      </div>
    </div>
  );
}
