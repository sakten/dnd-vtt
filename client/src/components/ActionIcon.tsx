import type { ReactNode } from 'react';

/** Простые линейные иконки базовых действий (наследуют цвет через currentColor). */
const ICONS: Record<string, ReactNode> = {
  // Атака — прицел
  attack: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  // Маленький меч (бейдж атаки)
  sword: (
    <>
      <path d="M12 3l2 3v8h-4V6z" />
      <path d="M8 14h8" />
      <path d="M11 14v5h2v-5" />
    </>
  ),
  // Рывок — двойная стрелка
  dash: (
    <>
      <path d="M11 5l7 7-7 7" />
      <path d="M4 5l7 7-7 7" />
    </>
  ),
  // Отход — уход из боя
  disengage: (
    <>
      <path d="M19 5v14M15 5h4" />
      <path d="M14 12H4M8 8l-4 4 4 4" />
    </>
  ),
  // Уклонение — щит
  dodge: <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
  // Помощь — союзник с плюсом
  help: (
    <>
      <circle cx="8" cy="7" r="3.5" />
      <path d="M2.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M18 7v6M15 10h6" />
    </>
  ),
  // Скрыться — перечёркнутый глаз
  hide: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 4l16 16" />
    </>
  ),
  // Готовность — часы
  ready: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  // Поиск — лупа
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l5 5" />
    </>
  ),
  // Использовать предмет — коробка
  useObject: (
    <>
      <path d="M3 8l9-4 9 4v8l-9 4-9-4z" />
      <path d="M3 8l9 4 9-4M12 12v8" />
    </>
  ),
  // Захват — сжимающая рука
  grapple: (
    <>
      <path d="M7 13V9a2 2 0 0 1 4 0v3" />
      <path d="M11 12V6a2 2 0 0 1 4 0v6" />
      <path d="M15 12a2 2 0 0 1 4 0v3a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-2a2 2 0 0 1 4 0" />
    </>
  ),
  // Толчок — раздвигающиеся стрелки
  shove: (
    <>
      <path d="M12 4v16" />
      <path d="M7 9l-4 3 4 3M17 9l4 3-4 3" />
    </>
  ),
  // Безоружный удар — кулак
  unarmedStrike: (
    <>
      <path d="M6 11V9.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M9 11V8.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V8.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V9.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M6 11h12v2a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" />
    </>
  ),
};

export default function ActionIcon({ id, className }: { id: string; className?: string }) {
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
      {ICONS[id] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
