import type { AutomationDef } from 'shared';

/**
 * Терминальная ветка исполнителя (R16). Порядок веток — контракт автоматизации:
 * его фиксируют тесты `dispatch.test.ts`, менять — только сознательно
 * (миграция на `AutomationSpec` обязана сохранить выбор ветки).
 */
export type DispatchKind =
  | 'utility'
  | 'summon'
  | 'effect'
  | 'lifeTransfer'
  | 'attack'
  | 'healOrDamage'
  | 'save'
  | 'auto'
  | 'manual'
  | 'multi'
  | 'single';

export interface DispatchInput {
  /** Есть ли статы кастера: без них ветки attack/save недостижимы. */
  hasStats: boolean;
  /** Разрешилось ли выражение урона/лечения: нет — manual-сообщение. */
  hasExpression: boolean;
}

/**
 * Выбор ветки `executeAutomation`:
 * utility → summon → effect → lifeTransfer → attack → healOrDamage → save → auto → manual → multi → single.
 * До диспетчера идут общие стадии: сбор целей, гейт фамильяра, fx, снятие старой
 * концентрации, создание зоны, self-эффекты (кроме `selfOnFail`) и якорь зоны.
 */
export function dispatchKind(def: AutomationDef, input: DispatchInput): DispatchKind {
  if (def.resolution === 'utility' && def.utility) return 'utility';
  if (def.resolution === 'summon' && def.summon) return 'summon';
  if (def.resolution === 'effect' && def.effects?.length) return 'effect';
  if (def.lifeTransfer) return 'lifeTransfer';
  if (def.attack && input.hasStats) return 'attack';
  if (def.save && input.hasStats && def.heal && def.damage) return 'healOrDamage';
  if (def.save && input.hasStats) return 'save';
  if (!def.save && !def.attack && def.effects?.length) return 'auto';
  if (!input.hasExpression) return 'manual';
  if (def.targets) return 'multi';
  return 'single';
}
