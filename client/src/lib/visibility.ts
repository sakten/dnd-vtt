import { useMemo } from 'react';
import { hasCondition, seesInvisible, sideMatches, type Token } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { canControlTokenWith, characterNameOf } from './control';

/** Невидимость токена: условие `invisible` (заклинание или ручной чип DM). */
export function tokenInvisible(token: Pick<Token, 'conditions'>): boolean {
  return hasCondition(token.conditions, 'invisible');
}

export interface InvisibilityView {
  /** Токены, скрытые невидимостью от текущего зрителя (карта и чипы скрываются). */
  hidden: Set<string>;
  /** Из скрытых — не союзные: в трекере инициативы иконка заменяется на «?». */
  masked: Set<string>;
}

/** Скрытые невидимостью токены для зрителя: `mine` — его контролируемые токены. */
export function invisibilityViewFor(tokens: Token[], mine: Token[], isDm: boolean): InvisibilityView {
  const hidden = new Set<string>();
  const masked = new Set<string>();
  const mySeesInvisible = mine.some((t) => seesInvisible(t.effects));
  for (const token of tokens) {
    if (!tokenInvisible(token)) continue;
    if (isDm || mine.some((m) => m.id === token.id) || mySeesInvisible) continue;
    hidden.add(token.id);
    if (!mine.some((m) => sideMatches(m, token, 'ally'))) masked.add(token.id);
  }
  return { hidden, masked };
}

/**
 * Кто скрыт невидимостью для текущего пользователя: DM и контролёр видят токен
 * полупрозрачным, носитель See Invisibility — обычных невидимых. Союзников
 * в трекере не маскируем (только «?» для врагов и нейтралов).
 */
export function useInvisibilityView(): InvisibilityView {
  const tokens = useActiveMap()?.tokens;
  const role = useGameStore((s) => s.role);
  const testMode = useGameStore((s) => s.testMode);
  const selfId = useGameStore((s) => s.selfId);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);

  return useMemo(() => {
    if (!tokens?.length) return { hidden: new Set<string>(), masked: new Set<string>() };
    const charName = characterNameOf(useGameStore.getState(), currentCharacterId);
    const controlState = { role, testMode, selfId, currentCharacterId };
    const mine = tokens.filter((t) => canControlTokenWith(controlState, t, charName));
    return invisibilityViewFor(tokens, mine, role === 'dm' || testMode);
  }, [tokens, role, testMode, selfId, currentCharacterId]);
}
