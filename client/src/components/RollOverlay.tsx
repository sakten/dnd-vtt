import { lazy, Suspense, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { rollAnimMs } from '../lib/rollAnimTiming';

const ThreeD20 = lazy(() => import('./ThreeD20'));

/**
 * Анимация броска d20: показывается бросающему по личному шансу.
 * Ничего не блокирует — кубик катится поверх стола и исчезает.
 */
export default function RollOverlay() {
  const anim = useGameStore((s) => s.rollAnim);
  const clearRollAnim = useGameStore((s) => s.clearRollAnim);

  useEffect(() => {
    if (!anim) return;
    // С преимуществом/помехой анимация длиннее: пауза, «пульс» взятого и растворение отброшенного.
    const timer = window.setTimeout(() => clearRollAnim(), rollAnimMs(anim.dice));
    return () => window.clearTimeout(timer);
  }, [anim, clearRollAnim]);

  if (!anim) return null;
  return (
    <div className="roll-anim-overlay" data-testid="roll-overlay" key={anim.id}>
      <Suspense fallback={null}>
        <ThreeD20 variant="roll" rolls={anim.dice} />
      </Suspense>
    </div>
  );
}
