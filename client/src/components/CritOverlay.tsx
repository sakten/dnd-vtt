import { useEffect, useState, type CSSProperties } from 'react';
import { useGameStore } from '../store/useGameStore';

const D20_POINTS = '0,-14 12,-7 12,7 0,14 -12,7 -12,-7';
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

export default function CritOverlay() {
  const critHit = useGameStore((s) => s.critHit);
  const [shownId, setShownId] = useState<string | null>(null);

  useEffect(() => {
    if (!critHit) return;
    setShownId(critHit.id);
    const timer = window.setTimeout(() => setShownId(null), 2700);
    return () => window.clearTimeout(timer);
  }, [critHit]);

  if (!critHit || shownId !== critHit.id) return null;

  return (
    <div className="crit-overlay" key={critHit.id}>
      <div className="crit-glow" />
      <div className="crit-die">
        <svg className="crit-die-svg" viewBox="-16 -16 32 32">
          <polygon className="crit-die-face" points={D20_POINTS} />
          <text className="crit-die-num" x="0" y="5" textAnchor="middle">
            20
          </text>
        </svg>
      </div>
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
