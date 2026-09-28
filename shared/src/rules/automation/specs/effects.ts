import { DAMAGE_TYPES } from '../../../labels';
import { CONCENTRATION, PERMANENT, UNTIL_NEXT_TURN } from '../header';
import type { AutomationSpec } from '../spec';
import { webRestrained } from './factories';

export const EFFECTS_SPECS: Record<string, AutomationSpec> = {
  // Батч A (R16): базовые effect-записи каталога — только модификаторы и длительность.
  'XPHB:Shield': {
    key: 'XPHB:Shield',
    name: 'Shield',
    primary: 'effect',
    effects: [
      {
        id: 'shield',
        name: 'Shield',
        duration: UNTIL_NEXT_TURN,
        to: 'self',
        modifiers: [{ target: 'ac', mode: 'add', value: 5 }],
      },
    ],
  },

  'XPHB:Shield of Faith': {
    key: 'XPHB:Shield of Faith',
    name: 'Shield of Faith',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'shieldOfFaith',
        name: 'Shield of Faith',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'ac', mode: 'add', value: 2 }],
      },
    ],
  },

  'XPHB:Mage Armor': {
    key: 'XPHB:Mage Armor',
    name: 'Mage Armor',
    primary: 'effect',
    effects: [
      {
        id: 'mageArmor',
        name: 'Mage Armor',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [{ target: 'ac', mode: 'set', value: '13+dex' }],
      },
    ],
  },

  'XPHB:Barkskin': {
    key: 'XPHB:Barkskin',
    name: 'Barkskin',
    primary: 'effect',
    effects: [
      {
        id: 'barkskin',
        name: 'Barkskin',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [{ target: 'ac', mode: 'set', value: 17 }],
      },
    ],
  },

  'XPHB:Longstrider': {
    key: 'XPHB:Longstrider',
    name: 'Longstrider',
    primary: 'effect',
    effects: [
      {
        id: 'longstrider',
        name: 'Longstrider',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [{ target: 'speed', mode: 'add', value: 10 }],
      },
    ],
  },

  'XPHB:Blur': {
    key: 'XPHB:Blur',
    name: 'Blur',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'blur',
        name: 'Blur',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [{ target: 'attack', mode: 'disadvantage' }],
      },
    ],
  },

  // Батч A2 (R16): остаток effect-записей каталога (баффы, контроль).
  'XPHB:Haste': {
    key: 'XPHB:Haste',
    name: 'Haste',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'haste',
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
  },

  'XPHB:Stoneskin': {
    key: 'XPHB:Stoneskin',
    name: 'Stoneskin',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'stoneskin',
        name: 'Stoneskin',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'slashing' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'piercing' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'bludgeoning' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'magicalSlashing' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'magicalPiercing' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'magicalBludgeoning' } },
        ],
      },
    ],
  },

  'XPHB:Guidance': {
    key: 'XPHB:Guidance',
    name: 'Guidance',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'guidance',
        name: 'Guidance',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'check', mode: 'add', value: '1d4' }],
      },
    ],
  },

  'XPHB:Hold Person': {
    key: 'XPHB:Hold Person',
    name: 'Hold Person',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'holdPerson',
        name: 'Hold Person',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        conditions: ['paralyzed'],
        modifiers: [],
      },
    ],
  },

  'XPHB:Entangle': {
    key: 'XPHB:Entangle',
    name: 'Entangle',
    primary: 'effect',
    concentration: true,
    save: { ability: 'str' },
    effects: [
      {
        id: 'entangle',
        name: 'Entangle',
        duration: { type: 'untilSave', ability: 'str', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        conditions: ['restrained'],
        modifiers: [],
      },
    ],
  },

  'XPHB:Fear': {
    key: 'XPHB:Fear',
    name: 'Fear',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'fear',
        name: 'Fear',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        conditions: ['frightened'],
        modifiers: [],
      },
    ],
  },

  'XPHB:Color Spray': {
    key: 'XPHB:Color Spray',
    name: 'Color Spray',
    primary: 'effect',
    save: { ability: 'con' },
    effects: [
      {
        id: 'colorSpray',
        name: 'Color Spray',
        duration: UNTIL_NEXT_TURN,
        to: 'targets',
        conditions: ['blinded'],
        modifiers: [],
      },
    ],
  },

  'XPHB:Hold Monster': {
    key: 'XPHB:Hold Monster',
    name: 'Hold Monster',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'holdMonster',
        name: 'Hold Monster',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        conditions: ['paralyzed'],
        modifiers: [],
      },
    ],
  },

  'XPHB:Slow': {
    key: 'XPHB:Slow',
    name: 'Slow',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'slow',
        name: 'Slow',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        targets: 6,
        modifiers: [
          { target: 'speed', mode: 'multiply', value: 0.5 },
          { target: 'ac', mode: 'add', value: -2 },
          { target: 'save', mode: 'add', value: -2, filter: { ability: 'dex' } },
        ],
        restrictions: { noReactions: true, actionOrBonusOnly: true, oneAttackOnly: true, spellFailureChance: 25 },
      },
    ],
  },

  'XPHB:Divine Favor': {
    key: 'XPHB:Divine Favor',
    name: 'Divine Favor',
    primary: 'effect',
    effects: [
      {
        id: 'divineFavor',
        name: 'Divine Favor',
        duration: PERMANENT,
        to: 'self',
        modifiers: [{ target: 'damage', mode: 'add', value: '1d4radiant', filter: { weapon: true, unarmed: false } }],
      },
    ],
  },

  // Батч Б1 (R16): записи каталога на существующих спец-блоках.
  'XPHB:Expeditious Retreat': {
    key: 'XPHB:Expeditious Retreat',
    name: 'Expeditious Retreat',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'expeditiousRetreat',
        name: 'Expeditious Retreat',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [],
        actions: [{ id: 'dash', name: 'Рывок', cost: 'bonus', baseActionId: 'dash' }],
      },
    ],
  },

  "XPHB:Tasha's Hideous Laughter": {
    key: "XPHB:Tasha's Hideous Laughter",
    name: 'Hideous Laughter',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'hideousLaughter',
        name: 'Hideous Laughter',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        conditions: ['incapacitated', 'prone'],
        modifiers: [],
        hooks: { saveOnDamage: { advantage: true } },
      },
    ],
  },

  'XPHB:Faerie Fire': {
    key: 'XPHB:Faerie Fire',
    name: 'Faerie Fire',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'faerieFire',
        name: 'Faerie Fire',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'attack', mode: 'advantage' }],
        conditionImmunities: ['invisible'],
        light: { bright: 0, dim: 10 },
      },
    ],
  },

  'XPHB:Banishment': {
    key: 'XPHB:Banishment',
    name: 'Banishment',
    primary: 'effect',
    concentration: true,
    save: { ability: 'cha' },
    effects: [
      {
        id: 'banishment',
        name: 'Banishment',
        duration: { type: 'rounds', rounds: 10 },
        concentration: true,
        to: 'targets',
        conditions: ['incapacitated'],
        modifiers: [],
        banish: true,
      },
    ],
  },

  'XPHB:Hypnotic Pattern': {
    key: 'XPHB:Hypnotic Pattern',
    name: 'Hypnotic Pattern',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'hypnoticPattern',
        name: 'Hypnotic Pattern',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        conditions: ['charmed', 'incapacitated'],
        modifiers: [{ target: 'speed', mode: 'multiply', value: 0 }],
        hooks: { wakeOnDamage: true },
      },
    ],
  },

  'XPHB:Sanctuary': {
    key: 'XPHB:Sanctuary',
    name: 'Sanctuary',
    primary: 'effect',
    targeting: { kind: 'creature', range: 30 },
    effects: [
      {
        id: 'sanctuary',
        name: 'Sanctuary',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [],
        hooks: { sanctuary: true, breakOn: ['attack', 'spell', 'damage'] },
      },
    ],
  },

  'XPHB:Warding Bond': {
    key: 'XPHB:Warding Bond',
    name: 'Warding Bond',
    primary: 'effect',
    effects: [
      {
        id: 'wardingBond',
        name: 'Warding Bond',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [
          { target: 'ac', mode: 'add', value: 1 },
          { target: 'save', mode: 'add', value: 1 },
          ...DAMAGE_TYPES.map((type) => ({
            target: 'damage' as const,
            mode: 'resistance' as const,
            value: 0,
            filter: { damageType: type.key },
          })),
        ],
        hooks: { damageLink: true },
      },
    ],
  },

  "XPHB:Dragon's Breath": {
    key: "XPHB:Dragon's Breath",
    name: "Dragon's Breath",
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'damageType', param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'poison'] }],
    effects: [
      {
        id: 'breath',
        name: "Dragon's Breath",
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        variant: { ref: 'choice' },
        actions: [
          {
            id: 'breath',
            name: 'Выдох',
            cost: 'action',
            primary: 'save',
            save: { ability: 'dex', half: true },
            damage: { dice: { ref: 'spellDamage' }, types: [{ ref: 'choice' }] },
            area: { from: 'spell', fallback: { shape: 'cone', size: 15 } },
            targeting: { kind: 'area', fromArea: true },
          },
        ],
      },
    ],
  },

  // Батч Г (R16): escape/escalate — Sleep (эскалация в без сознания при провале
  // повторного спасброска) и Web (выпутывание STR/Athletics действием).
  'XPHB:Sleep': {
    key: 'XPHB:Sleep',
    name: 'Sleep',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'sleep',
        name: 'Sleep',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        modifiers: [],
        conditions: ['incapacitated'],
        hooks: { wakeOnDamage: true },
        escalate: { condition: 'unconscious', duration: CONCENTRATION },
      },
    ],
  },

  'XPHB:Web': {
    key: 'XPHB:Web',
    name: 'Web',
    primary: 'effect',
    concentration: true,
    save: { ability: 'dex' },
    effects: [webRestrained()],
    zone: {
      area: { shape: 'cube', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      triggers: {
        enter: { save: { ability: 'dex' }, effects: [webRestrained()] },
        startOfTurn: { save: { ability: 'dex' }, effects: [webRestrained()] },
      },
      flags: { difficultTerrain: true },
    },
  },

  // Батч Д (R16): `endConditions` — снятие состояний при касте (Protection from Poison)
  // и утилита выбора состояния (Lesser Restoration).
  'XPHB:Protection from Poison': {
    key: 'XPHB:Protection from Poison',
    name: 'Protection from Poison',
    primary: 'effect',
    endConditions: ['poisoned'],
    effects: [
      {
        id: 'protection',
        name: 'Protection from Poison',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [
          { target: 'save', mode: 'advantage', filter: { conditions: ['poisoned'] } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'poison' } },
        ],
      },
    ],
  },

  'XPHB:Lesser Restoration': {
    key: 'XPHB:Lesser Restoration',
    name: 'Lesser Restoration',
    primary: 'utility',
    utility: { kind: 'endCondition' },
    endConditions: ['blinded', 'deafened', 'paralyzed', 'poisoned'],
    targeting: { kind: 'creature', range: 5 },
  },
};
