import { useCallback, useMemo, useRef } from 'react';
import type { Token } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { canControlTokenWith, characterNameOf, useIsDm } from './control';
import { visionViewers, type Viewer } from './los';

/** Подпись зрителя: позиция и сенсы — по ней стабилизируем identity массива. */
function viewerSignature(v: Viewer): string {
  return `${v.x},${v.y}:${(v.senses ?? []).map((s) => `${s.type}${s.range}`).join('+')}`;
}

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
  const list = useMemo(() => {
    if (!map || isDm) return null;
    return visionViewers(map.tokens, map.vision.los, ownToken);
  }, [map, isDm, ownToken]);
  const key = useMemo(() => (list ? list.map(viewerSignature).join(';') : null), [list]);
  // Стабильная identity: пока состав/позиции/сенсы зрителей те же, отдаём тот же массив —
  // иначе любой патч карты дёргает зависящие мемо (вуаль, чипы).
  const cache = useRef<{ key: string | null; list: Viewer[] | null }>({ key: null, list: null });
  if (cache.current.key !== key) cache.current = { key, list };
  return cache.current.list;
}
