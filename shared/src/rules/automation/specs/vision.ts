import { CONCENTRATION, PERMANENT } from '../header';
import type { AutomationSpec } from '../spec';

export const VISION_SPECS: Record<string, AutomationSpec> = {
  // Батч `vision` (R16 §3.7): свет, сенсы, скрытие; флаги зон — pass-through.
  'XPHB:Light': {
    key: 'XPHB:Light',
    name: 'Light',
    primary: 'effect',
    effects: [
      { id: 'light', name: 'Light', duration: PERMANENT, to: 'targets', modifiers: [], light: { bright: 20, dim: 20 } },
    ],
  },

  'XPHB:Continual Flame': {
    key: 'XPHB:Continual Flame',
    name: 'Continual Flame',
    primary: 'effect',
    effects: [
      {
        id: 'flame',
        name: 'Continual Flame',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [],
        light: { bright: 20, dim: 20 },
      },
    ],
  },

  'XPHB:Darkvision': {
    key: 'XPHB:Darkvision',
    name: 'Darkvision',
    primary: 'effect',
    effects: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        duration: { type: 'rounds', rounds: 4800 },
        to: 'targets',
        modifiers: [],
        senses: [{ type: 'darkvision', range: 150 }],
      },
    ],
  },

  'XPHB:See Invisibility': {
    key: 'XPHB:See Invisibility',
    name: 'See Invisibility',
    primary: 'effect',
    effects: [
      {
        id: 'seeInvisibility',
        name: 'See Invisibility',
        duration: PERMANENT,
        to: 'self',
        modifiers: [],
        seesInvisible: true,
      },
    ],
  },

  'XPHB:Pass without Trace': {
    key: 'XPHB:Pass without Trace',
    name: 'Pass without Trace',
    primary: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 30 },
      origin: 'self',
      anchor: 'source',
      duration: CONCENTRATION,
      aura: {
        effects: [
          {
            id: 'aura',
            name: 'Pass without Trace',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'check', mode: 'add', value: 10, filter: { skill: 'stealth' } }],
          },
        ],
      },
    },
  },

  'XPHB:Silence': {
    key: 'XPHB:Silence',
    name: 'Silence',
    primary: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      containment: 'fullyWithin',
      flags: { silence: true },
      aura: {
        effects: [
          {
            id: 'aura',
            name: 'Silence',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'damage', mode: 'immunity', value: 0, filter: { damageType: 'thunder' } }],
            conditions: ['deafened'],
          },
        ],
      },
    },
  },

  'XPHB:Darkness': {
    key: 'XPHB:Darkness',
    name: 'Darkness',
    primary: 'auto',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 15 },
      origin: 'point',
      duration: CONCENTRATION,
      flags: { blocksLight: true },
    },
  },

  'XPHB:Fog Cloud': {
    key: 'XPHB:Fog Cloud',
    name: 'Fog Cloud',
    primary: 'auto',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      flags: { obscured: 'heavy' },
    },
  },
};
