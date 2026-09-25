import type { AutomationDef, AutomationEffect, AutomationPayload, ZoneDef } from '../../domain/automation';
import { DAMAGE_TYPES } from '../../labels';
import { CHILL_TOUCH, CONCENTRATION, EVIL_GOOD_TYPES, GREASE_PRONE, PERMANENT, SLEET_PRONE, STINKING_POISONED, UNTIL_NEXT_TURN, WEB_RESTRAINED, manualSpell, remarkAction, spellEffect, zoneMoveAction } from './header';

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
  /**
   * Silence (XPHB 2024): сфера r20 — звук не возникает и не проходит; целиком
   * внутри — оглохший и иммунитет к звуку; вербальные заклинания невозможны.
   */
  'XPHB:Silence': {
    key: 'XPHB:Silence',
    name: 'Silence',
    resolution: 'effect',
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
        enter: { save: { ability: 'con', half: true }, damage: { dice: '$spell', types: ['poison'] } },
        startOfTurn: { save: { ability: 'con', half: true }, damage: { dice: '$spell', types: ['poison'] } },
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
  // B1: баффы оружия. Divine Favor — свои атаки, Crusader's Mantle — аура союзникам,
  // Holy Weapon — цель-носитель + выданный бонусным действием «Разряд».
  /** Divine Favor (XPHB 2024): бонусным действием — оружейные атаки +1d4 излучением, без концентрации. */
  'XPHB:Divine Favor': {
    key: 'XPHB:Divine Favor',
    name: 'Divine Favor',
    resolution: 'effect',
    effects: [
      {
        name: 'Divine Favor',
        duration: PERMANENT,
        to: 'self',
        modifiers: [{ target: 'damage', mode: 'add', value: '1d4radiant', filter: { weapon: true, unarmed: false } }],
      },
    ],
  },
  /** Crusader's Mantle (XPHB 2024): эманация 30 фт — вы и союзники +1d4 излучением оружием и безоружным ударом. */
  "XPHB:Crusader's Mantle": {
    key: "XPHB:Crusader's Mantle",
    name: "Crusader's Mantle",
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
            // RAW 2024: оружие **и** безоружный удар, поэтому без `unarmed: false`.
            name: "Crusader's Mantle",
            duration: PERMANENT,
            to: 'targets',
            modifiers: [{ target: 'damage', mode: 'add', value: '1d4radiant', filter: { weapon: true } }],
          },
        ],
      },
    },
  },
  /** Holy Weapon (XGE): касание — оружие светит 30/30 и бьёт +2d8 излучением; «Разряд» завершает эффект. */
  'XGE:Holy Weapon': {
    key: 'XGE:Holy Weapon',
    name: 'Holy Weapon',
    resolution: 'effect',
    concentration: true,
    targeting: { kind: 'creature', range: 5 },
    effects: [
      {
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
            endsEffect: true,
            def: {
              key: 'XGE:Holy Weapon:burst',
              name: 'Разряд',
              resolution: 'save',
              save: { ability: 'con', half: true },
              damage: { dice: '4d8', types: ['radiant'] },
              area: { shape: 'sphere', size: 30 },
              targeting: { kind: 'area', area: { shape: 'sphere', size: 30 }, range: 30 },
              effects: [
                {
                  name: 'Holy Weapon',
                  duration: { type: 'endOfTurn', of: 'source' },
                  to: 'targets',
                  modifiers: [],
                  conditions: ['blinded'],
                },
              ],
            },
          },
        ],
      },
    ],
  },
  /**
   * Fount of Moonlight (XPHB): сияние 20/20, сопротивление излучению, +2d6 излучением
   * ближним атакам (в т.ч. заклинательным — контекст урона с `attackType`) и реакция
   * «вспышка» на урон от видимого существа в 60 фт (CON-спас, слепота до след. хода).
   */
  'XPHB:Fount of Moonlight': {
    key: 'XPHB:Fount of Moonlight',
    name: 'Fount of Moonlight',
    resolution: 'effect',
    concentration: true,
    effects: [
      {
        name: 'Fount of Moonlight',
        duration: CONCENTRATION,
        concentration: true,
        to: 'self',
        modifiers: [
          { target: 'damage', mode: 'add', value: '2d6radiant', filter: { attackType: 'melee' } },
          { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'radiant' } },
        ],
        light: { bright: 20, dim: 20 },
        damageReaction: { ability: 'con', feet: 60, condition: 'blinded' },
      },
    ],
  },
  // Animate Objects: до 10 предметов со своими статблоками — механика отдельным
  // срезом. Без записи деривация из данных давала ложный авто-урон 1d4 по цели.
  'XPHB:Animate Objects': {
    key: 'XPHB:Animate Objects',
    name: 'Animate Objects',
    resolution: 'manual',
    concentration: true,
  },
  // Класс H аудита: «нет типа» (решение владельца, сессия 13) — не автоматизируем.
  // В данных у всех `automation: 'full'`, но механики нет — без явной записи деривация
  // давала ложный спас/авто-урон. Ray of Enfeeblement отложен, но выключен так же;
  // «почти выразимо» (Bestow Curse, Arcane Hand, Heroes' Feast) остаются в TODO.
  'XPHB:Phantasmal Force': manualSpell('XPHB:Phantasmal Force', 'Phantasmal Force', true),
  'XPHB:Control Water': manualSpell('XPHB:Control Water', 'Control Water', true),
  'XGE:Transmute Rock': manualSpell('XGE:Transmute Rock', 'Transmute Rock'),
  'XPHB:Ray of Enfeeblement': manualSpell('XPHB:Ray of Enfeeblement', 'Ray of Enfeeblement', true),
  'XPHB:Meld into Stone': manualSpell('XPHB:Meld into Stone', 'Meld into Stone'),
  'XPHB:Forbiddance': manualSpell('XPHB:Forbiddance', 'Forbiddance'),
  'XGE:Create Homunculus': manualSpell('XGE:Create Homunculus', 'Create Homunculus'),
  'XPHB:Dream': manualSpell('XPHB:Dream', 'Dream'),
  'XPHB:Contact Other Plane': manualSpell('XPHB:Contact Other Plane', 'Contact Other Plane'),
  'XPHB:Geas': manualSpell('XPHB:Geas', 'Geas'),
  'XGE:Soul Cage': manualSpell('XGE:Soul Cage', 'Soul Cage'),
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
  /** Прибавить модификатор заклинательной характеристики к лечению (Cure Wounds и др.). */
  healAbilityMod?: boolean;
  /** Фильтр целей мгновенной части по стороне (Spirit Guardians: только враги). */
  side?: 'hostile' | 'ally';
  /** Harm: снижение максимума HP цели на фактически полученный ею урон. */
  maxHpFromDamage?: boolean;
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
  'XPHB:Cure Wounds': { healAbilityMod: true },
  'XPHB:Healing Word': { healAbilityMod: true },
  'XPHB:Mass Healing Word': { targets: 6, healAbilityMod: true },
  'XPHB:Prayer of Healing': { targets: 5 },
  'XPHB:Mass Cure Wounds': { targets: 6, healAbilityMod: true },
  'XPHB:Chill Touch': { effects: [CHILL_TOUCH] },
  'XPHB:Harm': { maxHpFromDamage: true },
};

/** Подстановка выражения урона заклинания в кости триггеров зоны (`'$spell'`). */
export function resolveZoneDice(zone: ZoneDef, expression: string): ZoneDef {
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