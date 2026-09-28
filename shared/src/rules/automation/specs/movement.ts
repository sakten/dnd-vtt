import { CONCENTRATION } from '../header';
import type { AutomationSpec } from '../spec';

export const MOVEMENT_SPECS: Record<string, AutomationSpec> = {
  'XPHB:Misty Step': {
    key: 'XPHB:Misty Step',
    name: 'Misty Step',
    primary: 'utility',
    utility: { kind: 'teleport', amount: 30 },
    targeting: { kind: 'point', range: 30 },
  },

  'XGE:Scatter': {
    key: 'XGE:Scatter',
    name: 'Scatter',
    primary: 'utility',
    utility: { kind: 'scatter', targets: 5, destinationFeet: 120 },
    targeting: { kind: 'point', range: 30 },
  },

  'XGE:Far Step': {
    key: 'XGE:Far Step',
    name: 'Far Step',
    primary: 'utility',
    concentration: true,
    utility: { kind: 'teleport', amount: 60 },
    effects: [
      {
        id: 'far',
        name: 'Far Step',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        actions: [
          {
            id: 'farStep',
            name: 'Прыжок',
            cost: 'bonus',
            primary: 'utility',
            utility: { kind: 'teleport', amount: 60 },
            targeting: { kind: 'point', range: 60 },
          },
        ],
      },
    ],
  },

  'XPHB:Dimension Door': {
    key: 'XPHB:Dimension Door',
    name: 'Dimension Door',
    primary: 'utility',
    utility: {
      kind: 'teleport',
      amount: 500,
      passenger: { feet: 5, destFeet: 5 },
      ignoreSight: true,
      blockedDamage: { dice: { ref: 'damage', fallback: '4d6' }, types: ['force'] },
    },
    targeting: { kind: 'point', range: 500 },
  },

  'XGE:Thunder Step': {
    key: 'XGE:Thunder Step',
    name: 'Thunder Step',
    primary: 'utility',
    utility: {
      kind: 'teleport',
      amount: 90,
      passenger: { feet: 5, destFeet: 5, maxSize: true },
      fromBurst: {
        feet: 10,
        save: { ability: 'con', half: true },
        damage: {
          dice: { scale: { dice: { ref: 'part', part: 'main', fallback: '3d10' }, by: 'upcast' } },
          types: ['thunder'],
        },
      },
    },
    targeting: { kind: 'point', range: 90 },
  },

  'XPHB:Steel Wind Strike': {
    key: 'XPHB:Steel Wind Strike',
    name: 'Steel Wind Strike',
    primary: 'attack',
    attack: { rangeType: 'melee' },
    targets: 5,
    count: 5,
    damage: { dice: { ref: 'part', part: 'main', fallback: '6d10' }, types: ['force'] },
    movement: { teleportAfter: { feet: 5 } },
  },
};
