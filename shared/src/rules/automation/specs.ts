import { SKILLS } from '../../labels';
import type { EffectDuration } from '../../domain/effects';
import { SPELL_BASES } from './bases';
import { CONCENTRATION, PERMANENT, RESISTANCE_TYPES, UNTIL_NEXT_TURN } from './header';
import type { AutomationSpec, PayloadSpec, ValueExpr, WallDimsSpec, ZoneSpec } from './spec';

/** Magic Weapon: +1/+2/+3 к попаданию и урону с 1/3/6 круга (литеральные ступени). */
const MAGIC_WEAPON_BONUS: ValueExpr = {
  tiers: [
    { above: 1, value: 1 },
    { above: 3, value: 2 },
    { above: 6, value: 3 },
  ],
};

/**
 * Шаблон стены (R16): общая шапка зоны (габариты `WALL_DIMS`, точка, концентрация),
 * параметры — триггеры/секции/флаги/свет/действия. Литералы габаритов доступны копиям.
 */
function wallZone(
  params: Omit<ZoneSpec, 'area' | 'origin' | 'duration'> & { dims?: WallDimsSpec; duration?: EffectDuration } = {}
): ZoneSpec {
  const { dims, duration, ...rest } = params;
  return { area: { wall: dims ?? { from: 'spell' } }, origin: 'point', duration: duration ?? CONCENTRATION, ...rest };
}

/** Payload стены: спас DEX и урон (свежие объекты — без алиасов между триггерами). */
function wallPayload(dice: ValueExpr, type: string): PayloadSpec {
  return { containment: 'anyCell', save: { ability: 'dex', half: true }, damage: { dice, types: [type] } };
}

const fireDice = (): ValueExpr => ({
  concat: [{ scale: { dice: { ref: 'part', part: 'main', fallback: '5d8' }, by: 'upcast' } }, 'fire'],
});
const barrierDice = (): ValueExpr => ({ concat: [{ ref: 'part', part: 'main', fallback: '6d10' }, 'force'] });
const thornSlashDice = (): ValueExpr => ({
  concat: [{ scale: { dice: { ref: 'part', part: 'trigger', fallback: '7d8' }, by: 'upcast' } }, 'slashing'],
});
const iceAppearDice = (): ValueExpr => ({
  concat: [{ scale: { dice: { ref: 'part', part: 'main', fallback: '10d6' }, by: { dice: '2d6' } } }, 'cold'],
});
const iceSheetDice = (): ValueExpr => ({
  concat: [{ scale: { dice: { ref: 'part', part: 'trigger', fallback: '5d6' }, by: { dice: '1d6' } } }, 'cold'],
});
const lightDice = (part: 'main' | 'repeat', index?: number): ValueExpr => ({
  concat: [
    { scale: { dice: { ref: 'part', part, index, fallback: '4d8' }, by: 'upcast' } },
    'radiant',
  ],
});

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

  'XPHB:Resistance': {
    key: 'XPHB:Resistance',
    name: 'Resistance',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'damageType', param: 'damageType', options: RESISTANCE_TYPES }],
    effects: [
      {
        id: 'resistance',
        name: 'Resistance',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        damageReduce: { dice: SPELL_BASES.resistance.damageReduceDice, types: [{ ref: 'choice' }] },
        uses: { kind: 'charges', count: 1 },
        variant: { ref: 'choice' },
      },
    ],
  },

  'XGE:Elemental Bane': {
    key: 'XGE:Elemental Bane',
    name: 'Elemental Bane',
    primary: 'effect',
    concentration: true,
    save: { ability: 'con' },
    choices: [{ id: 'damageType', param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'thunder'] }],
    effects: [
      {
        id: 'bane',
        name: 'Elemental Bane',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        targets: 1,
        elementalBane: { damageType: { ref: 'choice' }, dice: SPELL_BASES.elementalBane.extraDice },
        variant: { ref: 'choice' },
      },
    ],
  },

  'XGE:Zephyr Strike': {
    key: 'XGE:Zephyr Strike',
    name: 'Zephyr Strike',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'zephyr',
        name: 'Zephyr Strike',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [{ target: 'attack', mode: 'advantage', filter: { weapon: true } }],
        restrictions: { ignoresOpportunityAttacks: true },
        uses: { kind: 'consumeOnAttack' },
        zephyrStrike: { dice: '1d8', damageType: 'force', speedFeet: 30 },
      },
    ],
  },

  'XPHB:Mirror Image': {
    key: 'XPHB:Mirror Image',
    name: 'Mirror Image',
    primary: 'effect',
    effects: [
      {
        id: 'images',
        name: 'Mirror Image',
        duration: { type: 'rounds', rounds: 10 },
        to: 'self',
        uses: { kind: 'misdirect', ...SPELL_BASES.mirrorImage.misdirect },
      },
    ],
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

  'XPHB:Protection from Energy': {
    key: 'XPHB:Protection from Energy',
    name: 'Protection from Energy',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'damageType', param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'thunder'] }],
    effects: [
      {
        id: 'protection',
        name: 'Protection from Energy',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'damage', mode: 'resistance', value: 0, filter: { damageType: { ref: 'choice' } } }],
        variant: { ref: 'choice' },
      },
    ],
  },

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

  'XPHB:Fire Shield': {
    key: 'XPHB:Fire Shield',
    name: 'Fire Shield',
    primary: 'effect',
    choices: [{ id: 'mode', param: 'effect', options: ['warm', 'chill'] }],
    effects: [
      {
        id: 'shield',
        name: 'Fire Shield',
        duration: PERMANENT,
        to: 'self',
        modifiers: [
          {
            target: 'damage',
            mode: 'resistance',
            value: 0,
            filter: { damageType: { mapped: { of: { ref: 'choice' }, values: { warm: 'cold', chill: 'fire' } } } },
          },
        ],
        retaliate: {
          damageType: { mapped: { of: { ref: 'choice' }, values: { warm: 'fire', chill: 'cold' } } },
          dice: '2d8',
        },
        variant: { ref: 'choice' },
      },
    ],
  },

  "XPHB:Dragon's Breath": {
    key: "XPHB:Dragon's Breath",
    name: "Dragon's Breath",
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'damageType', param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'poison'] }],
    effects: [
      {
        id: 'breath',
        name: "Dragon's Breath",
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        variant: { ref: 'choice' },
        actions: [
          {
            id: 'breath',
            name: 'Выдох',
            cost: 'action',
            primary: 'save',
            save: { ability: 'dex', half: true },
            damage: { dice: { ref: 'spellDamage' }, types: [{ ref: 'choice' }] },
            area: { from: 'spell', fallback: { shape: 'cone', size: 15 } },
            targeting: { kind: 'area', fromArea: true },
          },
        ],
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
            takesExtraDamage: {
              dice: { add: [{ ref: 'damage', fallback: '1d8' }, { ref: 'upcastDice' }] },
              damageType: { ref: 'choice' },
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
            takesExtraDamage: {
              dice: { add: [{ ref: 'damage', fallback: '2d8' }, { ref: 'upcastDice' }] },
              damageType: { ref: 'choice' },
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
        breach: { save: { ability: 'con', half: true }, damage: { dice: iceSheetDice(), types: ['cold'] } },
      },
      flags: { blocksMovement: true, blocksLineOfSight: true },
    }),
  },

  'XPHB:Wall of Force': {
    key: 'XPHB:Wall of Force',
    name: 'Wall of Force',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'mode', param: 'effect', options: ['wall', 'ring'] }],
    zone: wallZone({
      wall: { sectionFeet: 10, immune: true, blocksLineOfSight: false },
      flags: { blocksMovement: true },
    }),
  },

  'XPHB:Wall of Stone': {
    key: 'XPHB:Wall of Stone',
    name: 'Wall of Stone',
    primary: 'effect',
    concentration: true,
    choices: [{ id: 'mode', param: 'effect', options: ['wall'] }],
    zone: wallZone({
      wall: { sectionFeet: 10, hp: 180, ac: 15, immunities: ['poison', 'psychic'], blocksLineOfSight: true },
      flags: { blocksMovement: true, blocksLineOfSight: true },
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
