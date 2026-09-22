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
  /** Легендарный слот: ссылка на основную запись владельца (пул и экономика — там). */
  legendaryOwnerId?: string;
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
  /** Nick: доп. атака Light уже сделана частью действия «Атака» в этом ходу. */
  nickUsed?: boolean;
  /** Cleave: доп. атака по второй цели уже сделана в этом ходу. */
  cleaveUsed?: boolean;
  /** Cleave: цель последнего попадания оружием с «Прорубающим» (вторая — в 5 фт от неё). */
  cleaveFrom?: string;
  /** Cleave: ключ оружия последнего попадания (для кнопки «Прорубить»). */
  cleaveWeapon?: string;
  /** Ключ оружия последней оружейной атаки за ход (для Light/Nick: «другое лёгкое оружие»). */
  lastWeaponKey?: string;
  legendaryRemaining: number;
  legendaryMax: number;
  /** Действие «Отход»: движение в этом ходу не провоцирует атаки по возможности. */
  disengaged: boolean;
  /** Ход только для движения (Мантия вдохновения): действия/бонусы/реакции недоступны. */
  movementOnly: boolean;
  /** id активного эффекта концентрации. */
  concentrationId: string | null;
  /** Перезарядки способностей: id действия → осталось ходов. */
  abilityCooldowns?: Record<string, number>;
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
    movementOnly: false,
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
  /** Прерывание хода (Мантия вдохновения): очередь ходов «только движение». */
  moveQueue?: string[];
  /** id записи, чей ход продолжается после очереди движения. */
  moveReturn?: string | null;
}

export function emptyCombatState(): CombatState {
  return { active: false, entries: [], round: 0, currentIndex: -1, turns: {} };
}
