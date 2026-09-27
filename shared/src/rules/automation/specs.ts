import { CONCENTRATION, PERMANENT, UNTIL_NEXT_TURN } from './header';
import type { AutomationSpec, ValueExpr } from './spec';

/** Magic Weapon: +1/+2/+3 к попаданию и урону с 1/3/6 круга (литеральные ступени). */
const MAGIC_WEAPON_BONUS: ValueExpr = {
  tiers: [
    { above: 1, value: 1 },
    { above: 3, value: 2 },
    { above: 6, value: 3 },
  ],
};

/**
 * Реестр спеков (R16, пилот `loadout`): специализированные заклинания оружия и
 * атак. Компилируются в `AutomationDef` (`compileSpec`) и перехватывают билдеры
 * в `derive.ts`; равенство вывода замком `automation.spec.test.ts`.
 */
export const AUTOMATION_SPECS: Record<string, AutomationSpec> = {
  'TCE:Green-Flame Blade': {
    key: 'TCE:Green-Flame Blade',
    name: 'Green-Flame Blade',
    primary: 'attack',
    attack: { rangeType: 'melee' },
    weaponAttack: {
      riderDice: { concat: [{ ref: 'cantrip' }, 'fire'] },
      secondary: { rangeFeet: 5, dice: { ref: 'cantrip' }, damageType: 'fire' },
    },
  },

  'TCE:Booming Blade': {
    key: 'TCE:Booming Blade',
    name: 'Booming Blade',
    primary: 'attack',
    attack: { rangeType: 'melee' },
    weaponAttack: {
      riderDice: { concat: [{ ref: 'cantrip' }, 'thunder'] },
      hitEffect: {
        name: 'Booming Blade',
        duration: UNTIL_NEXT_TURN,
        to: 'targets',
        modifiers: [],
        onWillingMove: { dice: { add: [{ ref: 'cantrip' }, '1d8'] }, damageType: 'thunder', feet: 5 },
      },
    },
  },

  'XPHB:True Strike': {
    key: 'XPHB:True Strike',
    name: 'True Strike',
    primary: 'attack',
    weaponAttack: {
      anyWeapon: true,
      spellAbility: true,
      riderDice: { concat: [{ ref: 'cantrip' }, 'radiant'] },
    },
  },

  'XPHB:Shillelagh': {
    key: 'XPHB:Shillelagh',
    name: 'Shillelagh',
    primary: 'effect',
    effects: [
      {
        id: 'shillelagh',
        name: 'Shillelagh',
        duration: PERMANENT,
        to: 'self',
        loadout: {
          kind: 'weaponOverride',
          weapons: ['XPHB:Club', 'XPHB:Quarterstaff'],
          dice: { ref: 'cantrip', fallback: { ref: 'damage', fallback: '1d8' } },
          damageType: { ref: 'type0', fallback: 'force' },
          abilityMod: { ref: 'spellMod', fallback: 0 },
        },
      },
    ],
  },

  'XPHB:Magic Weapon': {
    key: 'XPHB:Magic Weapon',
    name: 'Magic Weapon',
    primary: 'effect',
    effects: [
      {
        id: 'weapon',
        name: 'Magic Weapon',
        duration: PERMANENT,
        to: 'targets',
        loadout: {
          kind: 'augment',
          attack: MAGIC_WEAPON_BONUS,
          damage: MAGIC_WEAPON_BONUS,
          magic: true,
        },
      },
    ],
  },

  'XPHB:Elemental Weapon': {
    key: 'XPHB:Elemental Weapon',
    name: 'Elemental Weapon',
    primary: 'effect',
    concentration: true,
    targeting: { kind: 'creature', range: 5 },
    choices: [
      {
        id: 'damageType',
        param: 'damageType',
        options: ['acid', 'cold', 'fire', 'lightning', 'thunder'],
      },
    ],
    effects: [
      {
        id: 'weapon',
        name: 'Elemental Weapon',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        variant: { ref: 'choice' },
        loadout: {
          kind: 'augment',
          attack: { ref: 'upcastAttack', fallback: 1 },
          damage: {
            concat: [{ ref: 'upcastDice', fallback: { ref: 'damage', fallback: '1d4' } }, { ref: 'choice', fallback: 'fire' }],
          },
          magic: true,
        },
      },
    ],
  },

  'XGE:Flame Arrows': {
    key: 'XGE:Flame Arrows',
    name: 'Flame Arrows',
    primary: 'effect',
    concentration: true,
    targeting: { kind: 'creature', range: 5 },
    effects: [
      {
        id: 'arrows',
        name: 'Flame Arrows',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [
          {
            target: 'damage',
            mode: 'add',
            value: '1d6fire',
            filter: { weapon: true, unarmed: false, attackType: 'ranged' },
          },
        ],
        charges: { count: 12, on: 'rangedWeaponAttack' },
      },
    ],
  },

  'XGE:Shadow Blade': {
    key: 'XGE:Shadow Blade',
    name: 'Shadow Blade',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'blade',
        name: 'Shadow Blade',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        loadout: {
          kind: 'shadowBlade',
          dice: { ref: 'upcastDice', fallback: { ref: 'damage', fallback: '2d8' } },
          inHand: true,
        },
        actions: [
          {
            id: 'return',
            name: 'Вернуть клинок',
            cost: 'bonus',
            subKey: 'return',
            primary: 'utility',
            utility: { kind: 'recallWeapon' },
          },
        ],
      },
    ],
  },

  'XGE:Magic Stone': {
    key: 'XGE:Magic Stone',
    name: 'Magic Stone',
    primary: 'effect',
    effects: [
      {
        id: 'stones',
        name: 'Magic Stone',
        duration: PERMANENT,
        to: 'self',
        charges: { count: 3 },
        actions: [
          {
            id: 'throw',
            name: 'Бросок камня',
            cost: 'action',
            primary: 'attack',
            attack: { rangeType: 'ranged' },
            damage: { dice: { ref: 'damage', fallback: '1d6' }, types: ['bludgeoning'], abilityMod: true },
            targeting: { kind: 'creature', range: 60 },
          },
        ],
      },
    ],
  },

  'XPHB:Flame Blade': {
    key: 'XPHB:Flame Blade',
    name: 'Flame Blade',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'blade',
        name: 'Flame Blade',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        light: { bright: 10, dim: 10 },
        actions: [
          {
            id: 'blade',
            name: 'Клинок',
            cost: 'action',
            defName: 'Огненный клинок',
            primary: 'attack',
            attack: { rangeType: 'melee' },
            damage: { dice: { ref: 'spellDamage', fallback: '3d6' }, types: ['fire'], abilityMod: true },
            targeting: { kind: 'creature', range: 5 },
          },
        ],
      },
    ],
  },
};
