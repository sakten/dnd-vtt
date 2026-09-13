import type { ConditionKey } from 'shared';

/**
 * Линейные SVG-глифы состояний (viewBox 24×24, stroke=currentColor).
 * Используются, когда у состояния нет `sourceKey` заклинания.
 */

const PATHS: Record<ConditionKey, string> = {
  blinded: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z M4 4l16 16',
  charmed: 'M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z',
  deafened: 'M8 20a3 3 0 0 0 3-3v-1a4 4 0 1 0-8 0 M15 6a5 5 0 0 1 4 8 M17 3a9 9 0 0 1 5 8',
  exhaustion: 'M13 2 4 14h6l-1 8 9-12h-6z',
  frightened: 'M12 3l9 16H3z M12 9v4 M12 16h.01',
  grappled: 'M9 8a3 3 0 1 1 6 0v3a3 3 0 1 1-6 0z M6 13a3 3 0 1 1 6 0v3a3 3 0 1 1-6 0z',
  incapacitated: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M6 6l12 12',
  invisible: 'M12 4a10 10 0 0 0 0 16 10 10 0 0 0 0-16z M12 9a3 3 0 0 0 0 6',
  paralyzed: 'M4 12h3l2-4 2 8 2-4h7',
  petrified: 'M12 3l7 6-7 12L5 9z M9 10h6',
  poisoned: 'M12 3s6 6.5 6 10.5a6 6 0 1 1-12 0C6 9.5 12 3 12 3z M9 14h6',
  prone: 'M4 16h16 M12 4v8 M8 9l4 4 4-4',
  restrained: 'M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v9H5z M12 15v2',
  stunned: 'M12 3l2.2 5.3L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.8-.7z',
  unconscious: 'M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z M13 9h5l-5 5h5',
  dead: 'M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3 6v3h10v-3c1.5-1 3-3 3-6a8 8 0 0 0-8-8z M9 10h.01 M15 10h.01 M10 15h4',
  custom: 'M12 3l2.2 5.3L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.8-.7z',
};

export default function ConditionIcon({ condition, className }: { condition: ConditionKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[condition] ?? PATHS.custom} />
    </svg>
  );
}
