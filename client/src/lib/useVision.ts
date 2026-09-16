import { useCallback, useMemo } from 'react';
import type { Token } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { canControlTokenWith, characterNameOf, useIsDm } from './control';
import { visionViewers, type Viewer } from './los';

/** Зрители обзора текущего игрока (null у DM): свои токены либо объединение токенов игроков. */
export function useVisionViewers(): Viewer[] | null {
  const isDm = useIsDm();
  const map = useActiveMap();
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const selfName = useGameStore((s) => (s.currentCharacterId ? characterNameOf(s, s.currentCharacterId) : ''));
  const selfId = useGameStore((s) => s.selfId);
  const role = useGameStore((s) => s.role);
  const testMode = useGameStore((s) => s.testMode);
  const ownToken = useCallback(
    (t: Token) => canControlTokenWith({ role, testMode, selfId, currentCharacterId }, t, selfName),
    [role, testMode, selfId, currentCharacterId, selfName]
  );
  return useMemo(() => {
    if (!map || isDm) return null;
    return visionViewers(map.tokens, map.vision.los, ownToken);
  }, [map, isDm, ownToken]);
}
