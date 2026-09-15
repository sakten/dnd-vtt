import type { DiceRollResult } from '../dice';
import { DEFAULT_SPEED } from './core';

export interface InitiativeEntry {
  id: string;
  tokenId: string | null;
  name: string;
  imageUrl: string;
  initiative: number;
  bonus: string;
  roll?: DiceRollResult;
}

/** Состояние хода одного участника боя. */
export interface TurnState {
  actionUsed: boolean;
  bonusActionUsed: boolean;
  reactionUsed: boolean;
  /** Израсходовано передвижения, футы. */
  movementUsed: number;
  /** Диагональных шагов за ход (для чередования стоимости диагоналей 5/10 фт). */
  diagonalsUsed: number;
  /** Доступно передвижения в этом ходу, футы. */
  movementMax: number;
  /** Доп. действия/бонусные от эффектов (например, Haste). */
  extraActions: number;
  extraBonusActions: number;
  /** Остаток атак в текущем действии «Атака» (Extra Attack/мультиатака). */
  attacksRemaining: number;
  /** Доп. безоружные удары бонусным действием (Шквал ударов). */
  flurryAttacks: number;
  legendaryRemaining: number;
  legendaryMax: number;
  /** Действие «Отход»: движение в этом ходу не провоцирует атаки по возможности. */
  disengaged: boolean;
  /** id активного эффекта концентрации. */
  concentrationId: string | null;
}

export function emptyTurnState(movementMax = DEFAULT_SPEED): TurnState {
  return {
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
    diagonalsUsed: 0,
    movementMax,
    extraActions: 0,
    extraBonusActions: 0,
    attacksRemaining: 0,
    flurryAttacks: 0,
    legendaryRemaining: 0,
    legendaryMax: 0,
    disengaged: false,
    concentrationId: null,
  };
}

export interface CombatState {
  active: boolean;
  entries: InitiativeEntry[];
  /** Номер раунда, с 1; 0 — бой не начат. */
  round: number;
  /** Индекс активной записи в entries; -1 — ход не назначен. */
  currentIndex: number;
  /** Состояние хода по id записи инициативы. */
  turns: Record<string, TurnState>;
}

export function emptyCombatState(): CombatState {
  return { active: false, entries: [], round: 0, currentIndex: -1, turns: {} };
}
