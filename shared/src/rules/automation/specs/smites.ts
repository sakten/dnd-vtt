import { CONCENTRATION, PERMANENT, UNTIL_NEXT_TURN } from '../header';
import type { AutomationSpec } from '../spec';

export const SMITES_SPECS: Record<string, AutomationSpec> = {
  // Батч смайтов (XPHB 2024): кости к попаданию оружием, спас и эффекты при провале.
  'XPHB:Divine Smite': {
    key: 'XPHB:Divine Smite',
    name: 'Divine Smite',
    primary: 'auto',
    damage: { dice: { ref: 'spellDamage', fallback: '2d8' }, types: ['radiant'] },
  },

  'XPHB:Thunderous Smite': {
    key: 'XPHB:Thunderous Smite',
    name: 'Thunderous Smite',
    primary: 'auto',
    save: { ability: 'str' },
    force: { kind: 'push', feet: 10 },
    damage: { dice: { ref: 'spellDamage', fallback: '2d6' }, types: ['thunder'] },
    effects: [
      {
        id: 'prone',
        name: 'Thunderous Smite',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [],
        conditions: ['prone'],
      },
    ],
  },

  'XPHB:Wrathful Smite': {
    key: 'XPHB:Wrathful Smite',
    name: 'Wrathful Smite',
    primary: 'auto',
    concentration: true,
    save: { ability: 'wis' },
    damage: { dice: { ref: 'spellDamage', fallback: '1d6' }, types: ['necrotic'] },
    effects: [
      {
        id: 'frightened',
        name: 'Wrathful Smite',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'start' },
        concentration: true,
        to: 'targets',
        modifiers: [],
        conditions: ['frightened'],
      },
    ],
  },

  'XPHB:Blinding Smite': {
    key: 'XPHB:Blinding Smite',
    name: 'Blinding Smite',
    primary: 'auto',
    concentration: true,
    save: { ability: 'con' },
    damage: { dice: { ref: 'spellDamage', fallback: '3d8' }, types: ['radiant'] },
    effects: [
      {
        id: 'blinded',
        name: 'Blinding Smite',
        duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'start' },
        concentration: true,
        to: 'targets',
        modifiers: [],
        conditions: ['blinded'],
      },
    ],
  },

  'XPHB:Shining Smite': {
    key: 'XPHB:Shining Smite',
    name: 'Shining Smite',
    primary: 'auto',
    concentration: true,
    damage: { dice: { ref: 'spellDamage', fallback: '2d6' }, types: ['radiant'] },
    effects: [
      {
        id: 'shine',
        name: 'Shining Smite',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'attack', mode: 'advantage', filter: { direction: 'against' } }],
        conditionImmunities: ['invisible'],
        light: { bright: 0, dim: 5 },
      },
    ],
  },

  'XPHB:Staggering Smite': {
    key: 'XPHB:Staggering Smite',
    name: 'Staggering Smite',
    primary: 'auto',
    save: { ability: 'wis' },
    damage: { dice: { ref: 'spellDamage', fallback: '4d6' }, types: ['psychic'] },
    effects: [
      {
        id: 'stunned',
        name: 'Staggering Smite',
        duration: UNTIL_NEXT_TURN,
        to: 'targets',
        modifiers: [],
        conditions: ['stunned'],
      },
    ],
  },

  'XPHB:Banishing Smite': {
    key: 'XPHB:Banishing Smite',
    name: 'Banishing Smite',
    primary: 'auto',
    concentration: true,
    save: { ability: 'cha' },
    damage: { dice: { ref: 'spellDamage', fallback: '5d10' }, types: ['force'] },
    effects: [
      {
        id: 'banish',
        name: 'Banishing Smite',
        duration: { type: 'rounds', rounds: 10 },
        concentration: true,
        to: 'targets',
        modifiers: [],
        conditions: ['incapacitated'],
        banish: true,
      },
    ],
  },

  'XPHB:Hail of Thorns': {
    key: 'XPHB:Hail of Thorns',
    name: 'Hail of Thorns',
    primary: 'auto',
    damage: { dice: { ref: 'spellDamage', fallback: '1d10' }, types: ['piercing'] },
    weaponAttack: {
      secondary: {
        rangeFeet: 5,
        dice: { join: { parts: [{ ref: 'damage', fallback: '1d10' }, { ref: 'upcastDice' }], sep: ' + ' } },
        damageType: 'piercing',
        save: { ability: 'dex', half: true },
        includePrimary: true,
      },
    },
  },

  'XPHB:Lightning Arrow': {
    key: 'XPHB:Lightning Arrow',
    name: 'Lightning Arrow',
    primary: 'auto',
    damage: { dice: { ref: 'spellDamage', fallback: '4d8' }, types: ['lightning'] },
    weaponAttack: {
      replace: true,
      secondary: {
        rangeFeet: 10,
        dice: {
          join: { parts: [{ ref: 'part', part: 'trigger', fallback: '2d8' }, { ref: 'upcastDice' }], sep: ' + ' },
        },
        damageType: 'lightning',
        save: { ability: 'dex', half: true },
      },
    },
  },
};
