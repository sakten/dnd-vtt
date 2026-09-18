import { DEFAULT_SPEED } from '../domain/core';
import { emptyCombatState, emptyTurnState } from '../domain/combat';
import type { CombatState, InitiativeEntry, TurnState } from '../domain/combat';
import { clampInt } from './internal';

export function normalizeTurnState(raw: unknown, movementMax = DEFAULT_SPEED): TurnState {
  const base = emptyTurnState(movementMax);
  if (!raw || typeof raw !== 'object') return base;
  const t = raw as Partial<TurnState>;
  const cooldowns: Record<string, number> = {};
  if (t.abilityCooldowns && typeof t.abilityCooldowns === 'object') {
    for (const [key, value] of Object.entries(t.abilityCooldowns)) {
      const n = clampInt(value, 0, 20, 0);
      if (key && n > 0) cooldowns[key] = n;
    }
  }
  return {
    actionUsed: t.actionUsed === true,
    bonusActionUsed: t.bonusActionUsed === true,
    reactionUsed: t.reactionUsed === true,
    movementUsed: clampInt(t.movementUsed, 0, 100000, 0),
    diagonalsUsed: clampInt(t.diagonalsUsed, 0, 100000, 0),
    movementMax: clampInt(t.movementMax, 0, 100000, movementMax),
    extraActions: clampInt(t.extraActions, 0, 99, 0),
    extraBonusActions: clampInt(t.extraBonusActions, 0, 99, 0),
    attacksRemaining: clampInt(t.attacksRemaining, 0, 99, 0),
    flurryAttacks: clampInt(t.flurryAttacks, 0, 99, 0),
    legendaryRemaining: clampInt(t.legendaryRemaining, 0, 99, 0),
    legendaryMax: clampInt(t.legendaryMax, 0, 99, 0),
    disengaged: t.disengaged === true,
    movementOnly: t.movementOnly === true,
    concentrationId: typeof t.concentrationId === 'string' && t.concentrationId ? t.concentrationId : null,
    ...(Object.keys(cooldowns).length ? { abilityCooldowns: cooldowns } : {}),
  };
}

export function normalizeCombatState(raw: unknown): CombatState {
  if (!raw || typeof raw !== 'object') return emptyCombatState();
  const c = raw as Partial<CombatState>;
  const entries = Array.isArray(c.entries) ? (c.entries as InitiativeEntry[]) : [];
  const turns: Record<string, TurnState> = {};
  if (c.turns && typeof c.turns === 'object') {
    for (const [id, turn] of Object.entries(c.turns)) turns[id] = normalizeTurnState(turn);
  }
  const moveQueue = Array.isArray(c.moveQueue)
    ? c.moveQueue.filter((id): id is string => typeof id === 'string')
    : undefined;
  return {
    active: c.active === true,
    entries,
    round: clampInt(c.round, 0, 100000, 0),
    currentIndex: entries.length ? clampInt(c.currentIndex, -1, entries.length - 1, -1) : -1,
    turns,
    ...(moveQueue?.length ? { moveQueue } : {}),
    ...(typeof c.moveReturn === 'string' && c.moveReturn ? { moveReturn: c.moveReturn } : {}),
  };
}
