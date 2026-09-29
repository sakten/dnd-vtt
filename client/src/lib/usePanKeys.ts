import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';

/** Скорость панорамирования WASD: экранные пиксели в секунду. */
export const PAN_SPEED = 700;

const DIRS: Record<string, { x: number; y: number }> = {
  KeyW: { x: 0, y: 1 },
  KeyS: { x: 0, y: -1 },
  KeyA: { x: 1, y: 0 },
  KeyD: { x: -1, y: 0 },
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true);
}

/** WASD двигает камеру стола; не срабатывает при вводе текста и с модификаторами. */
export function usePanKeys() {
  const heldRef = useRef(new Set<string>());

  useEffect(() => {
    const held = heldRef.current;
    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      if (held.size === 0) {
        raf = 0;
        return;
      }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      let dx = 0;
      let dy = 0;
      for (const code of held) {
        const dir = DIRS[code];
        if (!dir) continue;
        dx += dir.x;
        dy += dir.y;
      }
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        const { view, setView } = useGameStore.getState();
        setView({
          ...view,
          x: view.x + (dx / len) * PAN_SPEED * dt,
          y: view.y + (dy / len) * PAN_SPEED * dt,
        });
      }
      raf = requestAnimationFrame(step);
    };
    const down = (e: KeyboardEvent) => {
      if (!(e.code in DIRS) || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      held.add(e.code);
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
    };
    const up = (e: KeyboardEvent) => held.delete(e.code);
    const clear = () => held.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      held.clear();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
