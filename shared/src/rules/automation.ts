import type { ActionDef } from '../domain/actions';
import type { AbilityKey } from '../domain/core';
import type {
  AutomationDice,
  AutomationDef,
  AutomationEffect,
  AutomationPayload,
  AutomationSave,
  GrantedAction,
  LightSource,
  ZoneDef,
} from '../domain/automation';
import type { ConditionKey, EffectDuration, Modifier } from '../domain/effects';
import type { ClassLevel } from '../domain/sheet';
import { DAMAGE_TYPES, SKILLS } from '../labels';
import { AUTOMATION_ACTIONS } from './automationActions';
import { eldritchBlastMods } from './invocations';
import { monsterAbilityAutomation } from './monsterAbility';
import { summonSpellDef } from './summons';
import { isHealingSpell, spellAttackCount, spellDamageExpression } from './spellCast';
import type { Spell } from './spells';

export { AUTOMATION_ACTIONS };

/** Выданное действие «Перенести метку» (Hex/Hunter's Mark): только после смерти текущей цели. */
function remarkAction(spellKey: string, name: string): GrantedAction {
  return {
    id: 'remark',
    name: 'Перенести метку',
    cost: 'bonus',
    def: {
      key: spellKey,
      name,
      resolution: 'manual',
      retarget: true,
      targeting: { kind: 'creature', range: 90 },
    },
  };
}

/** Выданное зоной действие перемещения (Moonbeam 60, Flaming Sphere 30, Faithful Hound 30). */
function zoneMoveAction(name: string, cost: 'action' | 'bonus', feet: number): GrantedAction {
  return {
    id: 'move',
    name,
    cost,
    def: {
      key: 'zone:move',
      name,
      resolution: 'utility',
      utility: { kind: 'moveZone', amount: feet },
      targeting: { kind: 'point', range: feet },
    },
  };
}

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

/** Типы существ, против которых работают Protection from Evil and Good и подобные. */
const EVIL_GOOD_TYPES = ['aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead'];

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
  /** Misty Step: бонусным действием телепорт до 30 футов в свободную видимую клетку. */
  'XPHB:Misty Step': {
    key: 'XPHB:Misty Step',
    name: 'Misty Step',
    resolution: 'utility',
    utility: { kind: 'teleport', amount: 30 },
    targeting: { kind: 'point', range: 30 },
  },
  /** Scatter (XGE): до пяти существ — в свободные видимые точки в 120 фт от кастера; нежелающие сейв WIS. */
  'XGE:Scatter': {
    key: 'XGE:Scatter',
    name: 'Scatter',
    resolution: 'utility',
    utility: { kind: 'scatter', targets: 5, destinationFeet: 120 },
    targeting: { kind: 'point', range: 30 },
  },
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
        { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'magicalSlashing' } },
        { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'magicalPiercing' } },
        { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'magicalBludgeoning' } },
      ],
    },
  ]),
  /** Revivify: возвращает мёртвую цель к жизни с 1 HP (касание, без проверки «≤1 мин» — DM). */
  'XPHB:Revivify': {
    key: 'XPHB:Revivify',
    name: 'Revivify',
    resolution: 'utility',
    utility: { kind: 'revive' },
    targeting: { kind: 'creature', range: 5 },
  },
  /** Spare the Dying: цель на 0 HP (не мёртвая) становится стабильной. */
  'XPHB:Spare the Dying': {
    key: 'XPHB:Spare the Dying',
    name: 'Spare the Dying',
    resolution: 'utility',
    utility: { kind: 'stabilize' },
    targeting: { kind: 'creature', range: 15 },
  },
  /** Lesser Restoration: снять одно состояние (Blinded/Deafened/Paralyzed/Poisoned), касание. */
  'XPHB:Lesser Restoration': {
    key: 'XPHB:Lesser Restoration',
    name: 'Lesser Restoration',
    resolution: 'utility',
    utility: { kind: 'endCondition' },
    endConditions: ['blinded', 'deafened', 'paralyzed', 'poisoned'],
    targeting: { kind: 'creature', range: 5 },
  },
  /** Death Ward: первое падение до 0 HP от урона — 1 HP вместо этого, эффект гаснет (8 часов). */
  'XPHB:Death Ward': spellEffect('XPHB:Death Ward', 'Death Ward', [
    {
      name: 'Death Ward',
      duration: { type: 'rounds', rounds: 4800 },
      to: 'targets',
      modifiers: [],
      deathWard: true,
    },
  ]),
  /** Freedom of Movement: иммунитет к параличу/опутыванию, скорость и местность (1 час). */
  'XPHB:Freedom of Movement': spellEffect('XPHB:Freedom of Movement', 'Freedom of Movement', [
    {
      name: 'Freedom of Movement',
      duration: { type: 'rounds', rounds: 600 },
      to: 'targets',
      modifiers: [],
      conditionImmunities: ['paralyzed', 'restrained'],
      immuneToSpeedReduction: true,
      ignoresDifficultTerrain: true,
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
      actions: [remarkAction('XPHB:Hex', 'Hex')],
    },
    { name: 'Hex', duration: CONCENTRATION, concentration: true, to: 'targets', modifiers: [], mark: true },
  ]),
  "XPHB:Hunter's Mark": spellEffect("XPHB:Hunter's Mark", "Hunter's Mark", [
    {
      name: "Hunter's Mark",
      duration: CONCENTRATION,
      concentration: true,
      to: 'self',
      markTarget: true,
      modifiers: [{ target: 'damage', mode: 'add', value: '1d6force' }],
      actions: [remarkAction("XPHB:Hunter's Mark", "Hunter's Mark")],
    },
    { name: "Hunter's Mark", duration: CONCENTRATION, concentration: true, to: 'targets', modifiers: [], mark: true },
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
      light: { bright: 0, dim: 10 },
    },
  ]),
  /** Светящиеся заклинания без боевой механики: источник света для обзора и вида. */
  'XPHB:Light': spellEffect('XPHB:Light', 'Light', [
    { name: 'Light', duration: PERMANENT, to: 'targets', modifiers: [], light: { bright: 20, dim: 20 } },
  ]),
  'XPHB:Continual Flame': spellEffect('XPHB:Continual Flame', 'Continual Flame', [
    { name: 'Continual Flame', duration: PERMANENT, to: 'targets', modifiers: [], light: { bright: 20, dim: 20 } },
  ]),
  'XPHB:Daylight': {
    key: 'XPHB:Daylight',
    name: 'Daylight',
    resolution: 'effect',
    zone: {
      area: { shape: 'sphere', size: 60 },
      origin: 'point',
      duration: PERMANENT,
      light: { bright: 60, dim: 60, sunlight: true },
    },
  },
  /** Moonbeam (XPHB 2024): появление/вход/конец хода — спас CON; сумерки; действие — двигать до 60 фт. */
  'XPHB:Moonbeam': {
    key: 'XPHB:Moonbeam',
    name: 'Moonbeam',
    resolution: 'save',
    concentration: true,
    save: { ability: 'con', half: true },
    damage: { dice: '$spell', types: ['radiant'] },
    zone: {
      area: { shape: 'sphere', size: 5 },
      origin: 'point',
      duration: CONCENTRATION,
      light: { bright: 0, dim: 5 },
      triggers: {
        enter: { save: { ability: 'con', half: true }, damage: { dice: '$spell', types: ['radiant'] } },
        endOfTurn: { save: { ability: 'con', half: true }, damage: { dice: '$spell', types: ['radiant'] } },
      },
      actions: [zoneMoveAction('Переместить', 'action', 60)],
    },
  },
  /** Flaming Sphere (XPHB 2024): сфера 5 фт; вход/конец хода — спас DEX; свет 20/20; бонус — катить 30 фт. */
  'XPHB:Flaming Sphere': {
    key: 'XPHB:Flaming Sphere',
    name: 'Flaming Sphere',
    resolution: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 5 },
      origin: 'point',
      duration: CONCENTRATION,
      light: { bright: 20, dim: 20 },
      triggers: {
        enter: { save: { ability: 'dex', half: true }, damage: { dice: '$spell', types: ['fire'] } },
        endOfTurn: { save: { ability: 'dex', half: true }, damage: { dice: '$spell', types: ['fire'] } },
      },
      actions: [zoneMoveAction('Переместить', 'bonus', 30)],
    },
  },
  /** Faithful Hound (XPHB 2024): невидимый пёс; враждебные в области в конце хода — спас DEX, 4d8 force. */
  "XPHB:Mordenkainen's Faithful Hound": {
    key: "XPHB:Mordenkainen's Faithful Hound",
    name: 'Faithful Hound',
    resolution: 'effect',
    side: 'hostile',
    zone: {
      area: { shape: 'sphere', size: 5 },
      origin: 'point',
      duration: PERMANENT,
      side: 'hostile',
      triggers: {
        endOfTurn: { save: { ability: 'dex' }, damage: { dice: '4d8', types: ['force'] } },
      },
      actions: [zoneMoveAction('Переместить', 'action', 30)],
    },
  },
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
  /**
   * Banishment (XPHB 2024): спас CHA; провал — изгнание на 10 раундов (1 мин,
   * концентрация). Возврат при снятии эффекта; экстрапланетные по истечении
   * полного срока не возвращаются (удаляются) — решает исполнение тика.
   */
  'XPHB:Banishment': spellEffect('XPHB:Banishment', 'Banishment', [
    {
      name: 'Banishment',
      duration: { type: 'rounds', rounds: 10 },
      concentration: true,
      to: 'targets',
      conditions: ['incapacitated'],
      modifiers: [],
      banish: true,
    },
  ], { ability: 'cha' }),
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
  /** Irresistible Dance (XPHB): танец на месте; провал — Charmed и повторный спас действием «Собраться». */
  "XPHB:Otto's Irresistible Dance": {
    key: "XPHB:Otto's Irresistible Dance",
    name: 'Irresistible Dance',
    resolution: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    targeting: { kind: 'creature', range: 30 },
    saveSuccess: [
      {
        name: 'Irresistible Dance',
        duration: { type: 'endOfTurn', of: 'target' },
        to: 'targets',
        modifiers: [{ target: 'speed', mode: 'multiply', value: 0 }],
      },
    ],
    effects: [
      {
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
  'XPHB:Pass without Trace': {
    key: 'XPHB:Pass without Trace',
    name: 'Pass without Trace',
    resolution: 'effect',
    concentration: true,
    zone: {
      area: { shape: 'sphere', size: 30 },
      origin: 'self',
      anchor: 'source',
      duration: CONCENTRATION,
      aura: {
        effects: [
          {
            name: 'Pass without Trace',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'check', mode: 'add', value: 10, filter: { skill: 'stealth' } }],
          },
        ],
      },
    },
  },
  'XPHB:Protection from Poison': {
    key: 'XPHB:Protection from Poison',
    name: 'Protection from Poison',
    resolution: 'effect',
    endConditions: ['poisoned'],
    effects: [
      {
        name: 'Protection from Poison',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [
          { target: 'save', mode: 'advantage', filter: { conditions: ['poisoned'] } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'poison' } },
        ],
      },
    ],
  },
  /** Aura of Life (XPHB): эманация 30 фт — сопротивление некротике; союзник на 0 HP в начале хода — 1 HP. */
  'XPHB:Aura of Life': {
    key: 'XPHB:Aura of Life',
    name: 'Aura of Life',
    resolution: 'effect',
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
  /** Aura of Purity (XPHB): эманация 30 фт — сопротивление/иммунитет к яду, преимущество сейвов против состояний. */
  'XPHB:Aura of Purity': {
    key: 'XPHB:Aura of Purity',
    name: 'Aura of Purity',
    resolution: 'effect',
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
  /** Sanctuary (XPHB): атакующие цель обязаны пройти спас WIS или потерять атаку/заклинание. */
  'XPHB:Sanctuary': {
    key: 'XPHB:Sanctuary',
    name: 'Sanctuary',
    resolution: 'effect',
    targeting: { kind: 'creature', range: 30 },
    effects: [
      {
        name: 'Sanctuary',
        duration: PERMANENT,
        to: 'targets',
        modifiers: [],
        sanctuary: true,
        breakOn: ['attack', 'spell', 'damage'],
      },
    ],
  },
  /** Protection from Evil and Good (XPHB): помеха атакам шести типов, иммунитет к charmed/frightened от них. */
  'XPHB:Protection from Evil and Good': {
    key: 'XPHB:Protection from Evil and Good',
    name: 'Protection from Evil and Good',
    resolution: 'effect',
    concentration: true,
    targeting: { kind: 'creature', range: 5 },
    effects: [
      {
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
  /** Circle of Power (XPHB): аура 30 фт — преимущество сейвов против магии, успех = без урона. */
  'XPHB:Circle of Power': {
    key: 'XPHB:Circle of Power',
    name: 'Circle of Power',
    resolution: 'effect',
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
            name: 'Circle of Power',
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'save', mode: 'advantage', filter: { magical: true } }],
            saveNoDamage: true,
          },
        ],
      },
    },
  },
  /** Beacon of Hope (XPHB): все союзники в 30 фт — преимущество WIS- и death-сейвов, максимум лечения. */
  'XPHB:Beacon of Hope': {
    key: 'XPHB:Beacon of Hope',
    name: 'Beacon of Hope',
    resolution: 'effect',
    concentration: true,
    autoTargets: { feet: 30, side: 'ally', includeSelf: true },
    effects: [
      {
        name: 'Beacon of Hope',
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [{ target: 'save', mode: 'advantage', filter: { ability: 'wis' } }],
        maximizeHealing: true,
        deathSaveAdvantage: true,
      },
    ],
  },
  'XPHB:Warding Bond': {
    key: 'XPHB:Warding Bond',
    name: 'Warding Bond',
    resolution: 'effect',
    effects: [
      {
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
        damageLink: true,
      },
    ],
  },
  // See Invisibility: носитель видит невидимых (клиентский рендер + снятие adv/dis невидимости).
  'XPHB:See Invisibility': {
    key: 'XPHB:See Invisibility',
    name: 'See Invisibility',
    resolution: 'effect',
    effects: [
      {
        name: 'See Invisibility',
        duration: PERMANENT,
        to: 'self',
        modifiers: [],
        seesInvisible: true,
      },
    ],
  },
  // Primordial Ward (XGE): сопротивления 5 типам; реакцией на урон типа — иммунитет к нему
  // (движок `ward` + `offerDamageReactions`, включая спровоцировавший урон).
  'XGE:Primordial Ward': {
    key: 'XGE:Primordial Ward',
    name: 'Primordial Ward',
    resolution: 'effect',
    concentration: true,
    effects: [
      {
        name: 'Primordial Ward',
        duration: PERMANENT,
        concentration: true,
        to: 'self',
        modifiers: ['acid', 'cold', 'fire', 'lightning', 'thunder'].map((type) => ({
          target: 'damage' as const,
          mode: 'resistance' as const,
          value: 0,
          filter: { damageType: type },
        })),
        ward: ['acid', 'cold', 'fire', 'lightning', 'thunder'],
      },
    ],
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
  /** Фильтр целей мгновенной части по стороне (Spirit Guardians: только враги). */
  side?: 'hostile' | 'ally';
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
    side: 'hostile',
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
  /** Модификатор заклинательной характеристики кастера (Heroism: временные HP за ход). */
  spellMod?: number;
  /** Круг ячейки (по умолчанию — базовый круг заклинания). */
  castLevel?: number;
  /** Уровень персонажа для скейла кантрипов. */
  characterLevel?: number;
  /** Выбранные инвокации варлока (модификаторы Eldritch Blast). */
  invocations?: string[];
  /** Выбор варианта при касте (Dragon's Breath: тип урона выдоха). */
  variant?: string;
}

/** Вариант заклинания, выбираемый при касте (Dragon's Breath: тип урона; Enhance Ability: характеристика; Eyebite: эффект). */
export interface SpellVariantDef {
  param: 'damageType' | 'ability' | 'effect' | 'skill' | 'command';
  options: string[];
}

export const SPELL_VARIANTS: Record<string, SpellVariantDef> = {
  "XPHB:Dragon's Breath": { param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'poison'] },
  'XPHB:Enhance Ability': { param: 'ability', options: ['str', 'dex', 'int', 'wis', 'cha'] },
  'XPHB:Eyebite': { param: 'effect', options: ['asleep', 'panicked', 'sickened'] },
  'XPHB:Protection from Energy': { param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'thunder'] },
  'XGE:Skill Empowerment': { param: 'skill', options: SKILLS.map((s) => s.key) },
  'XPHB:Command': { param: 'command', options: ['approach', 'drop', 'flee', 'grovel', 'halt'] },
};

/** Варианты каста заклинания (undefined — выбора нет). */
export function spellVariantDef(spellKey: string): SpellVariantDef | undefined {
  return SPELL_VARIANTS[spellKey];
}

/** Заклинания с собранной в коде автоматизацией (билдеры, не строки каталога). */
const BUILTIN_AUTOMATION = new Set([
  "XPHB:Dragon's Breath",
  'XPHB:Vampiric Touch',
  'XPHB:Flame Blade',
  'TCE:Green-Flame Blade',
  'XPHB:Sunbeam',
  'XPHB:Heat Metal',
  'XPHB:Call Lightning',
  'XPHB:Heal',
  'XPHB:Heroism',
  'XPHB:Enhance Ability',
  'XGE:Skill Empowerment',
  'XPHB:Command',
  'XGE:Far Step',
  'XPHB:Armor of Agathys',
  'XPHB:Magic Weapon',
  'XPHB:Eyebite',
  'XPHB:Invisibility',
  'XPHB:Greater Invisibility',
  'XPHB:Searing Smite',
  'XPHB:Ensnaring Strike',
  'XPHB:Divine Smite',
  'XPHB:Thunderous Smite',
  'XPHB:Wrathful Smite',
  'XPHB:Blinding Smite',
  'XPHB:Shining Smite',
  'XPHB:Staggering Smite',
  'XPHB:Banishing Smite',
  'XPHB:Protection from Energy',
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
  opts: { to?: 'self' | 'targets'; variant?: string; light?: LightSource } = {}
): AutomationEffect {
  return {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: opts.to ?? 'self',
    modifiers: [],
    ...(opts.variant ? { variant: opts.variant } : {}),
    ...(opts.light ? { light: opts.light } : {}),
    actions: [action],
  };
}

/**
 * Dragon's Breath: бафф-эффект выдаёт действие-выдох (конус 15 фт, спас DEX,
 * тип урона и скейл от круга фиксируются при касте).
 */
function breathSpellDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== "XPHB:Dragon's Breath") return undefined;
  const variant = SPELL_VARIANTS[spell.key];
  if (!variant || variant.param !== 'damageType') return undefined;
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
    effects: [actionCarrier(spell, { id: 'blade', name: 'Клинок', cost: 'action', def: blade }, { light: { bright: 10, dim: 10 } })],
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
    effects: [blind, actionCarrier(spell, { id: 'beam', name: 'Луч', cost: 'action', def: beam }, { light: { bright: 30, dim: 30, sunlight: true } })],
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

/** Call Lightning (XPHB 2024): туча-цилиндр 60 фт, удар 5 фт при касте (в центр) и повтор действием. */
function callLightningDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Call Lightning') return undefined;
  const dice = spellDice(spell, opts, '3d10');
  const impact: AutomationDef = {
    key: spell.key,
    name: 'Удар молнии',
    resolution: 'save',
    save: { ability: 'dex', half: true },
    damage: { dice, types: ['lightning'] },
    area: { shape: 'sphere', size: 5 },
    targeting: { kind: 'area', area: { shape: 'sphere', size: 5 }, range: 60 },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save: { ability: 'dex', half: true },
    damage: { dice, types: ['lightning'] },
    area: { shape: 'sphere', size: 5 },
    zone: {
      area: { shape: 'cylinder', size: 60 },
      origin: 'point',
      duration: CONCENTRATION,
      flags: { subtle: true },
      actions: [{ id: 'strike', name: 'Удар молнии', cost: 'action', def: impact }],
    },
  };
}

/** Heroism: иммунитет к испугу + временные HP (мод заклинательной характеристики) в начале хода цели. */
function heroismDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Heroism') return undefined;
  const mod = Math.max(0, Math.round(opts.spellMod ?? 0));
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    modifiers: [],
    conditionImmunities: ['frightened'],
    ...(mod > 0 ? { triggers: { startOfTurn: { tempHp: mod } } } : {}),
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/** Protection from Energy: выбранный при касте тип — сопротивление ему у цели (концентрация). */
function protectionFromEnergyDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Protection from Energy') return undefined;
  const variant = SPELL_VARIANTS[spell.key];
  if (!variant) return undefined;
  const type = variant.options.includes(opts.variant ?? '') ? opts.variant! : variant.options[0]!;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    modifiers: [{ target: 'damage', mode: 'resistance', value: 0, filter: { damageType: type } }],
    variant: type,
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/** Skill Empowerment: выбранный навык — экспертиза цели (ПБ носителя добавляется ещё раз). */
function skillEmpowermentDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XGE:Skill Empowerment') return undefined;
  const variant = SPELL_VARIANTS[spell.key];
  if (!variant || variant.param !== 'skill') return undefined;
  const skill = variant.options.includes(opts.variant ?? '') ? opts.variant! : variant.options[0]!;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    modifiers: [{ target: 'check', mode: 'add', value: '$proficiency', filter: { skill } }],
    variant: skill,
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/** Armor of Agathys (XPHB): 5 врем. HP и ответный холод атакующему (+5 за круг выше 1). */
function armorOfAgathysDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Armor of Agathys') return undefined;
  const castLevel = Math.max(1, opts.castLevel ?? Math.max(1, spell.level));
  const amount = 5 + 5 * (castLevel - 1);
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    to: 'self',
    modifiers: [],
    tempHp: amount,
    retaliate: { damageType: 'cold', amount },
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', effects: [effect] };
}

/** Command (XPHB): выбранный приказ действует до конца следующего хода цели; Approach/Drop/Flee — ручные. */
function commandDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Command') return undefined;
  const variants = SPELL_VARIANTS[spell.key];
  const variant = variants?.options.includes(opts.variant ?? '') ? opts.variant! : 'halt';
  const modifiers: Omit<Modifier, 'id'>[] = [];
  const conditions: ConditionKey[] = [];
  if (variant === 'halt' || variant === 'grovel') modifiers.push({ target: 'speed', mode: 'multiply', value: 0 });
  if (variant === 'grovel') conditions.push('prone');
  const effect: AutomationEffect = {
    name: spell.name,
    duration: { type: 'endOfTurn', of: 'target' },
    to: 'targets',
    targets: 1,
    modifiers,
    ...(conditions.length ? { conditions } : {}),
    // Обычное и бонусное действие теряется у всех вариантов приказа.
    restrictions: { noActions: true, noBonus: true },
    variant,
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    save: { ability: 'wis' },
    excludeCreatureTypes: ['undead'],
    effects: [effect],
  };
}

/** Far Step (XGE): телепорт 60 фт при касте; пока концентрация — тем же бонусным действием. */
function farStepDef(spell: Spell): AutomationDef | undefined {
  if (spell.key !== 'XGE:Far Step') return undefined;
  const jump: AutomationDef = {
    key: spell.key,
    name: 'Прыжок',
    resolution: 'utility',
    utility: { kind: 'teleport', amount: 60 },
    targeting: { kind: 'point', range: 60 },
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'utility',
    concentration: true,
    utility: { kind: 'teleport', amount: 60 },
    effects: [actionCarrier(spell, { id: 'farStep', name: 'Прыжок', cost: 'bonus', def: jump })],
  };
}

/** Enhance Ability: выбранная при касте характеристика — преимущество на её проверки. */
function enhanceAbilityDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  const variant = SPELL_VARIANTS[spell.key];
  if (!variant || variant.param !== 'ability') return undefined;
  const ability = (variant.options.includes(opts.variant ?? '') ? opts.variant! : variant.options[0]!) as AbilityKey;
  // Апкаст: +1 цель за круг выше 2 (характеристика одна на каст).
  const targets = Math.max(1, (opts.castLevel ?? Math.max(1, spell.level)) - 1);
  const effect: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'targets',
    targets,
    modifiers: [{ target: 'check', mode: 'advantage', filter: { ability } }],
    variant: ability,
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/**
 * Invisibility: цель невидима до конца концентрации; бросок атаки или каст
 * носителя досрочно обрывают эффект. Апкаст: +1 цель за круг выше 2-го.
 * Greater Invisibility — без обрыва и апкаста.
 */
function invisibilityDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Invisibility' && spell.key !== 'XPHB:Greater Invisibility') return undefined;
  const greater = spell.key === 'XPHB:Greater Invisibility';
  const targets = greater ? 1 : Math.max(1, (opts.castLevel ?? Math.max(1, spell.level)) - 1);
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    concentration: true,
    to: 'targets',
    targets,
    modifiers: [],
    conditions: ['invisible'],
    ...(greater ? {} : { breakOn: ['attack', 'spell'] as const }),
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', concentration: true, effects: [effect] };
}

/** Magic Weapon: оружейные атаки цели — магические, +1/+2/+3 к попаданию и урону (апкаст). */
function magicWeaponDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Magic Weapon') return undefined;
  const castLevel = opts.castLevel ?? Math.max(1, spell.level);
  const bonus = castLevel >= 6 ? 3 : castLevel >= 3 ? 2 : 1;
  const effect: AutomationEffect = {
    name: spell.name,
    duration: PERMANENT,
    to: 'targets',
    modifiers: [
      { target: 'attack', mode: 'add', value: bonus, filter: { weapon: true } },
      { target: 'damage', mode: 'add', value: bonus, filter: { weapon: true } },
    ],
    magicWeapon: true,
  };
  return { key: spell.key, name: spell.name, resolution: 'effect', effects: [effect] };
}

/** Eyebite: эффект варианта на цель (Сон/Паника/Тошнота). */
function eyebiteEffect(name: string, variant: string): AutomationEffect {
  const base = { name, duration: CONCENTRATION, concentration: true, to: 'targets' as const, modifiers: [] };
  if (variant === 'panicked') return { ...base, conditions: ['frightened'] };
  if (variant === 'sickened') return { ...base, conditions: ['poisoned'] };
  return { ...base, conditions: ['unconscious'], wakeOnDamage: true };
}

/**
 * Eyebite: первичная цель — выбранный эффект (WIS-спас), плюс на кастере
 * носитель с тремя действиями на каждый следующий ход. Спасшиеся помечаются
 * скрытой меткой (`markSaved`) — повторно их не выбрать до конца каста.
 */
function eyebiteDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Eyebite') return undefined;
  const variants = SPELL_VARIANTS[spell.key];
  const variant = variants?.options.includes(opts.variant ?? '') ? opts.variant! : variants?.options[0] ?? 'asleep';
  const action = (id: 'asleep' | 'panicked' | 'sickened', name: string): GrantedAction => ({
    id: `eyebite:${id}`,
    name,
    cost: 'action',
    def: {
      key: `XPHB:Eyebite:${id}`,
      name,
      resolution: 'save',
      save: { ability: 'wis' },
      targeting: { kind: 'creature', range: 60 },
      effects: [eyebiteEffect(name, id)],
    },
  });
  const carrier: AutomationEffect = {
    name: spell.name,
    duration: CONCENTRATION,
    concentration: true,
    to: 'self',
    modifiers: [],
    actions: [
      action('asleep', 'Eyebite: Сон'),
      action('panicked', 'Eyebite: Паника'),
      action('sickened', 'Eyebite: Тошнота'),
    ],
  };
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'effect',
    concentration: true,
    save: { ability: 'wis' },
    targeting: { kind: 'creature', range: 60 },
    effects: [carrier, { ...eyebiteEffect(spell.name, variant), markSaved: true }],
  };
}

/** Searing Smite: доп. 1d6 огня при попадании + урон и спас CON в начале каждого хода цели. */
function searingSmiteDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Searing Smite') return undefined;
  const castLevel = opts.castLevel ?? spell.level;
  const dice = spellDamageExpression(spell, castLevel, opts.characterLevel ?? 1) ?? '1d6';
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'auto',
    damage: { dice, types: ['fire'] },
    effects: [
      {
        name: spell.name,
        duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'start' },
        to: 'targets',
        modifiers: [],
        triggers: { startOfTurn: { damage: { dice, types: ['fire'] } } },
      },
    ],
  };
}

/** Ensnaring Strike: спас STR или опутан; урон 1d6 в начале хода; выпутывание действием. */
function ensnaringStrikeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Ensnaring Strike') return undefined;
  const castLevel = opts.castLevel ?? spell.level;
  const dice = spellDamageExpression(spell, castLevel, opts.characterLevel ?? 1) ?? '1d6';
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'save',
    concentration: true,
    save: { ability: 'str' },
    effects: [
      {
        name: spell.name,
        duration: CONCENTRATION,
        concentration: true,
        to: 'targets',
        modifiers: [],
        conditions: ['restrained'],
        escape: { ability: 'str', skill: 'athletics' },
        triggers: { startOfTurn: { damage: { dice, types: ['piercing'] } } },
      },
    ],
  };
}

/** Конфигурация XPHB-смайта (2024): кости урона при попадании, спас и эффект при провале. */
interface SmiteConfig {
  /** Базовая кость на минимальном круге. */
  base: string;
  /** Добавка за каждый круг ячейки выше `above`. */
  per?: string;
  above?: number;
  /** Тип добавочного урона. */
  type: string;
  save?: AbilityKey;
  effect?: Omit<AutomationEffect, 'name'>;
  concentration?: boolean;
  /** Вынужденный сдвиг при провале спаса (Thunderous: толчок на 10 фт). */
  forceFeet?: number;
}

/**
 * Смайты XPHB (2024): бонусным действием сразу после попадания — доп. кости
 * урона и, при провале спаса, эффект/сдвиг. Скейл апкаста захардкожен: у не-SRD
 * заклинаний нет `higherLevel` (системный HI-долг, как у Green-Flame Blade).
 */
const SMITE_CONFIGS: Record<string, SmiteConfig> = {
  'XPHB:Divine Smite': { base: '2d8', per: '1d8', above: 1, type: 'radiant' },
  'XPHB:Thunderous Smite': {
    base: '2d6',
    per: '1d6',
    above: 1,
    type: 'thunder',
    save: 'str',
    forceFeet: 10,
    effect: { duration: PERMANENT, to: 'targets', modifiers: [], conditions: ['prone'] },
  },
  'XPHB:Wrathful Smite': {
    base: '1d6',
    per: '1d6',
    above: 1,
    type: 'necrotic',
    save: 'wis',
    concentration: true,
    effect: {
      duration: { type: 'untilSave', ability: 'wis', dc: 0, timing: 'start' },
      concentration: true,
      to: 'targets',
      modifiers: [],
      conditions: ['frightened'],
    },
  },
  'XPHB:Blinding Smite': {
    base: '3d8',
    per: '1d8',
    above: 3,
    type: 'radiant',
    save: 'con',
    concentration: true,
    effect: {
      duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'start' },
      concentration: true,
      to: 'targets',
      modifiers: [],
      conditions: ['blinded'],
    },
  },
  'XPHB:Shining Smite': {
    base: '2d6',
    per: '1d6',
    above: 2,
    type: 'radiant',
    concentration: true,
    effect: {
      duration: CONCENTRATION,
      concentration: true,
      to: 'targets',
      modifiers: [{ target: 'attack', mode: 'advantage', filter: { direction: 'against' } }],
      conditions: [],
      conditionImmunities: ['invisible'],
      light: { bright: 0, dim: 5 },
    },
  },
  'XPHB:Staggering Smite': {
    base: '4d6',
    per: '1d6',
    above: 4,
    type: 'psychic',
    save: 'wis',
    effect: { duration: UNTIL_NEXT_TURN, to: 'targets', modifiers: [], conditions: ['stunned'] },
  },
  'XPHB:Banishing Smite': {
    base: '5d10',
    type: 'force',
    save: 'cha',
    concentration: true,
    effect: {
      duration: { type: 'rounds', rounds: 10 },
      concentration: true,
      to: 'targets',
      modifiers: [],
      conditions: ['incapacitated'],
      banish: true,
    },
  },
};

/** Билдер XPHB-смайта: доп. кости урона (апкаст), спас и эффект при провале. */
function xphbSmiteDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  const cfg = SMITE_CONFIGS[spell.key];
  if (!cfg) return undefined;
  const level = Math.max(spell.level, opts.castLevel ?? spell.level);
  const extra = cfg.per && cfg.above ? Math.max(0, level - cfg.above) : 0;
  const dice = [cfg.base, ...Array.from({ length: extra }, () => cfg.per!)].join(' + ');
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'auto',
    ...(cfg.concentration ? { concentration: true } : {}),
    damage: { dice, types: [cfg.type] },
    ...(cfg.save ? { save: { ability: cfg.save } } : {}),
    ...(cfg.forceFeet ? { force: { kind: 'push' as const, feet: cfg.forceFeet } } : {}),
    ...(cfg.effect ? { effects: [{ name: spell.name, ...cfg.effect }] } : {}),
  };
}

/** Heal (XPHB 2024): плоское лечение 70 (+10 за круг выше 6), снимает Blinded/Deafened/Poisoned. */
function healSpellDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'XPHB:Heal') return undefined;
  const castLevel = Math.max(spell.level, opts.castLevel ?? spell.level);
  const amount = 70 + 10 * Math.max(0, castLevel - 6);
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'auto',
    heal: { dice: String(amount) },
    endConditions: ['blinded', 'deafened', 'poisoned'],
  };
}

/**
 * Green-Flame Blade (TCE 2024): атака оружием правой руки; на попадании —
 * райдер огнём (0/1к8/2к8/3к8 на 1/5/11/17) и вторичная цель в 5 фт:
 * урон огнём = мод заклинательной характеристики + те же кости. Скейл
 * захардкожен: у не-SRD заклинаний нет `higherLevel` (системный HI-долг).
 */
function greenFlameBladeDef(spell: Spell, opts: AutomationOptions): AutomationDef | undefined {
  if (spell.key !== 'TCE:Green-Flame Blade') return undefined;
  const level = opts.characterLevel ?? 1;
  const dice = level >= 17 ? '3d8' : level >= 11 ? '2d8' : level >= 5 ? '1d8' : undefined;
  return {
    key: spell.key,
    name: spell.name,
    resolution: 'attack',
    attack: { rangeType: 'melee' },
    weaponAttack: {
      ...(dice ? { riderDice: `${dice}fire` } : {}),
      secondary: { rangeFeet: 5, ...(dice ? { dice } : {}), damageType: 'fire' },
    },
  };
}

/**
 * Определение автоматизации заклинания: строка каталога → деривация из данных
 * (атака/спасбросок/автоурон) → `manual`. Уровни уже применены к `dice`/`count`.
 */
export function automationForSpell(spell: Spell, opts: AutomationOptions = {}): AutomationDef {
  const catalog = AUTOMATION_SPELLS[spell.key];
  if (catalog) return withSpellDice(catalog, spell, opts);

  const greenFlame = greenFlameBladeDef(spell, opts);
  if (greenFlame) return greenFlame;

  const breath = breathSpellDef(spell, opts);
  if (breath) return breath;

  const protectionEnergy = protectionFromEnergyDef(spell, opts);
  if (protectionEnergy) return protectionEnergy;

  const vampiric = vampiricTouchDef(spell, opts);
  if (vampiric) return vampiric;

  const flameBlade = flameBladeDef(spell, opts);
  if (flameBlade) return flameBlade;

  const sunbeam = sunbeamDef(spell, opts);
  if (sunbeam) return sunbeam;

  const heatMetal = heatMetalDef(spell, opts);
  if (heatMetal) return heatMetal;

  const callLightning = callLightningDef(spell, opts);
  if (callLightning) return callLightning;

  const heal = healSpellDef(spell, opts);
  if (heal) return heal;

  const heroism = heroismDef(spell, opts);
  if (heroism) return heroism;

  const enhance = enhanceAbilityDef(spell, opts);
  if (enhance) return enhance;

  const skillEmpowerment = skillEmpowermentDef(spell, opts);
  if (skillEmpowerment) return skillEmpowerment;

  const farStep = farStepDef(spell);
  if (farStep) return farStep;

  const armorOfAgathys = armorOfAgathysDef(spell, opts);
  if (armorOfAgathys) return armorOfAgathys;

  const invisibility = invisibilityDef(spell, opts);
  if (invisibility) return invisibility;

  const magicWeapon = magicWeaponDef(spell, opts);
  if (magicWeapon) return magicWeapon;

  const eyebite = eyebiteDef(spell, opts);
  if (eyebite) return eyebite;

  const command = commandDef(spell, opts);
  if (command) return command;

  const smite = xphbSmiteDef(spell, opts);
  if (smite) return smite;

  const searing = searingSmiteDef(spell, opts);
  if (searing) return searing;

  const ensnaring = ensnaringStrikeDef(spell, opts);
  if (ensnaring) return ensnaring;

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
    if (addition.side) merged.side = addition.side;
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
