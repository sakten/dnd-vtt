import type { AreaSpec } from './actions';
import type { AutomationResolution } from './automation';

/**
 * Косметический эффект применения (заклинание, черта, способность монстра):
 * сервер рассылает один раз после применения, клиент рисует анимацию.
 * Ни на что не влияет и не попадает в персист (как `roll:anim`).
 */
export interface SpellFxPayload {
  id: string;
  mapId: string;
  /** Токен-источник: кастер заклинания/владелец способности. */
  casterId: string;
  /** Ключ автоматизации: ключ заклинания (`spell.foo`) или id действия. */
  key: string;
  name: string;
  resolution: AutomationResolution;
  /** Визуальный характер: урон, лечение или бафф без урона. */
  mode: 'damage' | 'heal' | 'buff';
  /** Тип атаки (для снаряда/удара по цели). */
  attack?: 'melee' | 'ranged';
  area?: AreaSpec;
  origin: { x: number; y: number } | null;
  direction: { x: number; y: number } | null;
  /** Цели применения (id токенов). */
  targets: string[];
  /** Типы урона (палитра эффекта). */
  types: string[];
  /** Число лучей/снарядов. */
  count: number;
  /** Эффект накладывается на кастера (Shield/Haste), а не на цели. */
  toSelf?: boolean;
  /** Область с вершиной на кастере (конус/линия/куб от себя) — без снаряда-полёта. */
  selfArea?: boolean;
}
