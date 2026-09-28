import { CONCENTRATION, PERMANENT } from '../header';
import type { AutomationSpec } from '../spec';
import { moveZoneAction, sunbeamBlind, heatHolding, stormTrigger } from './factories';

export const REPEAT_SPECS: Record<string, AutomationSpec> = {
  // Батч З (R16): билдеры на существующих блоках — лучи/повторы (Sunbeam, Heat Metal,
  // Witch Bolt, Call Lightning, Minute Meteors), духи-зоны (Spiritual Weapon,
  // Conjure Fey, Storm Sphere), составной урон (Flame Strike, Ice Storm, Jallarzi)
  // и Aid.
  'XPHB:Sunbeam': {
    key: 'XPHB:Sunbeam',
    name: 'Sunbeam',
    primary: 'save',
    concentration: true,
    save: { ability: 'con', half: true },
    damage: { dice: { ref: 'spellDamage', fallback: '6d8' }, types: ['radiant'] },
    area: { from: 'spell', fallback: { shape: 'line', size: 60, width: 5 } },
    effects: [
      sunbeamBlind(),
      {
        id: 'beamCarrier',
        name: 'Sunbeam',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [],
        light: { bright: 30, dim: 30, sunlight: true },
        actions: [
          {
            id: 'beam',
            name: 'Луч',
            cost: 'action',
            primary: 'save',
            save: { ability: 'con', half: true },
            damage: { dice: { ref: 'spellDamage', fallback: '6d8' }, types: ['radiant'] },
            area: { from: 'spell', fallback: { shape: 'line', size: 60, width: 5 } },
            targeting: { kind: 'area', fromArea: true },
            effects: [sunbeamBlind()],
          },
        ],
      },
    ],
  },

  'XPHB:Heat Metal': {
    key: 'XPHB:Heat Metal',
    name: 'Heat Metal',
    primary: 'auto',
    concentration: true,
    damage: { dice: { ref: 'spellDamage', fallback: '2d8' }, types: ['fire'] },
    effects: [
      heatHolding(),
      {
        id: 'burnCarrier',
        name: 'Heat Metal',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [],
        actions: [
          {
            id: 'burn',
            name: 'Раскалённый металл',
            cost: 'bonus',
            primary: 'auto',
            damage: { dice: { ref: 'spellDamage', fallback: '2d8' }, types: ['fire'] },
            targeting: { kind: 'creature', range: 60 },
            effects: [heatHolding()],
          },
        ],
      },
    ],
  },

  'XPHB:Witch Bolt': {
    key: 'XPHB:Witch Bolt',
    name: 'Witch Bolt',
    primary: 'attack',
    concentration: true,
    attack: { rangeType: 'ranged' },
    count: 1,
    damage: {
      dice: {
        concat: [{ scale: { dice: { ref: 'part', part: 'main', fallback: '2d12' }, by: 'upcast' } }, 'lightning'],
      },
      types: ['lightning'],
    },
    effects: [
      {
        id: 'boltCarrier',
        name: 'Witch Bolt',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [],
        actions: [
          {
            id: 'bolt',
            name: 'Разряд',
            cost: 'bonus',
            primary: 'auto',
            damage: { dice: { ref: 'part', part: 'repeat', fallback: '1d12' }, types: ['lightning'] },
            targeting: { kind: 'creature', range: 60 },
          },
        ],
      },
    ],
  },

  'XPHB:Call Lightning': {
    key: 'XPHB:Call Lightning',
    name: 'Call Lightning',
    primary: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    damage: { dice: { ref: 'spellDamage', fallback: '3d10' }, types: ['lightning'] },
    area: { shape: 'sphere', size: 5 },
    zone: {
      area: { shape: 'cylinder', size: 60 },
      origin: 'point',
      duration: CONCENTRATION,
      flags: { subtle: true },
      actions: [
        {
          id: 'strike',
          name: 'Удар молнии',
          cost: 'action',
          primary: 'save',
          save: { ability: 'dex', half: true },
          damage: { dice: { ref: 'spellDamage', fallback: '3d10' }, types: ['lightning'] },
          area: { shape: 'sphere', size: 5 },
          targeting: { kind: 'area', area: { shape: 'sphere', size: 5 }, range: 60 },
        },
      ],
    },
  },

  "XGE:Melf's Minute Meteors": {
    key: "XGE:Melf's Minute Meteors",
    name: 'Minute Meteors',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'meteors',
        name: 'Minute Meteors',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [],
        uses: { kind: 'charges', count: { perLevel: { base: 6, per: 2, above: 'spell' } } },
        actions: [
          {
            id: 'meteor',
            name: 'Метеор',
            cost: 'bonus',
            primary: 'save',
            save: { ability: 'dex', half: true },
            damage: { dice: { ref: 'damage', fallback: '2d6' }, types: ['fire'] },
            area: { shape: 'sphere', size: 5 },
            targeting: { kind: 'area', area: { shape: 'sphere', size: 5 }, range: 120 },
          },
        ],
      },
    ],
  },

  'XGE:Immolation': {
    key: 'XGE:Immolation',
    name: 'Immolation',
    primary: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    damage: { parts: [{ dice: { ref: 'part', part: 'main', fallback: '8d6' }, type: 'fire' }] },
    effects: [
      {
        id: 'burn',
        name: 'Immolation',
        duration: {
          type: 'untilSave',
          ability: 'dex',
          dc: 0,
          timing: 'end',
          damage: { dice: '4d6fire', types: ['fire'] },
        },
        concentration: true,
        to: 'targets',
        modifiers: [],
        light: { bright: 30, dim: 30 },
      },
    ],
  },

  'XPHB:Spiritual Weapon': {
    key: 'XPHB:Spiritual Weapon',
    name: 'Spiritual Weapon',
    primary: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 0 },
      origin: 'point',
      duration: CONCENTRATION,
      movable: true,
      flags: { subtle: true, sprite: 'hammer' },
      actions: [
        moveZoneAction('bonus', 20, 'Перенос силы'),
        {
          id: 'strike',
          name: 'Удар силы',
          defName: 'Spiritual Weapon',
          cost: 'free',
          primary: 'attack',
          attack: { rangeType: 'melee' },
          count: 1,
          damage: {
            dice: { scale: { dice: { ref: 'part', part: 'main', fallback: '1d8' }, by: 'upcast' } },
            types: ['force'],
            abilityMod: true,
          },
          targeting: { kind: 'creature', range: 5, from: 'origin' },
        },
      ],
    },
  },

  'XPHB:Conjure Fey': {
    key: 'XPHB:Conjure Fey',
    name: 'Conjure Fey',
    primary: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 0 },
      origin: 'point',
      duration: CONCENTRATION,
      movable: true,
      flags: { subtle: true, sprite: 'fey' },
      actions: [
        moveZoneAction('bonus', 30, 'Шаг духа'),
        {
          id: 'strike',
          name: 'Удар духа',
          defName: 'Conjure Fey',
          cost: 'free',
          primary: 'attack',
          attack: { rangeType: 'melee' },
          count: 1,
          damage: { dice: { ref: 'spellDamage', fallback: '3d12' }, types: ['psychic'], abilityMod: true },
          effects: [
            {
              id: 'fear',
              name: 'Conjure Fey',
              duration: { type: 'endOfTurn', of: 'source' },
              to: 'targets',
              modifiers: [],
              conditions: ['frightened'],
            },
          ],
          targeting: { kind: 'creature', range: 5, from: 'origin' },
        },
      ],
    },
  },

  'XGE:Storm Sphere': {
    key: 'XGE:Storm Sphere',
    name: 'Storm Sphere',
    primary: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      flags: { difficultTerrain: true },
      onCreate: stormTrigger(),
      triggers: { endOfTurn: stormTrigger() },
      actions: [
        {
          id: 'bolt',
          name: 'Молния',
          cost: 'bonus',
          primary: 'attack',
          attack: { rangeType: 'ranged', advantageInZone: true },
          count: 1,
          damage: {
            dice: { scale: { dice: { ref: 'part', part: 'repeat', fallback: '4d6' }, by: 'upcast' } },
            types: ['lightning'],
          },
          targeting: { kind: 'creature', range: 60, from: 'origin' },
        },
      ],
    },
  },

  'XPHB:Flame Strike': {
    key: 'XPHB:Flame Strike',
    name: 'Flame Strike',
    primary: 'save',
    save: { ability: 'dex', half: true },
    damage: {
      parts: [
        {
          dice: { scale: { dice: { ref: 'part', part: 'main', index: 0, fallback: '5d6' }, by: 'upcast' } },
          type: 'fire',
        },
        {
          dice: { scale: { dice: { ref: 'part', part: 'main', index: 1, fallback: '5d6' }, by: 'upcast' } },
          type: 'radiant',
        },
      ],
    },
  },

  'XPHB:Ice Storm': {
    key: 'XPHB:Ice Storm',
    name: 'Ice Storm',
    primary: 'save',
    save: { ability: 'dex', half: true },
    damage: {
      parts: [
        {
          dice: { scale: { dice: { ref: 'part', part: 'main', index: 0, fallback: '2d10' }, by: 'upcast' } },
          type: 'bludgeoning',
        },
        { dice: { ref: 'part', part: 'main', index: 1, fallback: '4d6' }, type: 'cold' },
      ],
    },
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: { type: 'rounds', rounds: 2 },
      flags: { difficultTerrain: true },
    },
  },

  // Батч И (R16): последние билдеры — триггеры эффектов (смайты, кислота, Heroism),
  // успех/нежить (Enervation, Negative Energy Flood), лечение (Heal), Heroes' Feast
  // и действие «Изгнание» Dispel Evil and Good.
  "XPHB:Melf's Acid Arrow": {
    key: "XPHB:Melf's Acid Arrow",
    name: 'Acid Arrow',
    primary: 'attack',
    attack: { rangeType: 'ranged' },
    count: 1,
    halfOnMiss: true,
    damage: {
      dice: { concat: [{ scale: { dice: { ref: 'part', part: 'main', fallback: '4d4' }, by: 'upcast' } }, 'acid'] },
      types: ['acid'],
    },
    effects: [
      {
        id: 'acid',
        name: 'Acid Arrow',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [],
        triggers: {
          endOfTurn: {
            damage: {
              dice: { concat: [{ scale: { dice: { ref: 'part', part: 'repeat', fallback: '2d4' }, by: 'upcast' } }, 'acid'] },
              types: ['acid'],
            },
          },
        },
      },
    ],
  },

  'XPHB:Searing Smite': {
    key: 'XPHB:Searing Smite',
    name: 'Searing Smite',
    primary: 'auto',
    damage: { dice: { ref: 'spellDamage', fallback: '1d6' }, types: ['fire'] },
    effects: [
      {
        id: 'burn',
        name: 'Searing Smite',
        duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'start' },
        to: 'targets',
        modifiers: [],
        triggers: { startOfTurn: { damage: { dice: { ref: 'spellDamage', fallback: '1d6' }, types: ['fire'] } } },
      },
    ],
  },

  'XPHB:Ensnaring Strike': {
    key: 'XPHB:Ensnaring Strike',
    name: 'Ensnaring Strike',
    primary: 'save',
    concentration: true,
    save: { ability: 'str' },
    effects: [
      {
        id: 'ensnare',
        name: 'Ensnaring Strike',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [],
        conditions: ['restrained'],
        escape: { ability: 'str', skill: 'athletics' },
        triggers: { startOfTurn: { damage: { dice: { ref: 'spellDamage', fallback: '1d6' }, types: ['piercing'] } } },
      },
    ],
  },

  'XPHB:Vitriolic Sphere': {
    key: 'XPHB:Vitriolic Sphere',
    name: 'Vitriolic Sphere',
    primary: 'save',
    save: { ability: 'dex', half: true },
    damage: {
      dice: { concat: [{ scale: { dice: { ref: 'part', part: 'main', fallback: '10d4' }, by: 'upcast' } }, 'acid'] },
      types: ['acid'],
    },
    effects: [
      {
        id: 'acid',
        name: 'Vitriolic Sphere',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [],
        triggers: {
          endOfTurn: { damage: { dice: { concat: [{ ref: 'part', part: 'repeat', fallback: '5d4' }, 'acid'] }, types: ['acid'] } },
        },
      },
    ],
  },

  'XGE:Enervation': {
    key: 'XGE:Enervation',
    name: 'Enervation',
    primary: 'save',
    concentration: true,
    save: { ability: 'dex' },
    damage: {
      dice: { concat: [{ scale: { dice: { ref: 'part', part: 'main', fallback: '4d8' }, by: 'upcast' } }, 'necrotic'] },
      types: ['necrotic'],
    },
    successDamage: {
      dice: { concat: [{ scale: { dice: { ref: 'part', part: 'success', fallback: '2d8' }, by: 'upcast' } }, 'necrotic'] },
      types: ['necrotic'],
    },
    effects: [
      {
        id: 'drain',
        name: 'Enervation',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [],
        selfOnFail: true,
        actions: [
          {
            id: 'drain',
            name: 'Вытягивание жизни',
            cost: 'action',
            primary: 'auto',
            damage: {
              dice: { concat: [{ scale: { dice: { ref: 'part', part: 'repeat', fallback: '4d8' }, by: 'upcast' } }, 'necrotic'] },
              types: ['necrotic'],
            },
            lifesteal: true,
            targeting: { kind: 'creature', range: 60 },
          },
        ],
      },
    ],
  },

  'XPHB:Dispel Evil and Good': {
    key: 'XPHB:Dispel Evil and Good',
    name: 'Dispel Evil and Good',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'carrier',
        name: 'Dispel Evil and Good',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [],
        actions: [
          {
            id: 'banish',
            name: 'Изгнание',
            cost: 'action',
            primary: 'save',
            save: { ability: 'cha' },
            banishOnFail: true,
            requiresCreatureTypes: ['celestial', 'elemental', 'fey', 'fiend', 'undead'],
            targeting: { kind: 'creature', range: 5 },
          },
        ],
      },
    ],
  },
};
