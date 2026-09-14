import { interactionTokenId } from '../domain/interaction';
import type { GameState } from './types';

/** Поля UI-состояния, сбрасываемые при смене карты/комнаты и по Esc. */
export const UI_RESET: Partial<GameState> = {
  selectedTokenId: null,
  tokenMenuId: null,
  draggingTokenId: null,
  interaction: null,
  hoverTokenId: null,
};

/** Сброс ссылок на удалённый токен (во всех режимах выбора/перетаскивания). */
export function clearTokenUiFor(s: GameState, id: string): Partial<GameState> {
  return {
    selectedTokenId: s.selectedTokenId === id ? null : s.selectedTokenId,
    interaction: interactionTokenId(s.interaction) === id ? null : s.interaction,
    hoverTokenId: s.hoverTokenId === id ? null : s.hoverTokenId,
    draggingTokenId: s.draggingTokenId === id ? null : s.draggingTokenId,
    tokenMenuId: s.tokenMenuId === id ? null : s.tokenMenuId,
  };
}
