import type { WallsMode } from '../store/types';

/**
 * Шаг Escape в режиме «Стены»: при начатой цепочке первое нажатие её завершает,
 * следующее — выходит из режима. Вне режима — null (решают другие обработчики).
 */
export function wallsEscapeStep(mode: Pick<WallsMode, 'active' | 'start'>): 'finish-chain' | 'exit' | null {
  if (!mode.active) return null;
  return mode.start ? 'finish-chain' : 'exit';
}
