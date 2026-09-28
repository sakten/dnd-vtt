import type { AutomationDef, AutomationEffect, AutomationSave, GrantedAction } from '../../domain/automation';
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

/** Выданное действие «Перенести метку» (Hex/Hunter's Mark): только после смерти текущей цели. */
export function remarkAction(spellKey: string, name: string): GrantedAction {
  return {
    id: 'remark',
    name: 'Перенести метку',
    cost: 'bonus',
    def: {
      key: spellKey,
      name,
      resolution: 'manual',
      retarget: true,
      targeting: { kind: 'creature', range: 90 },
    },
  };
}

/** Выданное зоной действие перемещения (Moonbeam 60, Flaming Sphere 30, Faithful Hound 30). */
export function zoneMoveAction(name: string, cost: 'action' | 'bonus', feet: number): GrantedAction {
  return {
    id: 'move',
    name,
    cost,
    def: {
      key: 'zone:move',
      name,
      resolution: 'utility',
      utility: { kind: 'moveZone', amount: feet },
      targeting: { kind: 'point', range: feet },
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

/** Web: опутан, пока в паутине; выпутывание — STR (Athletics) против СЛ каста. */
export const WEB_RESTRAINED: AutomationEffect = {
  name: 'Web',
  duration: PERMANENT,
  to: 'targets',
  modifiers: [],
  conditions: ['restrained'],
  escape: { ability: 'str', skill: 'athletics' },
};

/** Chill Touch: цель не восстанавливает HP до конца следующего хода кастера. */
export const CHILL_TOUCH: AutomationEffect = {
  name: 'Chill Touch',
  duration: UNTIL_NEXT_TURN,
  to: 'targets',
  modifiers: [],
  noHeal: true,
};

/** Строка каталога «заклинание с накладываемыми эффектами». */
export function spellEffect(
  key: string,
  name: string,
  effects: AutomationEffect[],
  save?: { ability: AutomationSave['ability']; half?: boolean }
): AutomationDef {
  return {
    key,
    name,
    resolution: 'effect',
    concentration: effects.some((e) => e.concentration) || undefined,
    save,
    effects,
  };
}

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