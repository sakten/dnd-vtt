export interface ScreenPoint {
  x: number;
  y: number;
}

export interface StageView {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/** Экранные координаты указателя → мировые координаты стола. */
export function screenToWorld(pointer: ScreenPoint, view: StageView): ScreenPoint {
  return {
    x: (pointer.x - view.x) / view.scaleX,
    y: (pointer.y - view.y) / view.scaleY,
  };
}

export type TokenClickMode = 'ignore' | 'target' | 'multi' | 'scatter' | 'aim' | 'select';

export interface TokenClickState {
  wallsMode: { active: boolean };
  lightMode: { active: boolean };
  interaction: { mode?: string; scatter?: { phase: string } } | null;
}

/** Что делает клик по токену в текущем режиме инструмента/прицеливания. */
export function tokenClickMode(state: TokenClickState): TokenClickMode {
  if (state.wallsMode.active || state.lightMode.active) return 'ignore';
  const mode = state.interaction?.mode;
  if (mode === 'target') return 'target';
  if (mode === 'multi') return 'multi';
  if (mode === 'scatter') return 'scatter';
  if (mode === 'aim') return 'aim';
  return 'select';
}

export interface TokenDragState {
  lockedByOther: boolean;
  moving: boolean;
  fogActive: boolean;
  lightActive: boolean;
  wallsActive: boolean;
  targeting: boolean;
  aim: boolean;
  multiTarget: boolean;
  scatter: boolean;
  canMove: boolean;
  isDm: boolean;
  movementBlocked: boolean;
}

/** Можно ли тащить токен: права, занятость, инструменты и режимы прицеливания. */
export function canDragToken(state: TokenDragState): boolean {
  return (
    !state.lockedByOther &&
    !state.moving &&
    !state.fogActive &&
    !state.lightActive &&
    !state.wallsActive &&
    !state.targeting &&
    !state.aim &&
    !state.multiTarget &&
    !state.scatter &&
    state.canMove &&
    (state.isDm || !state.movementBlocked)
  );
}
