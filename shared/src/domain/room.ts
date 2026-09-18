import type { ChatMessage } from './chat';
import type { Role } from './core';
import type { DiceRollResult } from '../dice';
import type { Scene } from './scene';
import type { LibraryItem } from './token';

export interface Player {
  id: string;
  name: string;
  role: Role;
  isConnected: boolean;
  hpCurrent?: number | null;
  hpMax?: number | null;
  classKey?: string | null;
  /** Шанс 0–100 показать анимацию d20 при своих атаках и проверках. */
  rollAnimChance?: number;
}

/** Показ анимации броска: значение d20 уходит бросающему игроку. */
export interface RollAnimPayload {
  id: string;
  roll: DiceRollResult;
}

export interface RoomState {
  code: string;
  name: string;
  scene: Scene;
  library: LibraryItem[];
  players: Player[];
  chat: ChatMessage[];
  controllers: Record<string, string>;
  /** Режим тестов: все игроки получают права ведущего внутри комнаты. */
  testMode: boolean;
}
