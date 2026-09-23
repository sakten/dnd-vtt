import type { AutomationDef } from '../domain/automation';

/**
 * Каталог автоматизации действий (R8.1): базовые действия и классовые/
 * подклассовые черты. Ключ — `ActionDef.id` (`dash`, `class:fighter:secondWind`).
 * Строки без реализованной механики в каталог не заводятся — такие действия
 * остаются заглушкой (сообщение в чат), чтобы не выдавать ложную автоматизацию.
 */
export const AUTOMATION_ACTIONS: Record<string, AutomationDef> = {
  dash: {
    key: 'dash',
    name: 'Рывок',
    resolution: 'utility',
    utility: { kind: 'extraMovement' },
  },
  disengage: {
    key: 'disengage',
    name: 'Отход',
    resolution: 'utility',
    utility: { kind: 'disengage' },
  },
  dodge: {
    key: 'dodge',
    name: 'Уклонение',
    resolution: 'effect',
    targeting: { kind: 'self' },
    effects: [
      {
        name: 'Уклонение',
        duration: { type: 'endOfTurn', of: 'target' },
        to: 'self',
        modifiers: [
          { target: 'attack', mode: 'disadvantage', filter: { direction: 'against' } },
          { target: 'save', mode: 'advantage', filter: { ability: 'dex' } },
        ],
      },
    ],
  },
  hide: {
    key: 'hide',
    name: 'Скрыться',
    resolution: 'utility',
    utility: { kind: 'check', ability: 'dex' },
  },
  search: {
    key: 'search',
    name: 'Поиск',
    resolution: 'utility',
    utility: { kind: 'check', ability: 'wis' },
  },
  /** Помощь: разбудить союзника/нейтрала в 5 фт (снять сонный эффект). */
  help: {
    key: 'help',
    name: 'Помощь',
    resolution: 'utility',
    utility: { kind: 'wake' },
    targeting: { kind: 'creature', range: 5 },
  },
  'class:fighter:actionSurge': {
    key: 'class:fighter:actionSurge',
    name: 'Всплеск действия',
    resolution: 'utility',
    utility: { kind: 'extraAction', amount: 1 },
  },
  'class:fighter:secondWind': {
    key: 'class:fighter:secondWind',
    name: 'Второе дыхание',
    resolution: 'auto',
    targeting: { kind: 'self' },
    heal: { dice: '1d10', classLevelBonus: { className: 'fighter' } },
  },
};
