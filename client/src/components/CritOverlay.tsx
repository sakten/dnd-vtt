import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { useGameStore } from '../store/useGameStore';

const ThreeD20 = lazy(() => import('./ThreeD20'));

const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

export default function CritOverlay() {
  const critHit = useGameStore((s) => s.critHit);
  const [shownId, setShownId] = useState<string | null>(null);

  useEffect(() => {
    if (!critHit) return;
    setShownId(critHit.id);
    const timer = window.setTimeout(() => setShownId(null), 2900);
    return () => window.clearTimeout(timer);
  }, [critHit]);

  if (!critHit || shownId !== critHit.id) return null;

  return (
    <div className="crit-overlay" key={critHit.id}>
      <div className="crit-glow" />
      <Suspense fallback={null}>
        <ThreeD20 />
      </Suspense>
      <div className="crit-burst" />
      {SPARKS.map((angle) => (
        <span
          key={angle}
          className="crit-spark"
          style={{ '--a': `${angle}deg` } as CSSProperties}
        />
      ))}
      <div className="crit-caption">
        <div className="crit-title">КРИТ!</div>
        <div className="crit-sub">
          {critHit.author}
          {critHit.label ? ` — ${critHit.label}` : ''}
        </div>
      </div>
    </div>
  );
}
