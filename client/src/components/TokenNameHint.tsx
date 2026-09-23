import { useEffect, useLayoutEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { activeMapOf } from '../store/selectors';

/**
 * Подсказка с именем токена у курсора при наведении. Показывается, только
 * когда ничего не происходит (нет прицеливания/движения/кистей) — чтобы не
 * мешать выбору цели и работе инструментов.
 */
export default function TokenNameHint() {
  const hoverId = useGameStore((s) => s.hoverTokenId);
  const busy = useGameStore(
    (s) =>
      s.interaction !== null ||
      s.draggingTokenId !== null ||
      s.fogMode.active ||
      s.wallsMode.active ||
      s.lightMode.active
  );
  const name = useGameStore((s) => {
    if (!s.hoverTokenId) return null;
    return activeMapOf(s)?.tokens.find((t) => t.id === s.hoverTokenId)?.name ?? null;
  });
  const ref = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      const el = ref.current;
      if (el) el.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`;
    };
    window.addEventListener('mousemove', move, { passive: true });
    return () => window.removeEventListener('mousemove', move);
  }, []);

  const visible = !!hoverId && !busy && !!name;
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.style.transform = `translate(${posRef.current.x + 14}px, ${posRef.current.y + 16}px)`;
  }, [visible]);

  if (!visible) return null;
  return (
    <div ref={ref} className="token-name-hint" data-testid="token-name-hint">
      {name}
    </div>
  );
}
