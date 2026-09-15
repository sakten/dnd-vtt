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

  // Бард
  'class:bard:bardicInspiration': (
    <>
      <path d="M9 17V6l9-2v11" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="15.5" cy="15.5" r="2.5" />
      <path d="M19 5l2 2M21 10h-2" />
    </>
  ),

  // Жрец
  'class:cleric:divineSpark': (
    <>
      <path d="M12 3v4M5.6 5.6l2.8 2.8M18.4 5.6l-2.8 2.8" />
      <circle cx="12" cy="14" r="5" />
      <path d="M12 11v6M9.5 14h5" />
    </>
  ),
  'class:cleric:turnUndead': (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      <path d="M10.5 13.5l1.5 2 1.5-2" />
    </>
  ),
  'class:cleric:divineIntervention': (
    <>
      <path d="M4 6c2 1 5 1.5 8 1.5S18 7 20 6" />
      <path d="M6 6v3.5C6 12 8.5 14 12 14s6-2 6-4.5V6" />
      <path d="M12 14v5M8.5 19h7" />
      <path d="M3 4l1.5 1.5M21 4l-1.5 1.5" />
    </>
  ),
  'class:cleric.life:preserveLife': (
    <>
      <path d="M12 20s-7-4.4-7-9a3.7 3.7 0 0 1 7-1.6A3.7 3.7 0 0 1 19 11c0 4.6-7 9-7 9z" />
      <path d="M12 9.5v5M9.5 12h5" />
    </>
  ),
  'class:cleric.light:radianceOfTheDawn': (
    <>
      <path d="M4 18h16" />
      <path d="M12 3v4M5.6 6.6l2.8 2.8M18.4 6.6l-2.8 2.8" />
      <path d="M7 18a5 5 0 0 1 10 0" />
    </>
  ),
  'class:cleric.war:warPriest': (
    <>
      <path d="M12 3l5 2.5V10c0 3-2 5.5-5 7-3-1.5-5-4-5-7V5.5z" />
      <path d="M12 7v6M9.5 9h5" />
    </>
  ),

  // Монах
  'class:monk:bonusUnarmedStrike': (
    <>
      <path d="M7 11V9.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M10 11V8.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M13 11V9a1.5 1.5 0 0 1 3 0v2" />
      <path d="M7 11h9v2.5a4.5 4.5 0 0 1-4.5 4.5h-1A3.5 3.5 0 0 1 7 14.5z" />
      <path d="M19 6l1.5 1.5L22 6M19 10h3" />
    </>
  ),
  'class:monk:patientDefense': (
    <>
      <path d="M19 5v14M15 5h4" />
      <path d="M14 12H4M8 8l-4 4 4 4" />
    </>
  ),
  'class:monk:stepOfTheWind': (
    <>
      <path d="M11 5l7 7-7 7" />
      <path d="M4 5l7 7-7 7" />
    </>
  ),
  'class:monk:focus/flurryOfBlows': (
    <>
      <path d="M4 20L10 8M10 21L15 7M16 20L21 6" />
      <path d="M6 6l2 2M14 4l2 2M20 12l2 2" />
    </>
  ),
  'class:monk:focus/patientDefense': (
    <>
      <path d="M12 3l5 2.2V10c0 3.2-2.2 5.6-5 6.8-2.8-1.2-5-3.6-5-6.8V5.2z" />
      <path d="M14 12H6M9.5 8.5L6 12l3.5 3.5" />
    </>
  ),
  'class:monk:focus/stepOfTheWind': (
    <>
      <path d="M13 5l6 7-6 7" />
      <path d="M3 12h10M7 8l-4 4 4 4" />
    </>
  ),
  'class:monk.openHand:wholenessOfBody': (
    <>
      <path d="M8 13V7a1.5 1.5 0 0 1 3 0v5M11 12V6a1.5 1.5 0 0 1 3 0v6M14 12.5V9a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6h-1a5 5 0 0 1-5-5v-2" />
      <path d="M18 4v4M16 6h4" />
    </>
  ),
  'class:monk.mercy:flurryOfHealingAndHarm': (
    <>
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />
      <path d="M12 3a4.5 9 0 0 1 0 18" />
      <path d="M7 9v4M5 11h4" />
      <path d="M15 8l2 2M17 8l-2 2" />
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
