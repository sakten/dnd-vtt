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

  // Батч `additions` (R16): лечение — Cure Wounds/Healing Word (+мод характеристики),
  // массовые (targets) и Harm (снижение максимума HP). `count: 1`, пустые `effects: []`
  // и `heal.types: []` сохраняют байт-равенство с прежним выводом «деривация + добавки».
  'XPHB:Cure Wounds': {
    key: 'XPHB:Cure Wounds',
    name: 'Cure Wounds',
    primary: 'auto',
    count: 1,
    heal: { dice: { ref: 'spellDamage', fallback: '2d8' }, types: [], abilityMod: true },
    effects: [],
  },

  'XPHB:Healing Word': {
    key: 'XPHB:Healing Word',
    name: 'Healing Word',
    primary: 'auto',
    count: 1,
    heal: { dice: { ref: 'spellDamage', fallback: '2d4' }, types: [], abilityMod: true },
    effects: [],
  },

  'XPHB:Prayer of Healing': {
    key: 'XPHB:Prayer of Healing',
    name: 'Prayer of Healing',
    primary: 'auto',
    count: 1,
    targets: 5,
    // Без мода характеристики (SRD 2024: «also regain 2d8»).
    heal: { dice: { ref: 'spellDamage', fallback: '2d8' }, types: [] },
    effects: [],
  },

  'XPHB:Mass Healing Word': {
    key: 'XPHB:Mass Healing Word',
    name: 'Mass Healing Word',
    primary: 'auto',
    count: 1,
    targets: 6,
    heal: { dice: { ref: 'spellDamage', fallback: '2d4' }, types: [], abilityMod: true },
    effects: [],
  },

  'XPHB:Mass Cure Wounds': {
    key: 'XPHB:Mass Cure Wounds',
    name: 'Mass Cure Wounds',
    primary: 'auto',
    count: 1,
    targets: 6,
    heal: { dice: { ref: 'spellDamage', fallback: '5d8' }, types: [], abilityMod: true },
    effects: [],
  },

  'XPHB:Harm': {
    key: 'XPHB:Harm',
    name: 'Harm',
    primary: 'save',
    save: { ability: 'con', half: true },
    damage: { dice: { ref: 'spellDamage', fallback: '14d6' }, types: ['necrotic'] },
    maxHpFromDamage: true,
    effects: [],
  },
};
