import { CONCENTRATION, PERMANENT } from '../header';
import type { AutomationSpec } from '../spec';
import { moveZoneAction, jallarziDamage } from './factories';

export const ZONES_SPECS: Record<string, AutomationSpec> = {
  // Батч Б4 (R16): auto-зоны каталога.
  'XPHB:Hunger of Hadar': {
    key: 'XPHB:Hunger of Hadar',
    name: 'Hunger of Hadar',
    primary: 'auto',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      aura: {
        effects: [
          {
            id: 'hungerOfHadar',
            name: 'Hunger of Hadar',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [],
            conditions: ['blinded'],
          },
        ],
      },
      triggers: {
        // «В области» — любое пересечение клеток (краевые большие токены тоже бьются).
        startOfTurn: { containment: 'anyCell', damage: { dice: '2d6', types: ['cold'] } },
        endOfTurn: {
          containment: 'anyCell',
          save: { ability: 'dex' },
          damage: { dice: '2d6', types: ['acid'] },
        },
      },
      flags: { difficultTerrain: true, blocksLight: true },
    },
  },

  'XPHB:Stinking Cloud': {
    key: 'XPHB:Stinking Cloud',
    name: 'Stinking Cloud',
    primary: 'auto',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      triggers: {
        startOfTurn: {
          save: { ability: 'con' },
          effects: [
            {
              id: 'stinkingPoisoned',
              name: 'Stinking Cloud',
              duration: { type: 'endOfTurn', of: 'target' },
              to: 'targets',
              modifiers: [],
              conditions: ['poisoned'],
              restrictions: { noActions: true, noBonus: true },
            },
          ],
        },
      },
      flags: { obscured: 'heavy' },
    },
  },

  'XPHB:Cloudkill': {
    key: 'XPHB:Cloudkill',
    name: 'Cloudkill',
    primary: 'auto',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      movable: true,
      flags: { obscured: 'heavy' },
      triggers: {
        enter: {
          save: { ability: 'con', half: true },
          damage: { dice: { ref: 'spellDamage', fallback: '5d8' }, types: ['poison'] },
        },
        startOfTurn: {
          save: { ability: 'con', half: true },
          damage: { dice: { ref: 'spellDamage', fallback: '5d8' }, types: ['poison'] },
        },
      },
    },
  },

  'XPHB:Sleet Storm': {
    key: 'XPHB:Sleet Storm',
    name: 'Sleet Storm',
    primary: 'auto',
    concentration: true,
    zone: {
      area: { shape: 'cylinder', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      flags: { difficultTerrain: true, obscured: 'heavy' },
      triggers: {
        enter: {
          save: { ability: 'dex' },
          effects: [
            { id: 'sleetEnter', name: 'Sleet Storm', duration: PERMANENT, to: 'targets', modifiers: [], conditions: ['prone'] },
          ],
        },
        startOfTurn: {
          save: { ability: 'dex' },
          effects: [
            { id: 'sleetStart', name: 'Sleet Storm', duration: PERMANENT, to: 'targets', modifiers: [], conditions: ['prone'] },
          ],
        },
      },
    },
  },

  'XPHB:Guardian of Faith': {
    key: 'XPHB:Guardian of Faith',
    name: 'Guardian of Faith',
    primary: 'effect',
    zone: {
      area: { shape: 'sphere', size: 15 },
      origin: 'point',
      duration: PERMANENT,
      side: 'hostile',
      excludeSource: true,
      enterOncePerTurn: true,
      dealtLimit: 60,
      triggers: {
        enter: { save: { ability: 'dex', half: true }, damage: { dice: '20', types: ['radiant'] } },
        startOfTurn: { save: { ability: 'dex', half: true }, damage: { dice: '20', types: ['radiant'] } },
      },
      flags: { sprite: 'guardian' },
    },
  },

  'XPHB:Cordon of Arrows': {
    key: 'XPHB:Cordon of Arrows',
    name: 'Cordon of Arrows',
    primary: 'effect',
    zone: {
      area: { shape: 'sphere', size: 30 },
      origin: 'self',
      duration: PERMANENT,
      enterOncePerTurn: true,
      excludeSource: true,
      side: 'hostile',
      charges: { perLevel: { base: 4, per: 2, above: 'spell' } },
      triggers: {
        enter: { save: { ability: 'dex' }, damage: { dice: { ref: 'part', part: 'main', fallback: '2d4' }, types: ['piercing'] } },
        endOfTurn: { save: { ability: 'dex' }, damage: { dice: { ref: 'part', part: 'main', fallback: '2d4' }, types: ['piercing'] } },
      },
    },
  },

  'XGE:Healing Spirit': {
    key: 'XGE:Healing Spirit',
    name: 'Healing Spirit',
    primary: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'cube', size: 5 },
      origin: 'point',
      duration: CONCENTRATION,
      enterOncePerTurn: true,
      movable: true,
      side: 'ally',
      charges: { spellMod: { base: 1, min: 2 } },
      excludeCreatureTypes: ['construct', 'undead'],
      actions: [
        {
          id: 'move',
          name: 'Перемещение духа',
          cost: 'bonus',
          defKey: 'zone:move',
          primary: 'utility',
          utility: { kind: 'moveZone', amount: 30 },
          targeting: { kind: 'point', range: 30 },
        },
      ],
      triggers: {
        enter: { heal: { dice: { scale: { dice: { ref: 'part', part: 'main', fallback: '1d6' }, by: 'upcast' } } } },
        startOfTurn: { heal: { dice: { scale: { dice: { ref: 'part', part: 'main', fallback: '1d6' }, by: 'upcast' } } } },
      },
    },
  },

  'TCE:Spirit Shroud': {
    key: 'TCE:Spirit Shroud',
    name: 'Spirit Shroud',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'damageType', param: 'damageType', options: ['cold', 'necrotic', 'radiant'] }],
    zone: {
      area: { shape: 'sphere', size: 10 },
      origin: 'self',
      anchor: 'source',
      duration: CONCENTRATION,
      side: 'hostile',
      aura: {
        effects: [
          {
            id: 'shroud',
            name: 'Spirit Shroud',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'speed', mode: 'add', value: -10 }],
            triggers: {
              damaged: {
                extraDamage: {
                  dice: { add: [{ ref: 'damage', fallback: '1d8' }, { ref: 'upcastDice' }] },
                  damageType: { ref: 'choice' },
                  from: 'source',
                },
              },
            },
            variant: { ref: 'choice' },
          },
        ],
      },
    },
  },

  'XPHB:Conjure Minor Elementals': {
    key: 'XPHB:Conjure Minor Elementals',
    name: 'Conjure Minor Elementals',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'damageType', param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning'] }],
    zone: {
      area: { shape: 'sphere', size: 15 },
      origin: 'self',
      anchor: 'source',
      duration: CONCENTRATION,
      side: 'hostile',
      flags: { difficultTerrain: true },
      aura: {
        effects: [
          {
            id: 'cme',
            name: 'Conjure Minor Elementals',
            duration: PERMANENT,
            to: 'targets',
            triggers: {
              damaged: {
                extraDamage: {
                  dice: { add: [{ ref: 'damage', fallback: '2d8' }, { ref: 'upcastDice' }] },
                  damageType: { ref: 'choice' },
                  from: 'source',
                },
              },
            },
            variant: { ref: 'choice' },
          },
        ],
      },
    },
  },

  'XPHB:Destructive Wave': {
    key: 'XPHB:Destructive Wave',
    name: 'Destructive Wave',
    primary: 'save',
    save: { ability: 'con', half: true },
    choices: [{ id: 'damageType', param: 'damageType', options: ['radiant', 'necrotic'] }],
    damage: {
      parts: [
        { dice: { ref: 'part', part: 'main', index: 0, fallback: '5d6' }, type: 'thunder' },
        { dice: { ref: 'part', part: 'main', index: 1, fallback: '5d6' }, type: { ref: 'choice' } },
      ],
    },
    effects: [{ id: 'prone', name: 'Destructive Wave', duration: PERMANENT, to: 'targets', conditions: ['prone'] }],
  },

  // Батч В (R16): зоны-локации — Daylight, перемещаемые сферы Moonbeam/Flaming Sphere,
  // пёс-страж Faithful Hound, аура Crusader's Mantle и носитель Holy Weapon.
  'XPHB:Daylight': {
    key: 'XPHB:Daylight',
    name: 'Daylight',
    primary: 'effect',
    zone: {
      area: { shape: 'sphere', size: 60 },
      origin: 'point',
      duration: PERMANENT,
      light: { bright: 60, dim: 60, sunlight: true },
    },
  },

  'XPHB:Moonbeam': {
    key: 'XPHB:Moonbeam',
    name: 'Moonbeam',
    primary: 'save',
    concentration: true,
    save: { ability: 'con', half: true },
    damage: { dice: { ref: 'spellDamage', fallback: '2d10' }, types: ['radiant'] },
    zone: {
      area: { shape: 'sphere', size: 5 },
      origin: 'point',
      duration: CONCENTRATION,
      light: { bright: 0, dim: 5 },
      triggers: {
        enter: {
          save: { ability: 'con', half: true },
          damage: { dice: { ref: 'spellDamage', fallback: '2d10' }, types: ['radiant'] },
        },
        endOfTurn: {
          save: { ability: 'con', half: true },
          damage: { dice: { ref: 'spellDamage', fallback: '2d10' }, types: ['radiant'] },
        },
      },
      actions: [moveZoneAction('action', 60)],
    },
  },

  'XPHB:Flaming Sphere': {
    key: 'XPHB:Flaming Sphere',
    name: 'Flaming Sphere',
    primary: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 5 },
      origin: 'point',
      duration: CONCENTRATION,
      light: { bright: 20, dim: 20 },
      triggers: {
        enter: {
          save: { ability: 'dex', half: true },
          damage: { dice: { ref: 'spellDamage', fallback: '2d6' }, types: ['fire'] },
        },
        endOfTurn: {
          save: { ability: 'dex', half: true },
          damage: { dice: { ref: 'spellDamage', fallback: '2d6' }, types: ['fire'] },
        },
      },
      actions: [moveZoneAction('bonus', 30)],
    },
  },

  // Пёс невидим и неапкастится (в данных нет upcast): кость — RAW-литерал 4d8.
  "XPHB:Mordenkainen's Faithful Hound": {
    key: "XPHB:Mordenkainen's Faithful Hound",
    name: 'Faithful Hound',
    primary: 'effect',
    side: 'hostile',
    zone: {
      area: { shape: 'sphere', size: 5 },
      origin: 'point',
      duration: PERMANENT,
      side: 'hostile',
      triggers: {
        endOfTurn: { save: { ability: 'dex' }, damage: { dice: '4d8', types: ['force'] } },
      },
      actions: [moveZoneAction('action', 30)],
    },
  },

  // Аура 30 фт: союзники бьют оружием и безоружным ударом +1d4 излучением (RAW-литерал).
  "XPHB:Crusader's Mantle": {
    key: "XPHB:Crusader's Mantle",
    name: "Crusader's Mantle",
    primary: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 30 },
      origin: 'self',
      anchor: 'source',
      duration: CONCENTRATION,
      side: 'ally',
      aura: {
        effects: [
          {
            id: 'mantle',
            name: "Crusader's Mantle",
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'damage', mode: 'add', value: '1d4radiant', filter: { weapon: true } }],
          },
        ],
      },
    },
  },

  "XPHB:Jallarzi's Storm of Radiance": {
    key: "XPHB:Jallarzi's Storm of Radiance",
    name: 'Storm of Radiance',
    primary: 'save',
    concentration: true,
    save: { ability: 'con', half: true },
    damage: jallarziDamage(),
    zone: {
      area: { shape: 'cylinder', size: 10 },
      origin: 'point',
      duration: CONCENTRATION,
      enterOncePerTurn: true,
      flags: { silence: true },
      aura: {
        effects: [
          {
            id: 'storm',
            name: 'Storm of Radiance',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [],
            conditions: ['blinded', 'deafened'],
          },
        ],
      },
      triggers: { enter: { save: { ability: 'con', half: true }, damage: jallarziDamage() }, endOfTurn: { save: { ability: 'con', half: true }, damage: jallarziDamage() } },
    },
  },
};
