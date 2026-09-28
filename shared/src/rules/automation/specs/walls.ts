import { PERMANENT } from '../header';
import type { AutomationSpec } from '../spec';
import { wallZone, wallPayload, fireDice, barrierDice, thornSlashDice, iceAppearDice, iceSheetDice, lightDice } from './factories';

export const WALLS_SPECS: Record<string, AutomationSpec> = {
  'XPHB:Wall of Fire': {
    key: 'XPHB:Wall of Fire',
    name: 'Wall of Fire',
    primary: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    choices: [{ id: 'mode', param: 'effect', options: ['vertical', 'horizontal', 'ring'] }],
    damage: { dice: fireDice(), types: ['fire'] },
    zone: wallZone({
      enterOncePerTurn: true,
      triggers: { enter: wallPayload(fireDice(), 'fire'), endOfTurn: wallPayload(fireDice(), 'fire') },
      flags: { obscured: 'heavy' },
    }),
  },

  'XPHB:Blade Barrier': {
    key: 'XPHB:Blade Barrier',
    name: 'Blade Barrier',
    primary: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    choices: [{ id: 'mode', param: 'effect', options: ['vertical', 'horizontal', 'ring'] }],
    damage: { dice: barrierDice(), types: ['force'] },
    zone: wallZone({
      enterOncePerTurn: true,
      triggers: { enter: wallPayload(barrierDice(), 'force'), endOfTurn: wallPayload(barrierDice(), 'force') },
      flags: { difficultTerrain: true },
    }),
  },

  'XPHB:Wall of Thorns': {
    key: 'XPHB:Wall of Thorns',
    name: 'Wall of Thorns',
    primary: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    choices: [{ id: 'mode', param: 'effect', options: ['vertical', 'horizontal', 'ring'] }],
    damage: {
      dice: { concat: [{ scale: { dice: { ref: 'part', part: 'main', fallback: '7d8' }, by: 'upcast' } }, 'piercing'] },
      types: ['piercing'],
    },
    zone: wallZone({
      enterOncePerTurn: true,
      triggers: {
        enter: wallPayload(thornSlashDice(), 'slashing'),
        endOfTurn: wallPayload(thornSlashDice(), 'slashing'),
      },
      flags: { difficultTerrain: true, obscured: 'heavy', movementCost: 4 },
    }),
  },

  'XPHB:Wall of Ice': {
    key: 'XPHB:Wall of Ice',
    name: 'Wall of Ice',
    primary: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    choices: [{ id: 'mode', param: 'effect', options: ['wall', 'ring'] }],
    damage: { dice: iceAppearDice(), types: ['cold'] },
    zone: wallZone({
      wall: {
        sectionFeet: 10,
        hp: 30,
        ac: 12,
        immunities: ['cold', 'poison', 'psychic'],
        vulnerabilities: ['fire'],
        blocksMovement: true,
        blocksLineOfSight: true,
        breach: { save: { ability: 'con', half: true }, damage: { dice: iceSheetDice(), types: ['cold'] } },
      },
      flags: { blocksLineOfSight: true },
    }),
  },

  'XPHB:Wall of Force': {
    key: 'XPHB:Wall of Force',
    name: 'Wall of Force',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'mode', param: 'effect', options: ['wall', 'ring'] }],
    zone: wallZone({
      wall: {
        sectionFeet: 10,
        immune: true,
        blocksMovement: true,
        blocksLineOfSight: false,
        blocksActions: true,
      },
    }),
  },

  'XPHB:Wall of Stone': {
    key: 'XPHB:Wall of Stone',
    name: 'Wall of Stone',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'mode', param: 'effect', options: ['wall'] }],
    zone: wallZone({
      wall: {
        sectionFeet: 10,
        hp: 180,
        ac: 15,
        immunities: ['poison', 'psychic'],
        blocksMovement: true,
        blocksLineOfSight: true,
      },
      flags: { blocksLineOfSight: true },
    }),
  },

  'XGE:Wall of Sand': {
    key: 'XGE:Wall of Sand',
    name: 'Wall of Sand',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'mode', param: 'effect', options: ['vertical', 'horizontal'] }],
    zone: wallZone({
      aura: {
        effects: [
          {
            id: 'sand',
            name: 'Wall of Sand',
            duration: PERMANENT,
            to: 'targets',
            conditions: ['blinded'],
            variant: { ref: 'choice', optional: true },
          },
        ],
      },
      flags: { obscured: 'heavy', movementCost: 3 },
    }),
  },

  'XGE:Wall of Light': {
    key: 'XGE:Wall of Light',
    name: 'Wall of Light',
    primary: 'save',
    concentration: true,
    save: { ability: 'con', half: true },
    choices: [{ id: 'mode', param: 'effect', options: ['vertical', 'horizontal'] }],
    damage: { dice: lightDice('main'), types: ['radiant'] },
    effects: [
      {
        id: 'blind',
        name: 'Wall of Light',
        duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'end' },
        to: 'targets',
        conditions: ['blinded'],
      },
    ],
    zone: wallZone({
      triggers: { endOfTurn: { damage: { dice: lightDice('repeat', 0), types: ['radiant'] } } },
      flags: { blocksLineOfSight: true },
      light: { bright: 120, dim: 120 },
      actions: [
        {
          id: 'beam',
          name: 'Луч',
          defName: 'Луч света',
          cost: 'action',
          shrinkFeet: 10,
          primary: 'attack',
          attack: { rangeType: 'ranged' },
          count: 1,
          damage: { dice: lightDice('repeat', 1), types: ['radiant'] },
          targeting: { kind: 'creature', range: 60, from: 'origin' },
        },
      ],
    }),
  },
};
