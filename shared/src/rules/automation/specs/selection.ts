import { SPELL_BASES } from '../bases';
import { CONCENTRATION, PERMANENT, UNTIL_NEXT_TURN } from '../header';
import type { AutomationSpec } from '../spec';

export const SELECTION_SPECS: Record<string, AutomationSpec> = {
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
};
