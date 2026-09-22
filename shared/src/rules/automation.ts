import type { ActionDef } from '../domain/actions';
import type {
  AutomationDice,
  AutomationDef,
  AutomationEffect,
  AutomationPayload,
  AutomationSave,
  GrantedAction,
  ZoneDef,
} from '../domain/automation';
import type { EffectDuration } from '../domain/effects';
import type { ClassLevel } from '../domain/sheet';
import { AUTOMATION_ACTIONS } from './automationActions';
import { eldritchBlastMods } from './invocations';
import { monsterAbilityAutomation } from './monsterAbility';
import { summonSpellDef } from './summons';
import { isHealingSpell, spellAttackCount, spellDamageExpression } from './spellCast';
import type { Spell } from './spells';

export { AUTOMATION_ACTIONS };

/**
 * Каталог автоматизации (R8.1). Ключ — `Spell.key` (или id действия для черт).
 * Строка каталога полностью описывает механику; заклинания без строки получают
 * деривацию из данных (`automationForSpell`), а невыразимые механики — `manual`.
 *
 * Для заклинаний с эффектами (Ф8) каталог проверяется раньше деривации: у Bless
 * в данных «фантомный» 1d4 из описания, у Grease урона нет вовсе.
 */

const PERMANENT: EffectDuration = { type: 'permanent' };
const CONCENTRATION: EffectDuration = { type: 'concentration' };
const UNTIL_NEXT_TURN: EffectDuration = { type: 'endOfTurn', of: 'source' };

/** Web: опутан, пока в паутине; выпутывание — STR (Athletics) против СЛ каста. */
const WEB_RESTRAINED: AutomationEffect = {
  name: 'Web',
  duration: PERMANENT,
  to: 'targets',
  modifiers: [],
  conditions: ['restrained'],
  escape: { ability: 'str', skill: 'athletics' },
};

/** Grease: сбит с ног (встаёт, тратя половину движения — вручную). */
const GREASE_PRONE: AutomationEffect = {
  name: 'Grease',
  duration: PERMANENT,
  to: 'targets',
  modifiers: [],
  conditions: ['prone'],
};

/** Sleet Storm: сбит с ног (встаёт, тратя половину движения — вручную). */
const SLEET_PRONE: AutomationEffect = {
  name: 'Sleet Storm',
  duration: PERMANENT,
  to: 'targets',
  modifiers: [],
  conditions: ['prone'],
};

/** Stinking Cloud: отравлен до конца текущего хода; нельзя действие/бонус. */
const STINKING_POISONED: AutomationEffect = {
  name: 'Stinking Cloud',
  duration: { type: 'endOfTurn', of: 'target' },
  to: 'targets',
  modifiers: [],
  conditions: ['poisoned'],
  restrictions: { noActions: true, noBonus: true },
};

/** Строка каталога «заклинание с накладываемыми эффектами». */
function spellEffect(
  key: string,
  name: string,
  effects: AutomationEffect[],
  save?: { ability: AutomationSave['ability']; half?: boolean }
): AutomationDef {
  return {
    key,
    name,
    resolution: 'effect',
    concentration: effects.some((e) => e.concentration) || undefined,
    save,
    effects,
  };
}

export const AUTOMATION_SPELLS: Record<string, AutomationDef> = {
  /** Polymorph (XPHB 2024): спас WIS, форма-зверь с CR ≤ CR/уровня цели, концентрация. */
  'XPHB:Polymorph': {
    key: 'XPHB:Polymorph',
    name: 'Polymorph',
    resolution: 'save',
    concentration: true,
    save: { ability: 'wis' },
    shape: { kind: 'polymorph', crByTarget: true },
  },
  'XPHB:Shield': spellEffect('XPHB:Shield', 'Shield', [
    {
      name: 'Shield',
      duration: UNTIL_NEXT_TURN,
      to: 'self',
      modifiers: [{ target: 'ac', mode: 'add', value: 5 }],
    },
  ]),
  'XPHB:Shield of Faith': spellEffect('XPHB:Shield of Faith', 'Shield of Faith', [
    {
      name: 'Shield of Faith',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [{ target: 'ac', mode: 'add', value: 2 }],
    },
  ]),
  'XPHB:Mage Armor': spellEffect('XPHB:Mage Armor', 'Mage Armor', [
    {
      name: 'Mage Armor',
      duration: PERMANENT,
      to: 'targets',
      modifiers: [{ target: 'ac', mode: 'set', value: '13+dex' }],
    },
  ]),
  'XPHB:Barkskin': spellEffect('XPHB:Barkskin', 'Barkskin', [
    {
      name: 'Barkskin',
      duration: PERMANENT,
      to: 'targets',
      modifiers: [{ target: 'ac', mode: 'set', value: 17 }],
    },
  ]),
  'XPHB:Longstrider': spellEffect('XPHB:Longstrider', 'Longstrider', [
    {
      name: 'Longstrider',
      duration: PERMANENT,
      to: 'targets',
      modifiers: [{ target: 'speed', mode: 'add', value: 10 }],
    },
  ]),
  /** Expeditious Retreat (XPHB 2024): Рывок бонусным действием, пока держится концентрация. */
  'XPHB:Expeditious Retreat': spellEffect('XPHB:Expeditious Retreat', 'Expeditious Retreat', [
    {
      name: 'Expeditious Retreat',
      duration: CONCENTRATION,
      concentration: true,
      to: 'self',
      modifiers: [],
      actions: [{ id: 'dash', name: 'Рывок', cost: 'bonus', baseActionId: 'dash' }],
    },
  ]),
  'XPHB:Blur': spellEffect('XPHB:Blur', 'Blur', [
    {
      name: 'Blur',
      duration: CONCENTRATION,
      concentration: true,
      to: 'self',
      modifiers: [{ target: 'attack', mode: 'disadvantage' }],
    },
  ]),
  'XPHB:Haste': spellEffect('XPHB:Haste', 'Haste', [
    {
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
  ]),
  'XPHB:Stoneskin': spellEffect('XPHB:Stoneskin', 'Stoneskin', [
    {
      name: 'Stoneskin',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [
        { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'slashing' } },
        { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'piercing' } },
        { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'bludgeoning' } },
      ],
    },
  ]),
  'XPHB:Bless': spellEffect('XPHB:Bless', 'Bless', [
    {
      name: 'Bless',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      targets: 3,
      modifiers: [
        { target: 'attack', mode: 'add', value: '1d4' },
        { target: 'save', mode: 'add', value: '1d4' },
      ],
    },
  ]),
  'XPHB:Bane': spellEffect('XPHB:Bane', 'Bane', [
    {
      name: 'Bane',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      targets: 3,
      modifiers: [
        { target: 'attack', mode: 'add', value: '-1d4' },
        { target: 'save', mode: 'add', value: '-1d4' },
      ],
    },
  ]),
  'XPHB:Resistance': spellEffect('XPHB:Resistance', 'Resistance', [
    {
      name: 'Resistance',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [{ target: 'save', mode: 'add', value: '1d4' }],
    },
  ]),
  'XPHB:Guidance': spellEffect('XPHB:Guidance', 'Guidance', [
    {
      name: 'Guidance',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [{ target: 'check', mode: 'add', value: '1d4' }],
    },
  ]),
  'XPHB:Hex': spellEffect('XPHB:Hex', 'Hex', [
    {
      name: 'Hex',
      duration: CONCENTRATION,
      concentration: true,
      to: 'self',
      markTarget: true,
      modifiers: [{ target: 'damage', mode: 'add', value: '1d6necrotic' }],
    },
    { name: 'Hex', duration: CONCENTRATION, concentration: true, to: 'targets', modifiers: [] },
  ]),
  "XPHB:Hunter's Mark": spellEffect("XPHB:Hunter's Mark", "Hunter's Mark", [
    {
      name: "Hunter's Mark",
      duration: CONCENTRATION,
      concentration: true,
      to: 'self',
      markTarget: true,
      modifiers: [{ target: 'damage', mode: 'add', value: '1d6force' }],
    },
    { name: "Hunter's Mark", duration: CONCENTRATION, concentration: true, to: 'targets', modifiers: [] },
  ]),
  'XPHB:Hold Person': spellEffect('XPHB:Hold Person', 'Hold Person', [
    {
      name: 'Hold Person',
      duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
      concentration: true,
      to: 'targets',
      conditions: ['paralyzed'],
      modifiers: [],
    },
  ], { ability: 'wis' }),
  /** Hideous Laughter (XPHB 2024): спас WIS в конце хода и от урона (с преимуществом). */
  "XPHB:Tasha's Hideous Laughter": spellEffect("XPHB:Tasha's Hideous Laughter", 'Hideous Laughter', [
    {
      name: 'Hideous Laughter',
      duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
      concentration: true,
      to: 'targets',
      conditions: ['incapacitated', 'prone'],
      modifiers: [],
      saveOnDamage: { advantage: true },
    },
  ], { ability: 'wis' }),
  'XPHB:Entangle': spellEffect('XPHB:Entangle', 'Entangle', [
    {
      name: 'Entangle',
      duration: { type: 'untilSave', ability: 'str', dc: 0, timing: 'end' },
      concentration: true,
      to: 'targets',
      conditions: ['restrained'],
      modifiers: [],
    },
  ], { ability: 'str' }),
  'XPHB:Fear': spellEffect('XPHB:Fear', 'Fear', [
    {
      name: 'Fear',
      duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
      concentration: true,
      to: 'targets',
      conditions: ['frightened'],
      modifiers: [],
    },
  ], { ability: 'wis' }),
  'XPHB:Faerie Fire': spellEffect('XPHB:Faerie Fire', 'Faerie Fire', [
    {
      name: 'Faerie Fire',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [{ target: 'attack', mode: 'advantage' }],
    },
  ]),
  /**
   * Conjure Woodland Beings (XPHB 2024): аура духов вокруг вас бьёт только врагов
   * (спас WIS, урон от круга) + Отход бонусным действием, пока держится концентрация.
   */
  'XPHB:Conjure Woodland Beings': {
    key: 'XPHB:Conjure Woodland Beings',
    name: 'Conjure Woodland Beings',
    resolution: 'save',
    concentration: true,
    save: { ability: 'wis', half: true },
    side: 'hostile',
    damage: { dice: '$spell', types: ['force'] },
    effects: [
      {
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
        enter: { save: { ability: 'wis', half: true }, damage: { dice: '$spell', types: ['force'] } },
        endOfTurn: { save: { ability: 'wis', half: true }, damage: { dice: '$spell', types: ['force'] } },
      },
    },
  },
  'XPHB:Aid': spellEffect('XPHB:Aid', 'Aid', [
    {
      name: 'Aid',
      duration: PERMANENT,
      to: 'targets',
      targets: 3,
      modifiers: [{ target: 'maxHp', mode: 'add', value: 5 }],
    },
  ]),
  // Контроль (спас → состояние); «до конца следующего хода» трактуется движком
  // как до начала следующего хода источника.
  'XPHB:Color Spray': spellEffect('XPHB:Color Spray', 'Color Spray', [
    {
      name: 'Color Spray',
      duration: UNTIL_NEXT_TURN,
      to: 'targets',
      conditions: ['blinded'],
      modifiers: [],
    },
  ], { ability: 'con' }),
  // Charm Person/Charm Monster/Animal Friendship/Suggestion — manual: «очарован»
  // в движке не имеет авто-эффектов, поведение (не атаковать очаровавшего,
  // выполнять внушение) не автоматизировано. Вернуться, когда будет механика
  // charmed/отношений.
  'XPHB:Hold Monster': spellEffect('XPHB:Hold Monster', 'Hold Monster', [
    {
      name: 'Hold Monster',
      duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
      concentration: true,
      to: 'targets',
      conditions: ['paralyzed'],
      modifiers: [],
    },
  ], { ability: 'wis' }),
  'XPHB:Hypnotic Pattern': spellEffect('XPHB:Hypnotic Pattern', 'Hypnotic Pattern', [
    {
      name: 'Hypnotic Pattern',
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      conditions: ['charmed', 'incapacitated'],
      modifiers: [{ target: 'speed', mode: 'multiply', value: 0 }],
      wakeOnDamage: true,
    },
  ], { ability: 'wis' }),
  'XPHB:Sleep': spellEffect('XPHB:Sleep', 'Sleep', [
    {
      name: 'Sleep',
      duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' },
      concentration: true,
      to: 'targets',
      conditions: ['incapacitated'],
      modifiers: [],
      escalate: { condition: 'unconscious', duration: CONCENTRATION },
      wakeOnDamage: true,
    },
  ], { ability: 'wis' }),
  // Hunger of Hadar: сфера 20; слепота и урон — при любом пересечении клеток
  // (любая занятая клетка в зоне). Магическая тьма — `flags.blocksLight`.
  'XPHB:Hunger of Hadar': {
    key: 'XPHB:Hunger of Hadar',
    name: 'Hunger of Hadar',
    resolution: 'auto',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      aura: {
        effects: [
          {
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
  // Зоны (R8.1): Web, Grease, Stinking Cloud. Мгновенный payload — при касте,
  // дальше — триггеры зоны (вход, начало/конец хода).
  'XPHB:Web': {
    key: 'XPHB:Web',
    name: 'Web',
    resolution: 'effect',
    concentration: true,
    save: { ability: 'dex' },
    effects: [WEB_RESTRAINED],
    zone: {
      area: { shape: 'cube', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      triggers: {
        enter: { save: { ability: 'dex' }, effects: [WEB_RESTRAINED] },
        startOfTurn: { save: { ability: 'dex' }, effects: [WEB_RESTRAINED] },
      },
      flags: { difficultTerrain: true },
    },
  },
  'XPHB:Grease': {
    key: 'XPHB:Grease',
    name: 'Grease',
    resolution: 'effect',
    save: { ability: 'dex' },
    effects: [GREASE_PRONE],
    zone: {
      area: { shape: 'cube', size: 10 },
      origin: 'point',
      duration: { type: 'rounds', rounds: 10 },
      triggers: {
        enter: { save: { ability: 'dex' }, effects: [GREASE_PRONE] },
        endOfTurn: { save: { ability: 'dex' }, effects: [GREASE_PRONE] },
      },
      flags: { difficultTerrain: true },
    },
  },
  'XPHB:Stinking Cloud': {
    key: 'XPHB:Stinking Cloud',
    name: 'Stinking Cloud',
    resolution: 'auto',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      triggers: {
        startOfTurn: { save: { ability: 'con' }, effects: [STINKING_POISONED] },
      },
      flags: { obscured: 'heavy' },
    },
  },
  // Darkness: магическая тьма (сфера 15); Fog Cloud: сильное заслонение (сфера 20).
  // Вижн-эффект — через флаги зоны (`blocksLight` / `obscured: heavy`).
  'XPHB:Darkness': {
    key: 'XPHB:Darkness',
    name: 'Darkness',
    resolution: 'auto',
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
    resolution: 'auto',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      flags: { obscured: 'heavy' },
    },
  },
  // Darkvision: выдаёт тёмное зрение 150 фт на 8 часов (сенсы эффекта).
  'XPHB:Darkvision': spellEffect('XPHB:Darkvision', 'Darkvision', [
    {
      name: 'Darkvision',
      duration: { type: 'rounds', rounds: 4800 },
      to: 'targets',
      modifiers: [],
      senses: [{ type: 'darkvision', range: 150 }],
    },
  ]),
  // Cloudkill: сфера 20, сильное заслонение; спас CON и 5d8 яда на входе/в начале хода.
  'XPHB:Cloudkill': {
    key: 'XPHB:Cloudkill',
    name: 'Cloudkill',
    resolution: 'auto',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      movable: true,
      flags: { obscured: 'heavy' },
      triggers: {
        enter: { save: { ability: 'con', half: true }, damage: { dice: '5d8', types: ['poison'] } },
        startOfTurn: { save: { ability: 'con', half: true }, damage: { dice: '5d8', types: ['poison'] } },
      },
    },
  },
  // Sleet Storm: цилиндр 20, сложная местность и сильное заслонение; спас DEX — ничком.
  'XPHB:Sleet Storm': {
    key: 'XPHB:Sleet Storm',
    name: 'Sleet Storm',
    resolution: 'auto',
    concentration: true,
    zone: {
      area: { shape: 'cylinder', size: 20 },
      origin: 'point',
      duration: CONCENTRATION,
      flags: { difficultTerrain: true, obscured: 'heavy' },
      triggers: {
        enter: { save: { ability: 'dex' }, effects: [SLEET_PRONE] },
        startOfTurn: { save: { ability: 'dex' }, effects: [SLEET_PRONE] },
      },
    },
  },
  // Slow: помеха-эффект с ограничениями экономики (реакции, действие/бонус, атаки, соматика).
  // Mirror Image: три образа; попадание принимает образ (d6 ≥ 3), заряды кончаются.
  'XPHB:Mirror Image': spellEffect('XPHB:Mirror Image', 'Mirror Image', [
    {
      name: 'Mirror Image',
      duration: { type: 'rounds', rounds: 10 },
      to: 'self',
      modifiers: [],
      misdirect: { charges: 3, die: 'd6', threshold: 3 },
    },
  ]),
  'XPHB:Slow': spellEffect('XPHB:Slow', 'Slow', [
    {
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
  ], { ability: 'wis' }),
  // Animate Objects: до 10 предметов со своими статблоками — механика отдельным
  // срезом. Без записи деривация из данных давала ложный авто-урон 1d4 по цели.
  'XPHB:Animate Objects': {
    key: 'XPHB:Animate Objects',
    name: 'Animate Objects',
    resolution: 'manual',
    concentration: true,
  },
};

/**
 * Дополнения к деривации данных: эффекты/зона/тип урона поверх «атака/спасбросок/
 * автоурон» (Shocking Grasp, Spirit Guardians). Для manual-спеллов не применяются.
 * В зоне кости `'$spell'` подставляются выражением урона заклинания (апкаст/кантрип).
 */
export interface AutomationAddition {
  effects?: AutomationEffect[];
  zone?: ZoneDef;
  /** Уточнить типы урона у деривации (у SG в данных acid/necrotic+radiant и т.п.). */
  damageTypes?: string[];
  /** Массовая цель без области (Mass Healing Word/Prayer of Healing/Mass Cure Wounds). */
  targets?: number;
}

export const AUTOMATION_ADDITIONS: Record<string, AutomationAddition> = {
  'XPHB:Shocking Grasp': {
    effects: [
      {
        name: 'Shocking Grasp',
        duration: { type: 'endOfTurn', of: 'target' },
        to: 'targets',
        modifiers: [],
        restrictions: { noOpportunityAttacks: true },
      },
    ],
  },
  'XPHB:Spirit Guardians': {
    damageTypes: ['radiant'],
    zone: {
      area: { shape: 'sphere', size: 15 },
      origin: 'point',
      anchor: 'source',
      duration: CONCENTRATION,
      enterOncePerTurn: true,
      excludeSource: true,
      aura: {
        effects: [
          {
            name: 'Spirit Guardians',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'speed', mode: 'multiply', value: 0.5 }],
          },
        ],
      },
      triggers: {
        enter: { save: { ability: 'wis', half: true }, damage: { dice: '$spell', types: ['radiant'] } },
        startOfTurn: { save: { ability: 'wis', half: true }, damage: { dice: '$spell', types: ['radiant'] } },
      },
    },
  },
  'XPHB:Mass Healing Word': { targets: 6 },
  'XPHB:Prayer of Healing': { targets: 5 },
  'XPHB:Mass Cure Wounds': { targets: 6 },
};

/** Подстановка выражения урона заклинания в кости триггеров зоны (`'$spell'`). */
function resolveZoneDice(zone: ZoneDef, expression: string): ZoneDef {
  const triggers = zone.triggers;
  if (!triggers) return zone;
  const sub = (payload: AutomationPayload | undefined): AutomationPayload | undefined =>
    payload?.damage?.dice === '$spell' ? { ...payload, damage: { ...payload.damage, dice: expression } } : payload;
  return {
    ...zone,
    triggers: {
      ...triggers,
      enter: sub(triggers.enter),
      exit: sub(triggers.exit),
      startOfTurn: sub(triggers.startOfTurn),
      endOfTurn: sub(triggers.endOfTurn),
    },
  };
}

/** Подстановка выражения урона в `$spell`-поля статичной строки каталога (Conjure Woodland Beings). */
function withSpellDice(def: AutomationDef, spell: Spell, opts: AutomationOptions): AutomationDef {
  if (!def.zone) return def;
  const castLevel = opts.castLevel ?? Math.max(1, spell.level);
  const expression = spellDamageExpression(spell, castLevel, opts.characterLevel ?? 1);
  if (!expression) return def;
  const damage = def.damage?.dice === '$spell' ? { ...def.damage, dice: expression } : def.damage;
  return { ...def, ...(damage ? { damage } : {}), zone: resolveZoneDice(def.zone, expression) };
}

export interface AutomationOptions {
  /** Круг ячейки (по умолчанию — базовый круг заклинания). */
  castLevel?: number;
  /** Уровень персонажа для скейла кантрипов. */
  characterLevel?: number;
  /** Выбранные инвокации варлока (модификаторы Eldritch Blast). */
  invocations?: string[];
  /** Выбор варианта при касте (Dragon's Breath: тип урона выдоха). */
  variant?: string;
}

/** Варианты заклинания, выбираемые при касте (Dragon's Breath: тип урона). */
export const SPELL_VARIANTS: Record<string, { param: 'damageType'; options: string[] }> = {
  "XPHB:Dragon's Breath": { param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'poison'] },
};

/** Варианты каста заклинания (undefined — выбора нет). */
export function spellVariantDef(spellKey: string): { param: 'damageType'; options: string[] } | undefined {
  return SPELL_VARIANTS[spellKey];
}

/** Заклинания с собранной в коде автоматизацией (билдеры, не строки каталога). */
const BUILTIN_AUTOMATION = new Set([
  "XPHB:Dragon's Breath",
  'XPHB:Vampiric Touch',
  'XPHB:Flame Blade',
  'XPHB:Sunbeam',
  'XPHB:Heat Metal',
]);

/** Реализована ли механика заклинания билдером кода (для маркера «не автоматизировано»). */
export function spellBuiltinAutomated(spellKey: string): boolean {
  return BUILTIN_AUTOMATION.has(spellKey);
}

/** Кость заклинания с учётом круга/уровня; `fallback` — если данных нет. */
function spellDice(spell: Spell, opts: AutomationOptions, fallback = ''): string {
  return spellDamageExpression(spell, opts.castLevel ?? Math.max(1, spell.level), opts.characterLevel ?? 1) ?? fallback;
}

/** Эффект-носитель выданного действия: бафф на себя (или цель у DB) с `actions`. */
function actionCarrier(
  spell: Spell,
  action: GrantedAction,
  opts: { to?: 'self' | 'targets'; variant?: string } = {}
): AutomationEffect {
  return {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: opts.to ?? 'self',
    modifiers: [],
    ...(opts.variant ? { variant: opts.variant } : {}),
    actions: [action],
  };
}

/**
 * Dragon's Breath: бафф-эффект выдаёт действие-выдох (конус 15 фт, спас DEX,
 * тип урона и скейл от круга фиксируются при касте).
 */
function breathSpellDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  const variant = SPELL_VARIANTS[spell.key];
  if (!variant) return undefined;
  const type = variant.options.includes(opts.variant ?? '') ? opts.variant! : variant.options[0]!;
  const dice = spellDice(spell, opts);
  const area = spell.areaSpec ?? { shape: 'cone' as const, size: 15 };
  const breath: AutomationDef = {
    key: spell.key,
    name: 'Выдох',
    resolution: 'save',
    save: { ability: 'dex', half: true },
    ...(dice ? { damage: { dice, types: [type] } } : {}),
    area,
    targeting: { kind: 'area', area, range: Math.max(5, area.size) },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    effects: [
      actionCarrier(spell, { id: 'breath', name: 'Выдох', cost: 'action', def: breath }, { to: 'targets', variant: type }),
    ],
  };
}

/** Vampiric Touch (XPHB 2024): атака при касте, повтор магическим действием, лечение на половину урона. */
function vampiricTouchDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Vampiric Touch') return undefined;
  const dice = spellDice(spell, opts);
  const strike = (name: string, targeting?: AutomationDef['targeting']): AutomationDef => ({
    key: spell.key,
    name,
    resolution: 'attack',
    attack: { rangeType: 'melee' },
    ...(dice ? { damage: { dice, types: ['necrotic'] } } : {}),
    lifesteal: true,
    ...(targeting ? { targeting } : {}),
  });
  return {
    ...strike(spell.name),
    concentration: true,
    effects: [actionCarrier(spell, { id: 'touch', name: 'Касание', cost: 'action', def: strike('Касание', { kind: 'creature', range: 5 }) })],
  };
}

/** Flame Blade (XPHB 2024): бонусным действием — клинок; магическим — атака огнём (+мод. характеристики). */
function flameBladeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Flame Blade') return undefined;
  const dice = spellDice(spell, opts, '3d6');
  const blade: AutomationDef = {
    key: spell.key,
    name: 'Огненный клинок',
    resolution: 'attack',
    attack: { rangeType: 'melee' },
    damage: { dice, types: ['fire'], abilityMod: true },
    targeting: { kind: 'creature', range: 5 },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    effects: [actionCarrier(spell, { id: 'blade', name: 'Клинок', cost: 'action', def: blade })],
  };
}

/** Sunbeam (XPHB 2024): луч 60×5 от себя; повтор магическим действием, слепота до начала вашего след. хода. */
function sunbeamDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Sunbeam') return undefined;
  const dice = spellDice(spell, opts, '6d8');
  const area = spell.areaSpec ?? { shape: 'line' as const, size: 60, width: 5 };
  const payload = {
    save: { ability: 'con' as const, half: true },
    damage: { dice, types: ['radiant'] },
    area,
  };
  const blind: AutomationEffect = {
    name: 'Sunbeam',
    duration: { type: 'endOfTurn', of: 'source' },
    to: 'targets',
    conditions: ['blinded'],
    modifiers: [],
  };
  const beam: AutomationDef = {
    key: spell.key,
    name: 'Луч',
    resolution: 'save',
    ...payload,
    targeting: { kind: 'area', area, range: Math.max(5, area.size) },
    effects: [blind],
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    ...payload,
    effects: [blind, actionCarrier(spell, { id: 'beam', name: 'Луч', cost: 'action', def: beam })],
  };
}

/** Heat Metal (XPHB 2024): авто-урон 2d8 огня + помеха на атаки/проверки; повтор бонусным действием. */
function heatMetalDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Heat Metal') return undefined;
  const damage = { dice: spellDice(spell, opts, '2d8'), types: ['fire'] };
  const holding: AutomationEffect = {
    name: 'Heat Metal',
    duration: { type: 'endOfTurn', of: 'source' },
    to: 'targets',
    modifiers: [
      { target: 'attack', mode: 'disadvantage' },
      { target: 'check', mode: 'disadvantage' },
    ],
  };
  const burn: AutomationDef = {
    key: spell.key,
    name: 'Раскалённый металл',
    resolution: 'auto',
    damage,
    targeting: { kind: 'creature', range: 60 },
    effects: [holding],
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'auto',
    concentration: true,
    damage,
    effects: [holding, actionCarrier(spell, { id: 'burn', name: 'Раскалённый металл', cost: 'bonus', def: burn })],
  };
}

/**
 * Определение автоматизации заклинания: строка каталога → деривация из данных
 * (атака/спасбросок/автоурон) → `manual`. Уровни уже применены к `dice`/`count`.
 */
export function automationForSpell(spell: Spell, opts: AutomationOptions = {}): AutomationDef {
  const catalog = AUTOMATION_SPELLS[spell.key];
  if (catalog) return withSpellDice(catalog, spell, opts);

  const breath = breathSpellDef(spell, opts);
  if (breath) return breath;

  const vampiric = vampiricTouchDef(spell, opts);
  if (vampiric) return vampiric;

  const flameBlade = flameBladeDef(spell, opts);
  if (flameBlade) return flameBlade;

  const sunbeam = sunbeamDef(spell, opts);
  if (sunbeam) return sunbeam;

  const heatMetal = heatMetalDef(spell, opts);
  if (heatMetal) return heatMetal;

  const summon = summonSpellDef(spell.key);
  if (summon) {
    const castLevel = Math.max(summon.baseLevel, opts.castLevel ?? Math.max(1, spell.level));
    return {
      key: spell.key,
      name: spell.name,
      resolution: 'summon',
      concentration: spell.concentration === true || undefined,
      summon: {
        ...(summon.template ? { creature: summon.template } : {}),
        ...(summon.fromFamiliar ? { choices: [] } : {}),
        count: summon.count ?? 1,
        duration: spell.concentration ? { type: 'concentration' } : summon.duration ?? { type: 'permanent' },
        initiative: summon.initiative,
        level: castLevel,
        spellAttack: true,
        spellDc: true,
      },
    };
  }

  const withAdditions = (def: AutomationDef, spellDamage: string): AutomationDef => {
    const addition = AUTOMATION_ADDITIONS[def.key];
    if (!addition) return def;
    const merged: AutomationDef = {
      ...def,
      effects: [...(def.effects ?? []), ...(addition.effects ?? [])],
    };
    if (addition.zone) merged.zone = resolveZoneDice(addition.zone, spellDamage);
    if (addition.damageTypes && merged.damage) merged.damage = { ...merged.damage, types: addition.damageTypes };
    if (addition.targets) merged.targets = addition.targets;
    return merged;
  };

  const castLevel = opts.castLevel ?? Math.max(1, spell.level);
  const characterLevel = opts.characterLevel ?? 1;
  const expression = spellDamageExpression(spell, castLevel, characterLevel);
  const concentration = spell.concentration === true || undefined;
  const base: AutomationDef = {
    key: spell.key,
    name: spell.name,
    resolution: 'manual',
    concentration,
  };
  if (!expression) return base;

  const dice = { dice: expression, types: spell.damage?.types ?? [] };
  const rolled = isHealingSpell(spell) ? { heal: dice } : { damage: dice };
  const count = spellAttackCount(spell, castLevel, characterLevel);
  if (spell.spellAttack) {
    return withBlastMods(
      spell,
      withAdditions(
        {
          ...base,
          resolution: 'attack',
          attack: { rangeType: spell.spellAttack },
          count,
          ...rolled,
        },
        expression
      ),
      opts.invocations
    );
  }
  if (spell.save?.length && spell.save[0]) {
    return withAdditions(
      {
        ...base,
        resolution: 'save',
        save: { ability: spell.save[0], half: spell.saveHalf === true },
        ...rolled,
      },
      expression
    );
  }
  return withAdditions({ ...base, resolution: 'auto', count, ...rolled }, expression);
}

  /** Модификаторы Eldritch Blast от инвокаций: Agonizing (+мод. характеристики) и Repelling (толчок). */
function withBlastMods(spell: Spell, def: AutomationDef, invocations?: string[]): AutomationDef {
  if (spell.key !== 'XPHB:Eldritch Blast' || !invocations?.length) return def;
  const mods = eldritchBlastMods({ invocations });
  let out = def;
  if (mods.agonizing && out.damage) out = { ...out, damage: { ...out.damage, abilityMod: true } };
  if (mods.repelling) out = { ...out, force: { kind: 'push', feet: 10, maxSize: 'large' } };
  return out;
}

export interface ActionAutomationOptions {
  /** Классы персонажа — для скейла по уровню (`classLevelBonus`). */
  classes?: ClassLevel[];
}

/**
 * Определение автоматизации действия (базовое/классовая черта): строка каталога
 * со скейлом по уровню класса. undefined — механики нет (заглушка на сервере).
 */
export function automationForAction(action: ActionDef, opts: ActionAutomationOptions = {}): AutomationDef | undefined {
  if (action.ability) return monsterAbilityAutomation(action);
  const base = AUTOMATION_ACTIONS[action.id];
  if (!base) return undefined;
  const classes = opts.classes;
  if (!classes?.length) return base;
  const scale = (dice?: AutomationDice): AutomationDice | undefined => {
    const bonus = dice?.classLevelBonus;
    if (!dice || !bonus) return dice;
    const level = classes.find((c) => c.className === bonus.className)?.level ?? 1;
    const { classLevelBonus: _drop, ...rest } = dice;
    return { ...rest, dice: `${dice.dice}+${Math.max(1, Math.round(level)) * (bonus.per ?? 1)}` };
  };
  return { ...base, damage: scale(base.damage), heal: scale(base.heal) };
}

/** Определения эффектов заклинания из каталога (undefined — эффектов нет). */
export function spellEffectDefs(spellKey: string): AutomationEffect[] | undefined {
  return AUTOMATION_SPELLS[spellKey]?.effects;
}

/**
 * Реализована ли механика заклинания: каталог (не `manual`) либо деривация из
 * данных (`automation: 'full'`). Остальным рисуем красный маркер на иконке.
 */
export function spellAutomated(spell: Pick<Spell, 'key' | 'automation'>): boolean {
  const def = AUTOMATION_SPELLS[spell.key];
  if (def) return def.resolution !== 'manual';
  if (spellBuiltinAutomated(spell.key)) return true;
  if (summonSpellDef(spell.key)) return true;
  return spell.automation === 'full';
}
