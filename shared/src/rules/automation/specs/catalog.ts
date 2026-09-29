import { CONCENTRATION, EVIL_GOOD_TYPES, PERMANENT } from '../header';
import type { AutomationSpec } from '../spec';

export const CATALOG_SPECS: Record<string, AutomationSpec> = {
  // Батч Б2 (R16): утилиты каталога; билдер Dispel Magic удалён.
  'XPHB:Revivify': {
    key: 'XPHB:Revivify',
    name: 'Revivify',
    primary: 'utility',
    utility: { kind: 'revive' },
    targeting: { kind: 'creature', range: 5 },
  },

  'XPHB:Spare the Dying': {
    key: 'XPHB:Spare the Dying',
    name: 'Spare the Dying',
    primary: 'utility',
    utility: { kind: 'stabilize' },
    targeting: { kind: 'creature', range: 15 },
  },

  'XPHB:Dispel Magic': {
    key: 'XPHB:Dispel Magic',
    name: 'Dispel Magic',
    primary: 'utility',
    utility: { kind: 'dispel' },
    targeting: { kind: 'creature', range: 120 },
  },

  // Батч Б3 (R16): зоны и ауры каталога.
  'XPHB:Grease': {
    key: 'XPHB:Grease',
    name: 'Grease',
    primary: 'effect',
    save: { ability: 'dex' },
    effects: [
      { id: 'grease', name: 'Grease', duration: PERMANENT, to: 'targets', modifiers: [], conditions: ['prone'] },
    ],
    zone: {
      area: { shape: 'cube', size: 10 },
      origin: 'point',
      duration: { type: 'rounds', rounds: 10 },
      triggers: {
        enter: {
          save: { ability: 'dex' },
          effects: [
            { id: 'greaseEnter', name: 'Grease', duration: PERMANENT, to: 'targets', modifiers: [], conditions: ['prone'] },
          ],
        },
        endOfTurn: {
          save: { ability: 'dex' },
          effects: [
            { id: 'greaseEnd', name: 'Grease', duration: PERMANENT, to: 'targets', modifiers: [], conditions: ['prone'] },
          ],
        },
      },
      flags: { difficultTerrain: true },
    },
  },

  'XPHB:Circle of Power': {
    key: 'XPHB:Circle of Power',
    name: 'Circle of Power',
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
            id: 'circleOfPower',
            name: 'Circle of Power',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'save', mode: 'advantage', filter: { magical: true } }],
            triggers: { saveSucceeded: { noDamageOnSuccess: true } },
          },
        ],
      },
    },
  },

  'XPHB:Aura of Life': {
    key: 'XPHB:Aura of Life',
    name: 'Aura of Life',
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
            id: 'auraOfLife',
            name: 'Aura of Life',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'necrotic' } }],
          },
        ],
      },
      triggers: { startOfTurn: { healTo: 1 } },
    },
  },

  'XPHB:Aura of Purity': {
    key: 'XPHB:Aura of Purity',
    name: 'Aura of Purity',
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
            id: 'auraOfPurity',
            name: 'Aura of Purity',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [
              { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'poison' } },
              {
                target: 'save',
                mode: 'advantage',
                filter: { conditions: ['blinded', 'charmed', 'deafened', 'frightened', 'poisoned', 'stunned'] },
              },
            ],
            conditionImmunities: ['poisoned'],
          },
        ],
      },
    },
  },

  // Батч Е (R16): оставшиеся каталожные записи — shape (Polymorph), флаги движения
  // (Freedom of Movement), conditionImmunitiesFrom (Protection from Evil and Good)
  // и saveSuccess (Otto's Irresistible Dance).
  'XPHB:Polymorph': {
    key: 'XPHB:Polymorph',
    name: 'Polymorph',
    primary: 'save',
    concentration: true,
    save: { ability: 'wis' },
    shape: { kind: 'polymorph', crByTarget: true },
  },

  'XPHB:Freedom of Movement': {
    key: 'XPHB:Freedom of Movement',
    name: 'Freedom of Movement',
    primary: 'effect',
    effects: [
      {
        id: 'freedom',
        name: 'Freedom of Movement',
        duration: { type: 'rounds', rounds: 600 },
        to: 'targets',
        modifiers: [],
        conditionImmunities: ['paralyzed', 'restrained'],
        immuneToSpeedReduction: true,
        ignoresDifficultTerrain: true,
      },
    ],
  },

  'XPHB:Protection from Evil and Good': {
    key: 'XPHB:Protection from Evil and Good',
    name: 'Protection from Evil and Good',
    primary: 'effect',
    concentration: true,
    targeting: { kind: 'creature', range: 5 },
    effects: [
      {
        id: 'protection',
        name: 'Protection from Evil and Good',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [
          {
            target: 'attack',
            mode: 'disadvantage',
            filter: { direction: 'against', creatureTypes: EVIL_GOOD_TYPES },
          },
          { target: 'save', mode: 'advantage', filter: { conditions: ['charmed', 'frightened'] } },
        ],
        conditionImmunitiesFrom: { conditions: ['charmed', 'frightened'], types: EVIL_GOOD_TYPES },
      },
    ],
  },

  "XPHB:Otto's Irresistible Dance": {
    key: "XPHB:Otto's Irresistible Dance",
    name: 'Irresistible Dance',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    targeting: { kind: 'creature', range: 30 },
    saveSuccess: [
      {
        id: 'success',
        name: 'Irresistible Dance',
        duration: { type: 'endOfTurn', of: 'target' },
        to: 'targets',
        modifiers: [{ target: 'speed', mode: 'multiply', value: 0 }],
      },
    ],
    effects: [
      {
        id: 'dance',
        name: 'Irresistible Dance',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        // Чип `charmed` не ставим: у состояния нет движковой механики (deploy-инвариант),
        // эффект целиком выражен модификаторами ниже + действие «Собраться».
        modifiers: [
          { target: 'speed', mode: 'multiply', value: 0 },
          { target: 'save', mode: 'disadvantage', filter: { ability: 'dex' } },
          { target: 'attack', mode: 'disadvantage', filter: { direction: 'self' } },
          { target: 'attack', mode: 'advantage', filter: { direction: 'against' } },
        ],
        escape: {
          kind: 'save',
          ability: 'wis',
          dc: 10,
          label: 'Собраться',
          iconKey: "XPHB:Otto's Irresistible Dance:stopDancing",
        },
      },
    ],
  },
};
