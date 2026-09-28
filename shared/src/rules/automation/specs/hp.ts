import { SPELL_BASES } from '../bases';
import { CONCENTRATION, PERMANENT } from '../header';
import type { AutomationSpec } from '../spec';

export const HP_SPECS: Record<string, AutomationSpec> = {
  // Батч Ж (R16): поток HP — вампиризм (Vampiric Touch), перенос жизни (Life Transference)
  // и временные хиты (False Life).
  'XPHB:Vampiric Touch': {
    key: 'XPHB:Vampiric Touch',
    name: 'Vampiric Touch',
    primary: 'attack',
    concentration: true,
    attack: { rangeType: 'melee' },
    damage: { dice: { ref: 'spellDamage', fallback: '3d6' }, types: ['necrotic'] },
    lifesteal: true,
    effects: [
      {
        id: 'touch',
        name: 'Vampiric Touch',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [],
        actions: [
          {
            id: 'touch',
            name: 'Касание',
            cost: 'action',
            primary: 'attack',
            attack: { rangeType: 'melee' },
            damage: { dice: { ref: 'spellDamage', fallback: '3d6' }, types: ['necrotic'] },
            lifesteal: true,
            targeting: { kind: 'creature', range: 5 },
          },
        ],
      },
    ],
  },

  'XGE:Life Transference': {
    key: 'XGE:Life Transference',
    name: 'Life Transference',
    primary: 'auto',
    damage: { dice: { ref: 'spellDamage', fallback: '4d8' }, types: ['necrotic'] },
    lifeTransfer: { factor: 2 },
    targeting: { kind: 'creature', range: 30 },
  },

  'XPHB:False Life': {
    key: 'XPHB:False Life',
    name: 'False Life',
    primary: 'utility',
    utility: {
      kind: 'tempHp',
      dice: {
        join: {
          parts: [
            { ref: 'damage', fallback: `${SPELL_BASES.falseLife.dice} + ${SPELL_BASES.falseLife.flat}` },
            { perLevel: { base: 0, per: SPELL_BASES.falseLife.perLevel, above: 'spell', optional: true } },
          ],
          sep: ' + ',
        },
      },
    },
  },

  'XPHB:Aid': {
    key: 'XPHB:Aid',
    name: 'Aid',
    primary: 'effect',
    effects: [
      {
        id: 'aid',
        name: 'Aid',
        duration: PERMANENT,
        to: 'targets',
        targets: 3,
        modifiers: [{ target: 'maxHp', mode: 'add', value: { sum: [5, { ref: 'upcastFlat' }] } }],
      },
    ],
  },

  'XPHB:Heroism': {
    key: 'XPHB:Heroism',
    name: 'Heroism',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'heroism',
        name: 'Heroism',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [],
        conditionImmunities: ['frightened'],
        triggers: {
          startOfTurn: {
            if: { spellMod: { base: 0, min: 0 } },
            then: { tempHp: { spellMod: { base: 0, min: 0 } } },
          },
        },
      },
    ],
  },

  'XGE:Negative Energy Flood': {
    key: 'XGE:Negative Energy Flood',
    name: 'Negative Energy Flood',
    primary: 'save',
    save: { ability: 'con', half: true },
    damage: { dice: { concat: [{ ref: 'damage', fallback: '5d12' }, 'necrotic'] }, types: ['necrotic'] },
    undeadTempHp: true,
  },

  // Heal: плоское лечение 70 (+10 за круг выше 6); снимает Blinded/Deafened/Poisoned.
  'XPHB:Heal': {
    key: 'XPHB:Heal',
    name: 'Heal',
    primary: 'auto',
    heal: {
      dice: { perLevel: { base: SPELL_BASES.heal.flat, per: SPELL_BASES.heal.perLevel, above: SPELL_BASES.heal.above } },
    },
    endConditions: ['blinded', 'deafened', 'poisoned'],
  },

  "XPHB:Heroes' Feast": {
    key: "XPHB:Heroes' Feast",
    name: "Heroes' Feast",
    primary: 'effect',
    effects: [
      {
        id: 'feast',
        name: "Heroes' Feast",
        duration: PERMANENT,
        to: 'targets',
        targets: 12,
        modifiers: [{ target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'poison' } }],
        conditionImmunities: ['frightened', 'poisoned'],
        maxHpBonus: { dice: SPELL_BASES.heroesFeast.maxHpDice },
      },
    ],
  },
};
