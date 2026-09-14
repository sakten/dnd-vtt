import type { GameState } from './types';

/** Поля UI-состояния, сбрасываемые при смене карты/комнаты и по Esc. */
export const UI_RESET: Partial<GameState> = {
  selectedTokenId: null,
  tokenMenuId: null,
  draggingTokenId: null,
  targeting: null,
  aim: null,
  multiTarget: null,
  hoverTokenId: null,
};

/** Сброс ссылок на удалённый токен (во всех режимах выбора/перетаскивания). */
export function clearTokenUiFor(s: GameState, id: string): Partial<GameState> {
  return {
    selectedTokenId: s.selectedTokenId === id ? null : s.selectedTokenId,
    targeting: s.targeting?.tokenId === id ? null : s.targeting,
    aim: s.aim?.tokenId === id ? null : s.aim,
    multiTarget: s.multiTarget?.tokenId === id ? null : s.multiTarget,
    hoverTokenId: s.hoverTokenId === id ? null : s.hoverTokenId,
    draggingTokenId: s.draggingTokenId === id ? null : s.draggingTokenId,
    tokenMenuId: s.tokenMenuId === id ? null : s.tokenMenuId,
  };
}
