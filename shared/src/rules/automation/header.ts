import type { EffectDuration } from '../../domain/effects';
import { AUTOMATION_ACTIONS } from '../automationActions';

export { AUTOMATION_ACTIONS };

export const PERMANENT: EffectDuration = { type: 'permanent' };
export const CONCENTRATION: EffectDuration = { type: 'concentration' };
export const UNTIL_NEXT_TURN: EffectDuration = { type: 'endOfTurn', of: 'source' };

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