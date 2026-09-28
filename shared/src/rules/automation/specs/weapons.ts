import { CONCENTRATION, PERMANENT, UNTIL_NEXT_TURN } from '../header';
import type { AutomationSpec } from '../spec';
import { MAGIC_WEAPON_BONUS } from './factories';

export const WEAPONS_SPECS: Record<string, AutomationSpec> = {
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
    // Выбор базового типа урона сохраняется как поверхность каста (механику ведёт оружие).
    choices: [{ id: 'damageType', param: 'damageType', options: ['weapon', 'radiant'] }],
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
        uses: { kind: 'charges', count: 12, on: 'rangedWeaponAttack' },
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
        uses: { kind: 'charges', count: 3 },
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

  // Касание: оружие-носитель светит 30/30 и бьёт +2d8 излучением; «Разряд» завершает эффект.
  'XGE:Holy Weapon': {
    key: 'XGE:Holy Weapon',
    name: 'Holy Weapon',
    primary: 'effect',
    concentration: true,
    targeting: { kind: 'creature', range: 5 },
    effects: [
      {
        id: 'weapon',
        name: 'Holy Weapon',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'damage', mode: 'add', value: '2d8radiant', filter: { weapon: true, unarmed: false } }],
        light: { bright: 30, dim: 30 },
        actions: [
          {
            id: 'burst',
            name: 'Разряд',
            cost: 'bonus',
            subKey: 'burst',
            endsEffect: true,
            primary: 'save',
            save: { ability: 'con', half: true },
            damage: { dice: '4d8', types: ['radiant'] },
            area: { shape: 'sphere', size: 30 },
            targeting: { kind: 'area', area: { shape: 'sphere', size: 30 }, range: 30 },
            effects: [
              {
                id: 'blind',
                name: 'Holy Weapon',
                duration: { type: 'endOfTurn', of: 'source' },
                to: 'targets',
                modifiers: [],
                conditions: ['blinded'],
              },
            ],
          },
        ],
      },
    ],
  },
};
