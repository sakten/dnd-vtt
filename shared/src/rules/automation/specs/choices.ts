import { SKILLS } from '../../../labels';
import { CONCENTRATION, PERMANENT } from '../header';
import type { AutomationSpec } from '../spec';
import { CHECK_ABILITIES, CHECK_ABILITY_KEYS, BESTOW_CURSE_OPTIONS } from './factories';

export const CHOICES_SPECS: Record<string, AutomationSpec> = {
  'XPHB:Blindness/Deafness': {
    key: 'XPHB:Blindness/Deafness',
    name: 'Blindness/Deafness',
    primary: 'effect',
    save: { ability: 'con' },
    choices: [{ id: 'condition', param: 'condition', options: ['blinded', 'deafened'] }],
    effects: [
      {
        id: 'condition',
        name: 'Blindness/Deafness',
        duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'end' },
        to: 'targets',
        targets: 1,
        conditions: [{ ref: 'choice', fallback: 'blinded' }],
        variant: { ref: 'choice' },
      },
    ],
  },

  'XPHB:Command': {
    key: 'XPHB:Command',
    name: 'Command',
    primary: 'effect',
    save: { ability: 'wis' },
    excludeCreatureTypes: ['undead'],
    choices: [
      { id: 'command', param: 'command', options: ['approach', 'drop', 'flee', 'grovel', 'halt'], default: 'halt' },
    ],
    effects: [
      {
        id: 'command',
        name: 'Command',
        duration: { type: 'endOfTurn', of: 'target' },
        to: 'targets',
        targets: 1,
        modifiers: [
          {
            if: { includes: { of: { ref: 'choice' }, values: ['halt', 'grovel'] } },
            then: { target: 'speed', mode: 'multiply', value: 0 },
          },
        ],
        conditions: [{ if: { includes: { of: { ref: 'choice' }, values: ['grovel'] } }, then: 'prone' }],
        restrictions: { noActions: true, noBonus: true },
        variant: { ref: 'choice' },
      },
    ],
  },

  'XPHB:Enhance Ability': {
    key: 'XPHB:Enhance Ability',
    name: 'Enhance Ability',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'ability', param: 'ability', options: ['str', 'dex', 'int', 'wis', 'cha'] }],
    effects: [
      {
        id: 'enhance',
        name: 'Enhance Ability',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        targets: { perLevel: { base: 1, per: 1, above: 2 } },
        modifiers: [{ target: 'check', mode: 'advantage', filter: { ability: { ref: 'choice' } } }],
        variant: { ref: 'choice' },
      },
    ],
  },

  'XGE:Skill Empowerment': {
    key: 'XGE:Skill Empowerment',
    name: 'Skill Empowerment',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'skill', param: 'skill', options: SKILLS.map((s) => s.key) }],
    effects: [
      {
        id: 'skill',
        name: 'Skill Empowerment',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'check', mode: 'add', value: '$proficiency', filter: { skill: { ref: 'choice' } } }],
        variant: { ref: 'choice' },
      },
    ],
  },

  'XPHB:Eyebite': {
    key: 'XPHB:Eyebite',
    name: 'Eyebite',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    targeting: { kind: 'creature', range: 60 },
    choices: [{ id: 'effect', param: 'effect', options: ['asleep', 'panicked', 'sickened'] }],
    effects: [
      {
        id: 'carrier',
        name: 'Eyebite',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        actions: [
          {
            id: 'eyebite:asleep',
            name: 'Eyebite: Сон',
            cost: 'action',
            subKey: 'asleep',
            primary: 'save',
            save: { ability: 'wis' },
            targeting: { kind: 'creature', range: 60 },
            effects: [
              {
                id: 'asleep',
                name: 'Eyebite: Сон',
                duration: CONCENTRATION,
                concentration: true,
                to: 'targets',
                conditions: ['unconscious'],
                triggers: { damaged: { endEffect: true } },
              },
            ],
          },
          {
            id: 'eyebite:panicked',
            name: 'Eyebite: Паника',
            cost: 'action',
            subKey: 'panicked',
            primary: 'save',
            save: { ability: 'wis' },
            targeting: { kind: 'creature', range: 60 },
            effects: [
              {
                id: 'panicked',
                name: 'Eyebite: Паника',
                duration: CONCENTRATION,
                concentration: true,
                to: 'targets',
                conditions: ['frightened'],
              },
            ],
          },
          {
            id: 'eyebite:sickened',
            name: 'Eyebite: Тошнота',
            cost: 'action',
            subKey: 'sickened',
            primary: 'save',
            save: { ability: 'wis' },
            targeting: { kind: 'creature', range: 60 },
            effects: [
              {
                id: 'sickened',
                name: 'Eyebite: Тошнота',
                duration: CONCENTRATION,
                concentration: true,
                to: 'targets',
                conditions: ['poisoned'],
              },
            ],
          },
        ],
      },
      {
        id: 'mark',
        name: 'Eyebite',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        conditions: [
          {
            mapped: {
              of: { ref: 'choice' },
              values: { asleep: 'unconscious', panicked: 'frightened', sickened: 'poisoned' },
            },
          },
        ],
        triggers: {
          damaged: { if: { includes: { of: { ref: 'choice' }, values: ['asleep'] } }, then: { endEffect: true } },
        },
        markSaved: true,
      },
    ],
  },

  'XPHB:Bestow Curse': {
    key: 'XPHB:Bestow Curse',
    name: 'Bestow Curse',
    primary: 'effect',
    save: { ability: 'wis' },
    concentration: { levels: [{ above: 5, value: false }], fallback: true },
    maxRounds: {
      levels: [
        { above: 4, value: 100 },
        { above: 5, value: null },
      ],
      fallback: undefined,
    },
    choices: [{ id: 'curse', param: 'effect', options: BESTOW_CURSE_OPTIONS }],
    effects: [
      {
        id: 'curse',
        name: 'Bestow Curse',
        duration: { levels: [{ above: 5, value: PERMANENT }], fallback: CONCENTRATION },
        concentration: { levels: [{ above: 5, value: false }], fallback: true },
        to: 'targets',
        targets: 1,
        modifiers: [
          {
            if: { includes: { of: { ref: 'choice' }, values: CHECK_ABILITY_KEYS } },
            then: {
              target: 'check',
              mode: 'disadvantage',
              filter: { ability: { mapped: { of: { ref: 'choice' }, values: CHECK_ABILITIES } } },
            },
          },
          {
            if: { includes: { of: { ref: 'choice' }, values: CHECK_ABILITY_KEYS } },
            then: {
              target: 'save',
              mode: 'disadvantage',
              filter: { ability: { mapped: { of: { ref: 'choice' }, values: CHECK_ABILITIES } } },
            },
          },
          {
            if: { includes: { of: { ref: 'choice' }, values: ['attacks'] } },
            then: { target: 'attack', mode: 'disadvantage', filter: { direction: 'against' } },
          },
        ],
        turnDodge: { if: { includes: { of: { ref: 'choice' }, values: ['dodge'] } }, then: { ability: 'wis' } },
        triggers: {
          damaged: {
            if: { includes: { of: { ref: 'choice' }, values: ['necrotic'] } },
            then: { extraDamage: { dice: '1d8', damageType: 'necrotic', from: 'source' } },
          },
        },
        variant: { ref: 'choice' },
      },
    ],
  },
};
