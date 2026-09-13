import type { ConditionKey, EffectDuration, Modifier } from '../types';

/**
 * Накладываемый заклинанием эффект (Ф8). Модификаторы без id — id присваивает
 * сервер при наложении. `to`: self — кастер, targets — выбранные цели.
 */
export interface SpellEffectDef {
  name: string;
  duration: EffectDuration;
  concentration?: boolean;
  to?: 'self' | 'targets';
  /** Максимум целей (для мультицелевых баффов/дебаффов, напр. Bless — 3). */
  targets?: number;
  modifiers: Omit<Modifier, 'id'>[];
  conditions?: ConditionKey[];
}

const PERMANENT: EffectDuration = { type: 'permanent' };
const CONCENTRATION: EffectDuration = { type: 'concentration' };
const UNTIL_NEXT_TURN: EffectDuration = { type: 'endOfTurn', of: 'source' };

/**
 * Каталог «заклинание → эффекты» (пачка 1: баффы/дебаффы без сложных триггеров).
 * Значения-формулы ('13+dex') считаются от характеристик получателя.
 */
export const SPELL_EFFECTS: Record<string, SpellEffectDef[]> = {
  'XPHB:Shield': [
    {
      name: 'Shield',
      duration: UNTIL_NEXT_TURN,
      to: 'self',
      modifiers: [{ target: 'ac', mode: 'add', value: 5 }],
    },
  ],
  'XPHB:Shield of Faith': [
    {
      name: 'Shield of Faith',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [{ target: 'ac', mode: 'add', value: 2 }],
    },
  ],
  'XPHB:Mage Armor': [
    {
      name: 'Mage Armor',
      duration: PERMANENT,
      to: 'targets',
      modifiers: [{ target: 'ac', mode: 'set', value: '13+dex' }],
    },
  ],
  'XPHB:Barkskin': [
    {
      name: 'Barkskin',
      duration: PERMANENT,
      to: 'targets',
      modifiers: [{ target: 'ac', mode: 'set', value: 17 }],
    },
  ],
  'XPHB:Longstrider': [
    {
      name: 'Longstrider',
      duration: PERMANENT,
      to: 'targets',
      modifiers: [{ target: 'speed', mode: 'add', value: 10 }],
    },
  ],
  'XPHB:Blur': [
    {
      name: 'Blur',
      duration: CONCENTRATION,
      concentration: true,
      to: 'self',
      modifiers: [{ target: 'attack', mode: 'disadvantage' }],
    },
  ],
  'XPHB:Haste': [
    {
      name: 'Haste',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [
        { target: 'ac', mode: 'add', value: 2 },
        { target: 'speed', mode: 'multiply', value: 2 },
        { target: 'extraActions', mode: 'add', value: 1 },
      ],
    },
  ],
  'XPHB:Stoneskin': [
    {
      name: 'Stoneskin',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [
        { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'slashing' } },
        { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'piercing' } },
        { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'bludgeoning' } },
      ],
    },
  ],
  'XPHB:Bless': [
    {
      name: 'Bless',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      targets: 3,
      modifiers: [
        { target: 'attack', mode: 'add', value: '1d4' },
        { target: 'save', mode: 'add', value: '1d4' },
      ],
    },
  ],
  'XPHB:Bane': [
    {
      name: 'Bane',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      targets: 3,
      modifiers: [
        { target: 'attack', mode: 'add', value: '-1d4' },
        { target: 'save', mode: 'add', value: '-1d4' },
      ],
    },
  ],
  'XPHB:Resistance': [
    {
      name: 'Resistance',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [{ target: 'save', mode: 'add', value: '1d4' }],
    },
  ],
  'XPHB:Guidance': [
    {
      name: 'Guidance',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [{ target: 'check', mode: 'add', value: '1d4' }],
    },
  ],
};

/** Определения эффектов заклинания по ключу (или undefined, если их нет). */
export function spellEffectDefs(spellKey: string): SpellEffectDef[] | undefined {
  return SPELL_EFFECTS[spellKey];
}
