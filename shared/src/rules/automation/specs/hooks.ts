import { SPELL_BASES } from '../bases';
import { CONCENTRATION, PERMANENT, RESISTANCE_TYPES } from '../header';
import type { AutomationSpec } from '../spec';

export const HOOKS_SPECS: Record<string, AutomationSpec> = {
  'XPHB:Resistance': {
    key: 'XPHB:Resistance',
    name: 'Resistance',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'damageType', param: 'damageType', options: RESISTANCE_TYPES }],
    effects: [
      {
        id: 'resistance',
        name: 'Resistance',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        triggers: {
          damaged: { reduce: { dice: SPELL_BASES.resistance.damageReduceDice, types: [{ ref: 'choice' }] } },
        },
        uses: { kind: 'charges', count: 1 },
        variant: { ref: 'choice' },
      },
    ],
  },

  'XGE:Elemental Bane': {
    key: 'XGE:Elemental Bane',
    name: 'Elemental Bane',
    primary: 'effect',
    concentration: true,
    save: { ability: 'con' },
    choices: [{ id: 'damageType', param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'thunder'] }],
    effects: [
      {
        id: 'bane',
        name: 'Elemental Bane',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        targets: 1,
        triggers: {
          damaged: {
            extraDamage: {
              damageType: { ref: 'choice' },
              dice: SPELL_BASES.elementalBane.extraDice,
              oncePerTurn: true,
            },
          },
        },
        variant: { ref: 'choice' },
      },
    ],
  },

  'XGE:Zephyr Strike': {
    key: 'XGE:Zephyr Strike',
    name: 'Zephyr Strike',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'zephyr',
        name: 'Zephyr Strike',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [{ target: 'attack', mode: 'advantage', filter: { weapon: true } }],
        restrictions: { ignoresOpportunityAttacks: true },
        uses: { kind: 'consumeOnAttack' },
        movement: { zephyrStrike: { dice: '1d8', damageType: 'force', speedFeet: 30 } },
      },
    ],
  },

  'XPHB:Mirror Image': {
    key: 'XPHB:Mirror Image',
    name: 'Mirror Image',
    primary: 'effect',
    effects: [
      {
        id: 'images',
        name: 'Mirror Image',
        duration: { type: 'rounds', rounds: 10 },
        to: 'self',
        uses: { kind: 'misdirect', ...SPELL_BASES.mirrorImage.misdirect },
      },
    ],
  },

  'XPHB:Protection from Energy': {
    key: 'XPHB:Protection from Energy',
    name: 'Protection from Energy',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'damageType', param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'thunder'] }],
    effects: [
      {
        id: 'protection',
        name: 'Protection from Energy',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'damage', mode: 'resistance', value: 0, filter: { damageType: { ref: 'choice' } } }],
        variant: { ref: 'choice' },
      },
    ],
  },

  'XPHB:Fire Shield': {
    key: 'XPHB:Fire Shield',
    name: 'Fire Shield',
    primary: 'effect',
    choices: [{ id: 'mode', param: 'effect', options: ['warm', 'chill'] }],
    effects: [
      {
        id: 'shield',
        name: 'Fire Shield',
        duration: PERMANENT,
        to: 'self',
        modifiers: [
          {
            target: 'damage',
            mode: 'resistance',
            value: 0,
            filter: { damageType: { mapped: { of: { ref: 'choice' }, values: { warm: 'cold', chill: 'fire' } } } },
          },
        ],
        triggers: {
          damaged: {
            damage: {
              damageType: { mapped: { of: { ref: 'choice' }, values: { warm: 'fire', chill: 'cold' } } },
              dice: '2d8',
              to: 'source',
            },
          },
        },
        variant: { ref: 'choice' },
      },
    ],
  },

  'XPHB:Armor of Agathys': {
    key: 'XPHB:Armor of Agathys',
    name: 'Armor of Agathys',
    primary: 'effect',
    effects: [
      {
        id: 'agathys',
        name: 'Armor of Agathys',
        duration: PERMANENT,
        to: 'self',
        tempHp: { sum: [5, { ref: 'upcastFlat' }] },
        triggers: {
          damaged: { damage: { damageType: 'cold', amount: { sum: [5, { ref: 'upcastFlat' }] }, to: 'source' } },
        },
      },
    ],
  },

  'XPHB:Invisibility': {
    key: 'XPHB:Invisibility',
    name: 'Invisibility',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'invisible',
        name: 'Invisibility',
        duration: PERMANENT,
        concentration: true,
        to: 'targets',
        targets: { perLevel: { base: 1, per: 1, above: 2 } },
        conditions: ['invisible'],
        triggers: {
          ownAttackRoll: { endEffect: true },
          ownSpellCast: { endEffect: true },
        },
      },
    ],
  },

  'XPHB:Greater Invisibility': {
    key: 'XPHB:Greater Invisibility',
    name: 'Greater Invisibility',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'invisible',
        name: 'Greater Invisibility',
        duration: PERMANENT,
        concentration: true,
        to: 'targets',
        targets: 1,
        conditions: ['invisible'],
      },
    ],
  },

  'XGE:Shadow of Moil': {
    key: 'XGE:Shadow of Moil',
    name: 'Shadow of Moil',
    primary: 'effect',
    effects: [
      {
        id: 'moil',
        name: 'Shadow of Moil',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [
          { target: 'attack', mode: 'disadvantage', filter: { direction: 'against' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'radiant' } },
        ],
        triggers: { damaged: { damage: { damageType: 'necrotic', dice: '2d8', to: 'source' } } },
      },
    ],
  },

  'XPHB:Death Ward': {
    key: 'XPHB:Death Ward',
    name: 'Death Ward',
    primary: 'effect',
    effects: [
      {
        id: 'ward',
        name: 'Death Ward',
        duration: { type: 'rounds', rounds: 4800 },
        to: 'targets',
        triggers: { hpReachedZero: { survive: { hp: 1 } } },
      },
    ],
  },

  // Primordial Ward и Fount of Moonlight — последние боевые записи каталога на спеках.
  'XGE:Primordial Ward': {
    key: 'XGE:Primordial Ward',
    name: 'Primordial Ward',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'ward',
        name: 'Primordial Ward',
        duration: PERMANENT,
        concentration: true,
        to: 'self',
        modifiers: ['acid', 'cold', 'fire', 'lightning', 'thunder'].map((type) => ({
          target: 'damage' as const,
          mode: 'resistance' as const,
          value: 0,
          filter: { damageType: type },
        })),
        triggers: {
          damaged: { reaction: { kind: 'ward', types: ['acid', 'cold', 'fire', 'lightning', 'thunder'] } },
        },
      },
    ],
  },

  'XPHB:Fount of Moonlight': {
    key: 'XPHB:Fount of Moonlight',
    name: 'Fount of Moonlight',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'fount',
        name: 'Fount of Moonlight',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [
          { target: 'damage', mode: 'add', value: '2d6radiant', filter: { attackType: 'melee' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'radiant' } },
        ],
        light: { bright: 20, dim: 20 },
        triggers: {
          damaged: { reaction: { kind: 'saveCondition', ability: 'con', feet: 60, condition: 'blinded' } },
        },
      },
    ],
  },
};
