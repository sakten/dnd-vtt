import type { ReactNode } from 'react';
import ActionIcon from './ActionIcon';

/**
 * Уникальные иконки классовых/подклассовых способностей (R8.8).
 * Ключ — `ActionDef.id` (`class:<ключ черты>`); fallback — общие глифы `ActionIcon`.
 * Наполняется партиями по классам; deploy-тест следит за покрытием.
 */
export const FEATURE_ICONS: Record<string, ReactNode> = {
  // Варвар
  'class:barbarian:rage': (
    <>
      <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1.5.6-2.6 1.4-3.6.3 1 .9 1.6 1.6 2C11 7.5 12 5.5 12 3z" />
      <path d="M12 21a6 6 0 0 0 6-6c0-1.5-.4-2.7-1-3.8" />
      <path d="M6 11c-.6 1.1-1 2.3-1 3.8a7 7 0 0 0 7 7" />
    </>
  ),
  'class:barbarian:recklessAttack': (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),

  // Воин
  'class:fighter:secondWind': (
    <>
      <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" />
      <path d="M12 8v6M9 11h6" />
    </>
  ),
  'class:fighter:actionSurge': <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  'class:fighter:indomitable': (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M12 7.5l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z" />
    </>
  ),
  'class:fighter.battleMaster:superiorityDice/maneuver': (
    <>
      <rect x="3" y="5" width="12" height="12" rx="2" />
      <circle cx="7" cy="9" r="1" />
      <circle cx="11" cy="13" r="1" />
      <path d="M17 7a6 6 0 0 1 0 12" />
      <path d="M15 19h4v-4" />
    </>
  ),
  'class:fighter.battleMaster:knowYourEnemy': (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
    </>
  ),
  'class:fighter.psiWarrior:psiPoweredLeap': (
    <>
      <path d="M12 20V6" />
      <path d="M7 11l5-5 5 5" />
      <path d="M4 20c3-2 13-2 16 0" />
    </>
  ),
  'class:fighter.psiWarrior:psionicStrike': (
    <>
      <path d="M12 3v10" />
      <path d="M7 8l5-5 5 5" />
      <path d="M4 16c2 2 4 3 8 3s6-1 8-3" />
      <path d="M7 20c1.5.8 3.2 1.2 5 1.2s3.5-.4 5-1.2" />
    </>
  ),
  'class:fighter.arcaneArcher:arcaneShot': (
    <>
      <path d="M5 4a15 15 0 0 1 15 15" />
      <path d="M5 4v15" />
      <path d="M5 19L19 5" />
      <path d="M14 5h5v5" />
    </>
  ),
  'class:fighter.cavalier:unwaveringMark': (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <circle cx="12" cy="11" r="2.5" />
      <path d="M12 7v2M12 13v2M8 11h2M14 11h2" />
    </>
  ),
  'class:fighter.cavalier:wardingManeuver': (
    <>
      <path d="M10 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M15 14l6 6M21 14l-6 6" />
    </>
  ),
  'class:fighter.samurai:fightingSpirit': (
    <>
      <path d="M4 14a8 8 0 0 1 16 0v3H4z" />
      <path d="M12 6v5" />
      <path d="M8 17v2M16 17v2" />
    </>
  ),
  'class:fighter.runeKnight:giantsMight': (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M9 7v10M15 7v10M9 12h6" />
    </>
  ),
  'class:fighter.runeKnight:runicShield': (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M10 8v6M14 8v6M10 11h4" />
    </>
  ),

  // Подклассы варвара
  'class:barbarian.zealot:zealousPresence': (
    <>
      <circle cx="12" cy="9" r="3" />
      <path d="M6 20a6 6 0 0 1 12 0" />
      <path d="M12 2v3M4 9H1M23 9h-3M5.6 3.6l2 2M18.4 3.6l-2 2" />
    </>
  ),
  'class:barbarian.ancestralGuardian:consultTheSpirits': (
    <>
      <path d="M12 4a6 6 0 0 1 6 6v9l-2-1.8-2 1.8-2-1.8-2 1.8-2-1.8-2 1.8v-9a6 6 0 0 1 6-6z" />
      <circle cx="10" cy="10" r="1" />
      <circle cx="14" cy="10" r="1" />
    </>
  ),
  'class:barbarian.beast:infectiousFury': (
    <>
      <path d="M5 4c4 4 6 10 6 16" />
      <path d="M11 3c3 4 5 10 5 17" />
      <path d="M17 3c2 4 3 9 3 15" />
    </>
  ),
  'class:barbarian.wildMagic:bolsteringMagic': (
    <>
      <path d="M11 3l1.7 4.3L17 9l-4.3 1.7L11 15l-1.7-4.3L5 9l4.3-1.7z" />
      <path d="M18 14v6M15 17h6" />
    </>
  ),
};

export function hasFeatureIcon(id: string): boolean {
  return id in FEATURE_ICONS;
}

export default function FeatureIcon({
  id,
  fallback,
  className,
}: {
  id: string;
  fallback?: string;
  className?: string;
}) {
  const icon = FEATURE_ICONS[id];
  if (!icon) return <ActionIcon id={fallback ?? 'spark'} className={className} />;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}
