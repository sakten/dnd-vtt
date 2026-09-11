import type { ReactNode } from 'react';

/** Иконки оружия (линейные, наследуют цвет через currentColor). */
const ICONS: Record<string, ReactNode> = {
  sword: (
    <>
      <path d="M12 2l2 4v9h-4V6z" />
      <path d="M8 15h8" />
      <path d="M11 15v4h2v-4" />
      <circle cx="12" cy="20" r="1.5" />
    </>
  ),
  axe: (
    <>
      <path d="M12 2.5v19" />
      <path d="M12 4.5C8.5 3 5 4.5 5 8s3.5 5 7 3.5" />
      <path d="M12 4.5C15.5 3 19 4.5 19 8s-3.5 5-7 3.5" />
      <path d="M10.5 20.5h3" />
    </>
  ),
  bow: (
    <>
      <path d="M16 4a10 10 0 0 0 0 16" />
      <path d="M16 4v16" />
      <path d="M3 12h16M16 9l3 3-3 3" />
    </>
  ),
  crossbow: (
    <>
      <path d="M4 12h16M9 12v4" />
      <path d="M14 5a8 8 0 0 0 0 14" />
      <path d="M14 5v14" />
    </>
  ),
  dagger: (
    <>
      <path d="M12 3l1.5 3v6h-3V6z" />
      <path d="M8.5 12h7" />
      <path d="M11 12v6h2v-6" />
    </>
  ),
  bite: (
    <>
      <path d="M2.5 6.5c3-2.5 16-2.5 19 0" />
      <path d="M2.5 17.5c3 2.5 16 2.5 19 0" />
      <path d="M6 7.2l1.8 4.3 1.8-4.3" />
      <path d="M10.6 6.3v4.6" />
      <path d="M15.2 7.2l1.8 4.3 1.8-4.3" />
      <path d="M6 16.8l1.8-4.3 1.8 4.3" />
      <path d="M10.6 17.7v-4.6" />
      <path d="M15.2 16.8l1.8-4.3 1.8 4.3" />
    </>
  ),
  claws: <path d="M7 4c-1 5 0 10 3 16M12 4c-1 5 0 10 3 16M17 4c-1 5 0 10 3 16" />,
  spit: (
    <>
      <path d="M12 3s5 6 5 10a5 5 0 0 1-10 0c0-4 5-10 5-10z" />
      <circle cx="10" cy="14" r="1" />
    </>
  ),
  fist: (
    <>
      <path d="M6 11V9.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M9 11V8.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V8.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V9.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M6 11h12v2a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" />
    </>
  ),
  default: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M12 11v10" />
    </>
  ),
};

/** Определяет тип оружия по названию (RU/EN). */
export function weaponIconId(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('арбалет') || n.includes('crossbow')) return 'crossbow';
  if (n.includes('лук') || n.includes('bow')) return 'bow';
  if (n.includes('кинжал') || n.includes('нож') || n.includes('dagger')) return 'dagger';
  if (n.includes('топор') || n.includes('секир') || n.includes('axe')) return 'axe';
  if (n.includes('когот') || n.includes('царап') || n.includes('claw')) return 'claws';
  if (n.includes('укус') || n.includes('паст') || n.includes('зуб') || n.includes('bite')) return 'bite';
  if (n.includes('плев') || n.includes('слюн') || n.includes('spit')) return 'spit';
  if (n.includes('кулак') || n.includes('безоруж') || n.includes('fist')) return 'fist';
  if (n.includes('меч') || n.includes('шпаг') || n.includes('рапир') || n.includes('сабл') || n.includes('sword')) {
    return 'sword';
  }
  return 'default';
}

/** Оружие с рукоятью/древком рисуем по диагонали (снизу-слева вверх-вправо). */
const DIAGONAL = new Set(['sword', 'axe', 'dagger', 'bow', 'crossbow', 'default']);

export default function WeaponIcon({ name, className }: { name: string; className?: string }) {
  const id = weaponIconId(name);
  const content = ICONS[id];
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
      {DIAGONAL.has(id) ? <g transform="rotate(45 12 12)">{content}</g> : content}
    </svg>
  );
}
