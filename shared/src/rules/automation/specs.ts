import { DAMAGE_TYPES, SKILLS } from '../../labels';
import type { EffectDuration } from '../../domain/effects';
import { SPELL_BASES } from './bases';
import { CONCENTRATION, PERMANENT, RESISTANCE_TYPES, UNTIL_NEXT_TURN } from './header';
import type { AutomationSpec, ActionSpec, PayloadSpec, ValueExpr, WallDimsSpec, ZoneSpec } from './spec';

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

/** Bestow Curse: режимы проклятия и карта «режим проверки → характеристика». */
const CHECK_ABILITIES: Record<string, string> = {
  'checks-str': 'str',
  'checks-dex': 'dex',
  'checks-con': 'con',
  'checks-int': 'int',
  'checks-wis': 'wis',
  'checks-cha': 'cha',
};
const CHECK_ABILITY_KEYS = Object.keys(CHECK_ABILITIES);
const BESTOW_CURSE_OPTIONS = [...CHECK_ABILITY_KEYS, 'attacks', 'dodge', 'necrotic'];

/** Перемещение зоны действием владельца (Moonbeam 60, Flaming Sphere 30, Faithful Hound 30). */
const moveZoneAction = (cost: 'action' | 'bonus', feet: number): ActionSpec => ({
  id: 'move',
  name: 'Переместить',
  cost,
  defKey: 'zone:move',
  primary: 'utility',
  utility: { kind: 'moveZone', amount: feet },
  targeting: { kind: 'point', range: feet },
});

/**
 * Реестр спеков (R16, пилот `loadout`): специализированные заклинания оружия и
 * атак. Компилируются в `AutomationDef` (`compileSpec`) и перехватывают билдеры
 * в `derive.ts`; равенство вывода замком `automation.spec.test.ts`.
 */
export const AUTOMATION_SPECS: Record<string, AutomationSpec> = {
  // Батч A (R16): базовые effect-записи каталога — только модификаторы и длительность.
  'XPHB:Shield': {
    key: 'XPHB:Shield',
    name: 'Shield',
    primary: 'effect',
    effects: [
      {
        id: 'shield',
        name: 'Shield',
        duration: UNTIL_NEXT_TURN,
        to: 'self',
        modifiers: [{ target: 'ac', mode: 'add', value: 5 }],
      },
    ],
  },

  'XPHB:Shield of Faith': {
    key: 'XPHB:Shield of Faith',
    name: 'Shield of Faith',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'shieldOfFaith',
        name: 'Shield of Faith',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'ac', mode: 'add', value: 2 }],
      },
    ],
  },

  'XPHB:Mage Armor': {
    key: 'XPHB:Mage Armor',
    name: 'Mage Armor',
    primary: 'effect',
    effects: [
      {
        id: 'mageArmor',
        name: 'Mage Armor',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [{ target: 'ac', mode: 'set', value: '13+dex' }],
      },
    ],
  },

  'XPHB:Barkskin': {
    key: 'XPHB:Barkskin',
    name: 'Barkskin',
    primary: 'effect',
    effects: [
      {
        id: 'barkskin',
        name: 'Barkskin',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [{ target: 'ac', mode: 'set', value: 17 }],
      },
    ],
  },

  'XPHB:Longstrider': {
    key: 'XPHB:Longstrider',
    name: 'Longstrider',
    primary: 'effect',
    effects: [
      {
        id: 'longstrider',
        name: 'Longstrider',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [{ target: 'speed', mode: 'add', value: 10 }],
      },
    ],
  },

  'XPHB:Blur': {
    key: 'XPHB:Blur',
    name: 'Blur',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'blur',
        name: 'Blur',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [{ target: 'attack', mode: 'disadvantage' }],
      },
    ],
  },

  // Батч A2 (R16): остаток effect-записей каталога (баффы, контроль).
  'XPHB:Haste': {
    key: 'XPHB:Haste',
    name: 'Haste',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'haste',
        name: 'Haste',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [
          { target: 'ac', mode: 'add', value: 2 },
          { target: 'speed', mode: 'multiply', value: 2 },
          { target: 'extraActions', mode: 'add', value: 1 },
        ],
      },
    ],
  },

  'XPHB:Stoneskin': {
    key: 'XPHB:Stoneskin',
    name: 'Stoneskin',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'stoneskin',
        name: 'Stoneskin',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'slashing' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'piercing' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'bludgeoning' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'magicalSlashing' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'magicalPiercing' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'magicalBludgeoning' } },
        ],
      },
    ],
  },

  'XPHB:Guidance': {
    key: 'XPHB:Guidance',
    name: 'Guidance',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'guidance',
        name: 'Guidance',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'check', mode: 'add', value: '1d4' }],
      },
    ],
  },

  'XPHB:Hold Person': {
    key: 'XPHB:Hold Person',
    name: 'Hold Person',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'holdPerson',
        name: 'Hold Person',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        conditions: ['paralyzed'],
        modifiers: [],
      },
    ],
  },

  'XPHB:Entangle': {
    key: 'XPHB:Entangle',
    name: 'Entangle',
    primary: 'effect',
    concentration: true,
    save: { ability: 'str' },
    effects: [
      {
        id: 'entangle',
        name: 'Entangle',
        duration: { type: 'untilSave', ability: 'str', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        conditions: ['restrained'],
        modifiers: [],
      },
    ],
  },

  'XPHB:Fear': {
    key: 'XPHB:Fear',
    name: 'Fear',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'fear',
        name: 'Fear',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        conditions: ['frightened'],
        modifiers: [],
      },
    ],
  },

  'XPHB:Color Spray': {
    key: 'XPHB:Color Spray',
    name: 'Color Spray',
    primary: 'effect',
    save: { ability: 'con' },
    effects: [
      {
        id: 'colorSpray',
        name: 'Color Spray',
        duration: UNTIL_NEXT_TURN,
        to: 'targets',
        conditions: ['blinded'],
        modifiers: [],
      },
    ],
  },

  'XPHB:Hold Monster': {
    key: 'XPHB:Hold Monster',
    name: 'Hold Monster',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'holdMonster',
        name: 'Hold Monster',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        conditions: ['paralyzed'],
        modifiers: [],
      },
    ],
  },

  'XPHB:Slow': {
    key: 'XPHB:Slow',
    name: 'Slow',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'slow',
        name: 'Slow',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        targets: 6,
        modifiers: [
          { target: 'speed', mode: 'multiply', value: 0.5 },
          { target: 'ac', mode: 'add', value: -2 },
          { target: 'save', mode: 'add', value: -2, filter: { ability: 'dex' } },
        ],
        restrictions: { noReactions: true, actionOrBonusOnly: true, oneAttackOnly: true, spellFailureChance: 25 },
      },
    ],
  },

  'XPHB:Divine Favor': {
    key: 'XPHB:Divine Favor',
    name: 'Divine Favor',
    primary: 'effect',
    effects: [
      {
        id: 'divineFavor',
        name: 'Divine Favor',
        duration: PERMANENT,
        to: 'self',
        modifiers: [{ target: 'damage', mode: 'add', value: '1d4radiant', filter: { weapon: true, unarmed: false } }],
      },
    ],
  },

  // Батч Б1 (R16): записи каталога на существующих спец-блоках.
  'XPHB:Expeditious Retreat': {
    key: 'XPHB:Expeditious Retreat',
    name: 'Expeditious Retreat',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'expeditiousRetreat',
        name: 'Expeditious Retreat',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [],
        actions: [{ id: 'dash', name: 'Рывок', cost: 'bonus', baseActionId: 'dash' }],
      },
    ],
  },

  "XPHB:Tasha's Hideous Laughter": {
    key: "XPHB:Tasha's Hideous Laughter",
    name: 'Hideous Laughter',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'hideousLaughter',
        name: 'Hideous Laughter',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
        concentration: true,
        to: 'targets',
        conditions: ['incapacitated', 'prone'],
        modifiers: [],
        hooks: { saveOnDamage: { advantage: true } },
      },
    ],
  },

  'XPHB:Faerie Fire': {
    key: 'XPHB:Faerie Fire',
    name: 'Faerie Fire',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'faerieFire',
        name: 'Faerie Fire',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'attack', mode: 'advantage' }],
        light: { bright: 0, dim: 10 },
      },
    ],
  },

  'XPHB:Banishment': {
    key: 'XPHB:Banishment',
    name: 'Banishment',
    primary: 'effect',
    concentration: true,
    save: { ability: 'cha' },
    effects: [
      {
        id: 'banishment',
        name: 'Banishment',
        duration: { type: 'rounds', rounds: 10 },
        concentration: true,
        to: 'targets',
        conditions: ['incapacitated'],
        modifiers: [],
        banish: true,
      },
    ],
  },

  'XPHB:Hypnotic Pattern': {
    key: 'XPHB:Hypnotic Pattern',
    name: 'Hypnotic Pattern',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    effects: [
      {
        id: 'hypnoticPattern',
        name: 'Hypnotic Pattern',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        conditions: ['charmed', 'incapacitated'],
        modifiers: [{ target: 'speed', mode: 'multiply', value: 0 }],
        hooks: { wakeOnDamage: true },
      },
    ],
  },

  'XPHB:Sanctuary': {
    key: 'XPHB:Sanctuary',
    name: 'Sanctuary',
    primary: 'effect',
    targeting: { kind: 'creature', range: 30 },
    effects: [
      {
        id: 'sanctuary',
        name: 'Sanctuary',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [],
        hooks: { sanctuary: true, breakOn: ['attack', 'spell', 'damage'] },
      },
    ],
  },

  'XPHB:Warding Bond': {
    key: 'XPHB:Warding Bond',
    name: 'Warding Bond',
    primary: 'effect',
    effects: [
      {
        id: 'wardingBond',
        name: 'Warding Bond',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [
          { target: 'ac', mode: 'add', value: 1 },
          { target: 'save', mode: 'add', value: 1 },
          ...DAMAGE_TYPES.map((type) => ({
            target: 'damage' as const,
            mode: 'resistance' as const,
            value: 0,
            filter: { damageType: type.key },
          })),
        ],
        hooks: { damageLink: true },
      },
    ],
  },

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
            hooks: { saveNoDamage: true },
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
        hooks: { damageReduce: { dice: SPELL_BASES.resistance.damageReduceDice, types: [{ ref: 'choice' }] } },
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
        hooks: { elementalBane: { damageType: { ref: 'choice' }, dice: SPELL_BASES.elementalBane.extraDice } },
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
        movement: { zephyrStrike: { dice: '1d8', damageType: 'force', speedFeet: 30 } },
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
        hooks: {
          retaliate: {
            damageType: { mapped: { of: { ref: 'choice' }, values: { warm: 'fire', chill: 'cold' } } },
            dice: '2d8',
          },
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
            hooks: {
              takesExtraDamage: {
                dice: { add: [{ ref: 'damage', fallback: '1d8' }, { ref: 'upcastDice' }] },
                damageType: { ref: 'choice' },
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
            hooks: {
              takesExtraDamage: {
                dice: { add: [{ ref: 'damage', fallback: '2d8' }, { ref: 'upcastDice' }] },
                damageType: { ref: 'choice' },
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
                hooks: { wakeOnDamage: true },
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
        hooks: { wakeOnDamage: { if: { includes: { of: { ref: 'choice' }, values: ['asleep'] } }, then: true } },
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
        hooks: {
          takesExtraDamage: {
            if: { includes: { of: { ref: 'choice' }, values: ['necrotic'] } },
            then: { dice: '1d8', damageType: 'necrotic' },
          },
        },
        variant: { ref: 'choice' },
      },
    ],
  },

  'XPHB:Armor of Agathys': {
    key: 'XPHB:Armor of Agathys',
    name: 'Armor of Agathys',
    primary: 'effect',
    effects: [
      {
        id: 'agathys',
        name: 'Armor of Agathys',
        duration: PERMANENT,
        to: 'self',
        hooks: {
          tempHp: { sum: [5, { ref: 'upcastFlat' }] },
          retaliate: { damageType: 'cold', amount: { sum: [5, { ref: 'upcastFlat' }] } },
        },
      },
    ],
  },

  'XPHB:Invisibility': {
    key: 'XPHB:Invisibility',
    name: 'Invisibility',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'invisible',
        name: 'Invisibility',
        duration: PERMANENT,
        concentration: true,
        to: 'targets',
        targets: { perLevel: { base: 1, per: 1, above: 2 } },
        conditions: ['invisible'],
        hooks: { breakOn: ['attack', 'spell'] },
      },
    ],
  },

  'XPHB:Greater Invisibility': {
    key: 'XPHB:Greater Invisibility',
    name: 'Greater Invisibility',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'invisible',
        name: 'Greater Invisibility',
        duration: PERMANENT,
        concentration: true,
        to: 'targets',
        targets: 1,
        conditions: ['invisible'],
      },
    ],
  },

  'XGE:Shadow of Moil': {
    key: 'XGE:Shadow of Moil',
    name: 'Shadow of Moil',
    primary: 'effect',
    effects: [
      {
        id: 'moil',
        name: 'Shadow of Moil',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [
          { target: 'attack', mode: 'disadvantage', filter: { direction: 'against' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'radiant' } },
        ],
        hooks: { retaliate: { damageType: 'necrotic', dice: '2d8' } },
      },
    ],
  },

  'XPHB:Death Ward': {
    key: 'XPHB:Death Ward',
    name: 'Death Ward',
    primary: 'effect',
    effects: [
      {
        id: 'ward',
        name: 'Death Ward',
        duration: { type: 'rounds', rounds: 4800 },
        to: 'targets',
        hooks: { deathWard: true },
      },
    ],
  },

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

  'XPHB:Chain Lightning': {
    key: 'XPHB:Chain Lightning',
    name: 'Chain Lightning',
    primary: 'save',
    save: { ability: 'dex', half: true },
    damage: { dice: { ref: 'damage', fallback: '10d8' }, types: ['lightning'] },
    chain: { jumps: { sum: [3, { ref: 'castLevel' }, -6] }, feet: 30 },
  },

  'XPHB:Ice Knife': {
    key: 'XPHB:Ice Knife',
    name: 'Ice Knife',
    primary: 'attack',
    attack: { rangeType: 'ranged' },
    count: 1,
    damage: { dice: { concat: [{ ref: 'part', part: 'main', fallback: '1d10' }, 'piercing'] }, types: ['piercing'] },
    burst: {
      rangeFeet: 5,
      dice: { concat: [{ scale: { dice: { ref: 'part', part: 'trigger', fallback: '2d6' }, by: 'upcast' } }, 'cold'] },
      damageType: 'cold',
      save: { ability: 'dex', half: false },
      includePrimary: true,
    },
  },

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

  // Батч `selection` (метки): эффект на кастере с привязкой к цели + чип-метка + перенос.
  'XPHB:Hex': {
    key: 'XPHB:Hex',
    name: 'Hex',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'hex',
        name: 'Hex',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        markTarget: true,
        modifiers: [{ target: 'damage', mode: 'add', value: '1d6necrotic' }],
        actions: [
          {
            id: 'remark',
            name: 'Перенести метку',
            defName: 'Hex',
            cost: 'bonus',
            primary: 'manual',
            retarget: true,
            targeting: { kind: 'creature', range: 90 },
          },
        ],
      },
      {
        id: 'mark',
        name: 'Hex',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [],
        mark: true,
      },
    ],
  },
  'XPHB:Bless': {
    key: 'XPHB:Bless',
    name: 'Bless',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'bless',
        name: 'Bless',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        targets: 3,
        modifiers: [
          { target: 'attack', mode: 'add', value: SPELL_BASES.d4Bonus },
          { target: 'save', mode: 'add', value: SPELL_BASES.d4Bonus },
        ],
      },
    ],
  },
  'XPHB:Bane': {
    key: 'XPHB:Bane',
    name: 'Bane',
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'bane',
        name: 'Bane',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        targets: 3,
        modifiers: [
          { target: 'attack', mode: 'add', value: `-${SPELL_BASES.d4Bonus}` },
          { target: 'save', mode: 'add', value: `-${SPELL_BASES.d4Bonus}` },
        ],
      },
    ],
  },
  'XPHB:Beacon of Hope': {
    key: 'XPHB:Beacon of Hope',
    name: 'Beacon of Hope',
    primary: 'effect',
    concentration: true,
    autoTargets: { feet: 30, side: 'ally', includeSelf: true },
    effects: [
      {
        id: 'beacon',
        name: 'Beacon of Hope',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'save', mode: 'advantage', filter: { ability: 'wis' } }],
        hooks: { maximizeHealing: true, deathSaveAdvantage: true },
      },
    ],
  },
  "XPHB:Hunter's Mark": {
    key: "XPHB:Hunter's Mark",
    name: "Hunter's Mark",
    primary: 'effect',
    concentration: true,
    effects: [
      {
        id: 'markTarget',
        name: "Hunter's Mark",
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        markTarget: true,
        modifiers: [{ target: 'damage', mode: 'add', value: '1d6force' }],
        actions: [
          {
            id: 'remark',
            name: 'Перенести метку',
            defName: "Hunter's Mark",
            cost: 'bonus',
            primary: 'manual',
            retarget: true,
            targeting: { kind: 'creature', range: 90 },
          },
        ],
      },
      {
        id: 'mark',
        name: "Hunter's Mark",
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [],
        mark: true,
      },
    ],
  },

  // Штраф «−1d4 к следующему спасброску» сгорает после броска (`consumeOnSave`).
  'XPHB:Mind Sliver': {
    key: 'XPHB:Mind Sliver',
    name: 'Mind Sliver',
    primary: 'save',
    save: { ability: 'int', half: false },
    damage: { dice: { ref: 'cantrip', fallback: '1d6' }, types: ['psychic'] },
    effects: [
      {
        id: 'sliver',
        name: 'Mind Sliver',
        duration: UNTIL_NEXT_TURN,
        to: 'targets',
        modifiers: [{ target: 'save', mode: 'add', value: '-1d4' }],
        uses: { kind: 'consumeOnSave' },
      },
    ],
  },

  // `side` (мгновенные цели) + `$spell`-кости через `{ ref: 'spellDamage' }`.
  'XPHB:Spirit Guardians': {
    key: 'XPHB:Spirit Guardians',
    name: 'Spirit Guardians',
    primary: 'save',
    concentration: true,
    save: { ability: 'wis', half: true },
    side: 'hostile',
    // Выбор при касте: излучение (добрый/нейтральный) или некротика (злой).
    choices: [{ id: 'damageType', param: 'damageType', options: ['radiant', 'necrotic'] }],
    damage: { dice: { ref: 'spellDamage', fallback: '3d8' }, types: [{ ref: 'choice' }] },
    // Пустой массив сохраняет байт-равенство с выводом «деривация + добавки».
    effects: [],
    zone: {
      area: { shape: 'sphere', size: 15 },
      origin: 'point',
      anchor: 'source',
      duration: CONCENTRATION,
      enterOncePerTurn: true,
      excludeSource: true,
      side: 'hostile',
      aura: {
        effects: [
          {
            id: 'aura',
            name: 'Spirit Guardians',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'speed', mode: 'multiply', value: 0.5 }],
          },
        ],
      },
      triggers: {
        enter: {
          save: { ability: 'wis', half: true },
          damage: { dice: { ref: 'spellDamage', fallback: '3d8' }, types: [{ ref: 'choice' }] },
        },
        startOfTurn: {
          save: { ability: 'wis', half: true },
          damage: { dice: { ref: 'spellDamage', fallback: '3d8' }, types: [{ ref: 'choice' }] },
        },
      },
    },
  },
  // Dominate: спас WIS (в бою преимущество), очарование и контроль; апкаст снимает лимит «1 мин».
  'XPHB:Dominate Beast': {
    key: 'XPHB:Dominate Beast',
    name: 'Dominate Beast',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    requiresCreatureTypes: ['beast'],
    saveAdvantageInCombat: true,
    // Базовый круг 4: обёртка ставит 10 раундов для «1 минуты», с 5-го круга — без лимита.
    maxRounds: { levels: [{ above: 5, value: null }] },
    effects: [
      {
        id: 'dominate',
        name: 'Dominate Beast',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'damage' },
        concentration: true,
        to: 'targets',
        modifiers: [],
        conditions: ['charmed'],
        hooks: { saveOnDamage: {}, dominates: true },
      },
    ],
  },
  'XPHB:Dominate Person': {
    key: 'XPHB:Dominate Person',
    name: 'Dominate Person',
    primary: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    requiresCreatureTypes: ['humanoid'],
    saveAdvantageInCombat: true,
    // Базовый круг 5: с 6-го круга лимит «1 минута» снимается.
    maxRounds: { levels: [{ above: 6, value: null }] },
    effects: [
      {
        id: 'dominate',
        name: 'Dominate Person',
        duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'damage' },
        concentration: true,
        to: 'targets',
        modifiers: [],
        conditions: ['charmed'],
        hooks: { saveOnDamage: {}, dominates: true },
      },
    ],
  },
  'XPHB:Telekinesis': {
    key: 'XPHB:Telekinesis',
    name: 'Telekinesis',
    primary: 'utility',
    concentration: true,
    save: { ability: 'str' },
    utility: { kind: 'telekinesis', amount: 30, maxSize: 'huge' },
    targeting: { kind: 'creature', range: 60 },
    effects: [
      {
        id: 'carrier',
        name: 'Telekinesis',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [],
        actions: [
          {
            id: 'grip',
            name: 'Телекинез',
            cost: 'action',
            primary: 'utility',
            save: { ability: 'str' },
            utility: { kind: 'telekinesis', amount: 30, maxSize: 'huge' },
            targeting: { kind: 'creature', range: 60 },
          },
        ],
      },
    ],
  },
  'XPHB:Conjure Woodland Beings': {
    key: 'XPHB:Conjure Woodland Beings',
    name: 'Conjure Woodland Beings',
    primary: 'save',
    concentration: true,
    save: { ability: 'wis', half: true },
    side: 'hostile',
    damage: { dice: { ref: 'spellDamage', fallback: '5d8' }, types: ['force'] },
    effects: [
      {
        id: 'carrier',
        name: 'Conjure Woodland Beings',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [],
        actions: [{ id: 'disengage', name: 'Отход', cost: 'bonus', baseActionId: 'disengage' }],
      },
    ],
    zone: {
      area: { shape: 'sphere', size: 10 },
      origin: 'point',
      anchor: 'source',
      duration: CONCENTRATION,
      enterOncePerTurn: true,
      excludeSource: true,
      side: 'hostile',
      triggers: {
        enter: {
          save: { ability: 'wis', half: true },
          damage: { dice: { ref: 'spellDamage', fallback: '5d8' }, types: ['force'] },
        },
        endOfTurn: {
          save: { ability: 'wis', half: true },
          damage: { dice: { ref: 'spellDamage', fallback: '5d8' }, types: ['force'] },
        },
      },
    },
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
