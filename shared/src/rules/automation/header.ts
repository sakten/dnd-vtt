import type { AutomationDef, GrantedAction } from '../../domain/automation';
import type { ConditionKey, DirectionKey, EffectDuration } from '../../domain/effects';
import { AUTOMATION_ACTIONS } from '../automationActions';

export { AUTOMATION_ACTIONS };

/**
 * Ручное заклинание «ведёт мастер» (решение владельца): каст вешает только плашку
 * состояния `chip` и не рисует красный маркер (Charm Monster, Compulsion).
 * `chip: null` — плашка без состояния (Enemies Abound: в RAW состояния нет).
 * `actions` — выданные действия на кастере (Compulsion: 4 направления).
 */
export function chipSpell(
  key: string,
  name: string,
  chip: ConditionKey | null,
  opts: { concentration?: boolean; range?: number; actions?: GrantedAction[] } = {}
): AutomationDef {
  return {
    key,
    name,
    resolution: 'manual',
    byDesign: true,
    ...(chip ? { chip } : {}),
    ...(opts.concentration ? { concentration: true } : {}),
    ...(opts.actions?.length ? { chipActions: opts.actions } : {}),
    targeting: { kind: 'creature', range: opts.range ?? 30 },
  };
}

/** Действие-направление Compulsion (вверх/вниз/влево/вправо): механику движения ведёт мастер. */
export function directionAction(name: string, direction: DirectionKey): GrantedAction {
  return {
    id: `direction-${direction}`,
    name,
    cost: 'bonus',
    def: {
      key: 'XPHB:Compulsion',
      name,
      resolution: 'utility',
      utility: { kind: 'direction', direction },
    },
  };
}

/**
 * Каталог автоматизации (R8.1). Ключ — `Spell.key` (или id действия для черт).
 * Строка каталога полностью описывает механику; заклинания без строки получают
 * деривацию из данных (`automationForSpell`), а невыразимые механики — `manual`.
 *
 * Для заклинаний с эффектами (Ф8) каталог проверяется раньше деривации: у Bless
 * в данных «фантомный» 1d4 из описания, у Grease урона нет вовсе.
 */

export const PERMANENT: EffectDuration = { type: 'permanent' };
export const CONCENTRATION: EffectDuration = { type: 'concentration' };
export const UNTIL_NEXT_TURN: EffectDuration = { type: 'endOfTurn', of: 'source' };

/** Явный manual-замок: отключает ложную деривацию из данных (решение владельца, класс H). */
export function manualSpell(key: string, name: string, concentration = false): AutomationDef {
  return { key, name, resolution: 'manual', ...(concentration ? { concentration: true } : {}) };
}

/** Типы существ, против которых работают Protection from Evil and Good и подобные. */
export const EVIL_GOOD_TYPES = ['aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead'];

/** Выбираемые типы урона Resistance (XPHB 2024). */
export const RESISTANCE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'radiant',
  'slashing',
  'thunder',
];