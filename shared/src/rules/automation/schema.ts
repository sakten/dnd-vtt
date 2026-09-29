import { SENSE_TYPES } from '../../domain/sense';
import { CONDITION_KEYS } from '../conditions';

/**
 * JSON-Schema (draft 2020-12) формы `AutomationSpec` (R16 шаг 4, срез 2):
 * структурный слой валидации записей каталога и CUSTOM-спеков; семантика
 * (матрица `primary` × блоки, словари выборов) — `validateSpec` в `compile.ts`.
 * Схема — рукописная: новый блок/поле спека добавляется сюда (deploy-инвариант
 * «неизвестное поле — ошибка», `additionalProperties: false`).
 */

const ABILITY = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const PART_ROLES = ['main', 'success', 'repeat', 'trigger', 'choice'];
const MODIFIER_TARGETS = [
  'attack',
  'damage',
  'ac',
  'save',
  'check',
  'speed',
  'initiative',
  'maxHp',
  'spellDc',
  'spellAttack',
  'extraActions',
  'extraBonusActions',
  'reach',
];
const MODIFIER_MODES = ['add', 'multiply', 'set', 'advantage', 'disadvantage', 'resistance', 'immunity', 'vulnerability'];
const RESOLUTIONS = ['attack', 'save', 'auto', 'effect', 'utility', 'summon', 'shape', 'manual'];
const UTILITY_KINDS = [
  'extraAction',
  'extraMovement',
  'disengage',
  'check',
  'extraAttacks',
  'weaponAttack',
  'healPool',
  'tempHp',
  'patientDefense',
  'stepOfTheWind',
  'moveZone',
  'teleport',
  'scatter',
  'wake',
  'revive',
  'recallWeapon',
  'kenseisShot',
  'sharpenBlade',
  'stabilize',
  'endCondition',
  'direction',
  'telekinesis',
  'dispel',
];

function enumOf(values: readonly string[]) {
  return { enum: [...values] };
}

const valueExpr: Record<string, unknown> = {
  oneOf: [
    { type: 'string' },
    { type: 'number' },
    {
      type: 'object',
      properties: {
        ref: enumOf([
          'cantrip',
          'damage',
          'part',
          'upcastDice',
          'upcastAttack',
          'upcastFlat',
          'spellDamage',
          'type0',
          'spellMod',
          'castLevel',
          'characterLevel',
          'choice',
          'spellAttackCount',
        ]),
        part: enumOf(PART_ROLES),
        index: { type: 'integer', minimum: 0 },
        choice: { type: 'string' },
        optional: { type: 'boolean' },
        fallback: { $ref: '#/$defs/valueExpr' },
      },
      required: ['ref'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { add: { type: 'array', items: { $ref: '#/$defs/valueExpr' }, minItems: 2, maxItems: 2 } },
      required: ['add'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { sum: { type: 'array', items: { $ref: '#/$defs/valueExpr' } } },
      required: ['sum'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { concat: { type: 'array', items: { $ref: '#/$defs/valueExpr' } } },
      required: ['concat'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        join: {
          type: 'object',
          properties: { parts: { type: 'array', items: { $ref: '#/$defs/valueExpr' } }, sep: { type: 'string' } },
          required: ['parts', 'sep'],
          additionalProperties: false,
        },
      },
      required: ['join'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        includes: {
          type: 'object',
          properties: { of: { $ref: '#/$defs/valueExpr' }, values: { type: 'array', items: { type: 'string' } } },
          required: ['of', 'values'],
          additionalProperties: false,
        },
      },
      required: ['includes'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        tiers: {
          type: 'array',
          items: {
            type: 'object',
            properties: { above: { type: 'number' }, value: { type: 'number' } },
            required: ['above', 'value'],
            additionalProperties: false,
          },
        },
      },
      required: ['tiers'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        perLevel: {
          type: 'object',
          properties: {
            base: { type: 'number' },
            per: { type: 'number' },
            above: { oneOf: [{ type: 'number' }, { const: 'spell' }] },
            optional: { type: 'boolean' },
          },
          required: ['base', 'per', 'above'],
          additionalProperties: false,
        },
      },
      required: ['perLevel'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        spellMod: {
          type: 'object',
          properties: { base: { type: 'number' }, min: { type: 'number' } },
          required: ['base'],
          additionalProperties: false,
        },
      },
      required: ['spellMod'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        scale: {
          type: 'object',
          properties: {
            dice: { $ref: '#/$defs/valueExpr' },
            by: {
              oneOf: [
                { const: 'upcast' },
                {
                  type: 'object',
                  properties: { dice: { type: 'string', minLength: 1 } },
                  required: ['dice'],
                  additionalProperties: false,
                },
              ],
            },
          },
          required: ['dice', 'by'],
          additionalProperties: false,
        },
      },
      required: ['scale'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mapped: {
          type: 'object',
          properties: {
            of: { $ref: '#/$defs/valueExpr' },
            values: { type: 'object', additionalProperties: { type: 'string' } },
            fallback: { $ref: '#/$defs/valueExpr' },
          },
          required: ['of', 'values'],
          additionalProperties: false,
        },
      },
      required: ['mapped'],
      additionalProperties: false,
    },
  ],
};

const duration: Record<string, unknown> = {
  oneOf: [
    {
      type: 'object',
      properties: { type: { const: 'rounds' }, rounds: { type: 'number', minimum: 1 } },
      required: ['type', 'rounds'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'untilSave' },
        ability: enumOf(ABILITY),
        dc: { type: 'number' },
        timing: enumOf(['start', 'end', 'damage']),
        damage: {
          type: 'object',
          properties: { dice: { type: 'string', minLength: 1 }, types: { type: 'array', items: { type: 'string' } } },
          required: ['dice', 'types'],
          additionalProperties: false,
        },
      },
      required: ['type', 'ability', 'dc', 'timing'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { type: { const: 'endOfTurn' }, of: enumOf(['source', 'target']) },
      required: ['type', 'of'],
      additionalProperties: false,
    },
    { type: 'object', properties: { type: { const: 'concentration' } }, required: ['type'], additionalProperties: false },
    { type: 'object', properties: { type: { const: 'permanent' } }, required: ['type'], additionalProperties: false },
  ],
};

const leveledDuration: Record<string, unknown> = {
  oneOf: [
    { $ref: '#/$defs/duration' },
    {
      type: 'object',
      properties: {
        levels: {
          type: 'array',
          items: {
            type: 'object',
            properties: { above: { type: 'number' }, value: { $ref: '#/$defs/duration' } },
            required: ['above', 'value'],
            additionalProperties: false,
          },
        },
        fallback: { $ref: '#/$defs/duration' },
      },
      required: ['levels'],
      additionalProperties: false,
    },
  ],
};

const leveledBoolean: Record<string, unknown> = {
  oneOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        levels: {
          type: 'array',
          items: {
            type: 'object',
            properties: { above: { type: 'number' }, value: { type: 'boolean' } },
            required: ['above', 'value'],
            additionalProperties: false,
          },
        },
        fallback: { type: 'boolean' },
      },
      required: ['levels'],
      additionalProperties: false,
    },
  ],
};

const leveledMaxRounds: Record<string, unknown> = {
  oneOf: [
    { type: ['integer', 'null'], minimum: 1 },
    {
      type: 'object',
      properties: {
        levels: {
          type: 'array',
          items: {
            type: 'object',
            properties: { above: { type: 'number' }, value: { type: ['integer', 'null'], minimum: 1 } },
            required: ['above', 'value'],
            additionalProperties: false,
          },
        },
        fallback: { type: ['integer', 'null'], minimum: 1 },
      },
      required: ['levels'],
      additionalProperties: false,
    },
  ],
};

const damageSpec: Record<string, unknown> = {
  oneOf: [
    {
      type: 'object',
      properties: {
        dice: { $ref: '#/$defs/valueExpr' },
        types: { type: 'array', items: { $ref: '#/$defs/valueExpr' } },
        abilityMod: { type: 'boolean' },
      },
      required: ['dice'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        parts: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: { dice: { $ref: '#/$defs/valueExpr' }, type: { $ref: '#/$defs/valueExpr' } },
            required: ['dice', 'type'],
            additionalProperties: false,
          },
        },
      },
      required: ['parts'],
      additionalProperties: false,
    },
  ],
};

const save: Record<string, unknown> = {
  type: 'object',
  properties: { ability: enumOf(ABILITY), half: { type: 'boolean' } },
  required: ['ability'],
  additionalProperties: false,
};

const area: Record<string, unknown> = {
  type: 'object',
  properties: {
    shape: enumOf(['sphere', 'cone', 'cube', 'line', 'cylinder', 'ring']),
    size: { type: 'number' },
    width: { type: 'number' },
    inner: { type: 'number' },
  },
  required: ['shape', 'size'],
  additionalProperties: false,
};

const targeting: Record<string, unknown> = {
  type: 'object',
  properties: {
    kind: enumOf(['self', 'creature', 'point', 'area']),
    range: { type: 'number' },
    targets: { type: 'number' },
    area: { $ref: '#/$defs/area' },
    from: enumOf(['caster', 'origin']),
  },
  required: ['kind'],
  additionalProperties: false,
};

const sense: Record<string, unknown> = {
  type: 'object',
  properties: { type: enumOf(SENSE_TYPES), range: { type: 'number' } },
  required: ['type', 'range'],
  additionalProperties: false,
};

const restrictions: Record<string, unknown> = {
  type: 'object',
  properties: {
    noActions: { type: 'boolean' },
    noBonus: { type: 'boolean' },
    noActionsFromEffect: { type: 'boolean' },
    noReactions: { type: 'boolean' },
    noOpportunityAttacks: { type: 'boolean' },
    ignoresOpportunityAttacks: { type: 'boolean' },
    oneAttackOnly: { type: 'boolean' },
    actionOrBonusOnly: { type: 'boolean' },
    spellFailureChance: { type: 'number' },
    noSpells: { type: 'boolean' },
  },
  additionalProperties: false,
};

const light: Record<string, unknown> = {
  type: 'object',
  properties: { bright: { type: 'number' }, dim: { type: 'number' }, sunlight: { type: 'boolean' } },
  required: ['bright', 'dim'],
  additionalProperties: false,
};

const modifierFilterSpec: Record<string, unknown> = {
  type: 'object',
  properties: {
    attackType: enumOf(['melee', 'ranged']),
    ability: { $ref: '#/$defs/valueExpr' },
    skill: { $ref: '#/$defs/valueExpr' },
    damageType: { $ref: '#/$defs/valueExpr' },
    rangeType: enumOf(['melee', 'ranged', 'none']),
    targetId: { type: 'string' },
    direction: enumOf(['self', 'against']),
    weapon: { type: 'boolean' },
    unarmed: { type: 'boolean' },
    conditions: { type: 'array', items: enumOf(CONDITION_KEYS) },
    magical: { type: 'boolean' },
    kenseiWeapon: { type: 'boolean' },
    creatureTypes: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: false,
};

const modifierSpec: Record<string, unknown> = {
  type: 'object',
  properties: {
    target: enumOf(MODIFIER_TARGETS),
    mode: enumOf(MODIFIER_MODES),
    value: { $ref: '#/$defs/valueExpr' },
    filter: { $ref: '#/$defs/modifierFilterSpec' },
  },
  required: ['target', 'mode'],
  additionalProperties: false,
};

const modifierPlain: Record<string, unknown> = {
  type: 'object',
  properties: {
    target: enumOf(MODIFIER_TARGETS),
    mode: enumOf(MODIFIER_MODES),
    value: { type: ['number', 'string'] },
    filter: {
      type: 'object',
      properties: {
        attackType: enumOf(['melee', 'ranged']),
        ability: enumOf(ABILITY),
        skill: { type: 'string' },
        damageType: { type: 'string' },
        rangeType: enumOf(['melee', 'ranged', 'none']),
        targetId: { type: 'string' },
        direction: enumOf(['self', 'against']),
        weapon: { type: 'boolean' },
        unarmed: { type: 'boolean' },
        conditions: { type: 'array', items: enumOf(CONDITION_KEYS) },
        magical: { type: 'boolean' },
        kenseiWeapon: { type: 'boolean' },
        creatureTypes: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  },
  required: ['target', 'mode'],
  additionalProperties: false,
};

const effectTriggerSpec: Record<string, unknown> = {
  type: 'object',
  properties: { tempHp: { $ref: '#/$defs/valueExpr' }, damage: { $ref: '#/$defs/damageSpec' } },
  additionalProperties: false,
};

const triggerAction: Record<string, unknown> = {
  oneOf: [
    {
      type: 'object',
      properties: {
        save: {
          type: 'object',
          properties: {
            ability: enumOf(ABILITY),
            dc: { $ref: '#/$defs/valueExpr' },
            onFail: { type: 'array', items: { $ref: '#/$defs/triggerAction' } },
            onSuccess: { type: 'array', items: { $ref: '#/$defs/triggerAction' } },
          },
          required: ['ability'],
          additionalProperties: false,
        },
      },
      required: ['save'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        damage: {
          type: 'object',
          properties: {
            damageType: { $ref: '#/$defs/valueExpr' },
            dice: { $ref: '#/$defs/valueExpr' },
            amount: { $ref: '#/$defs/valueExpr' },
            to: enumOf(['source', 'self']),
            feet: { type: 'number' },
          },
          required: ['damageType', 'to'],
          additionalProperties: false,
        },
      },
      required: ['damage'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        reduce: {
          type: 'object',
          properties: {
            dice: { $ref: '#/$defs/valueExpr' },
            types: { type: 'array', items: { $ref: '#/$defs/valueExpr' } },
          },
          required: ['dice', 'types'],
          additionalProperties: false,
        },
      },
      required: ['reduce'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        extraDamage: {
          type: 'object',
          properties: {
            dice: { $ref: '#/$defs/valueExpr' },
            damageType: { $ref: '#/$defs/valueExpr' },
            from: { const: 'source' },
            oncePerTurn: { type: 'boolean' },
          },
          required: ['dice', 'damageType'],
          additionalProperties: false,
        },
      },
      required: ['extraDamage'],
      additionalProperties: false,
    },
    { type: 'object', properties: { redirect: { const: 'linked' } }, required: ['redirect'], additionalProperties: false },
    { type: 'object', properties: { endEffect: { const: true } }, required: ['endEffect'], additionalProperties: false },
    {
      type: 'object',
      properties: {
        repeatSave: {
          type: 'object',
          properties: { advantage: { type: 'boolean' } },
          additionalProperties: false,
        },
      },
      required: ['repeatSave'],
      additionalProperties: false,
    },
    { type: 'object', properties: { preventHeal: { const: true } }, required: ['preventHeal'], additionalProperties: false },
    { type: 'object', properties: { maximizeHeal: { const: true } }, required: ['maximizeHeal'], additionalProperties: false },
    {
      type: 'object',
      properties: {
        survive: {
          type: 'object',
          properties: { hp: { const: 1 } },
          required: ['hp'],
          additionalProperties: false,
        },
      },
      required: ['survive'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { rollMode: { const: 'advantage' } },
      required: ['rollMode'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { noDamageOnSuccess: { const: true } },
      required: ['noDamageOnSuccess'],
      additionalProperties: false,
    },
    { type: 'object', properties: { cancel: { const: true } }, required: ['cancel'], additionalProperties: false },
    {
      type: 'object',
      properties: {
        reaction: {
          type: 'object',
          properties: { kind: { const: 'ward' }, types: { type: 'array', items: { $ref: '#/$defs/valueExpr' } } },
          required: ['kind', 'types'],
          additionalProperties: false,
        },
      },
      required: ['reaction'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        reaction: {
          type: 'object',
          properties: {
            kind: { const: 'saveCondition' },
            ability: { $ref: '#/$defs/valueExpr' },
            feet: { type: 'number' },
            condition: enumOf(CONDITION_KEYS),
          },
          required: ['kind', 'ability', 'feet', 'condition'],
          additionalProperties: false,
        },
      },
      required: ['reaction'],
      additionalProperties: false,
    },
  ],
};

const gatedValueExpr: Record<string, unknown> = {
  oneOf: [
    { $ref: '#/$defs/valueExpr' },
    {
      type: 'object',
      properties: { if: { $ref: '#/$defs/valueExpr' }, then: { $ref: '#/$defs/valueExpr' } },
      required: ['if', 'then'],
      additionalProperties: false,
    },
  ],
};

const gatedModifier: Record<string, unknown> = {
  oneOf: [
    { $ref: '#/$defs/modifierSpec' },
    {
      type: 'object',
      properties: { if: { $ref: '#/$defs/valueExpr' }, then: { $ref: '#/$defs/modifierSpec' } },
      required: ['if', 'then'],
      additionalProperties: false,
    },
  ],
};

const gatedSenseList: Record<string, unknown> = {
  oneOf: [
    { type: 'array', items: { $ref: '#/$defs/sense' } },
    {
      type: 'object',
      properties: {
        if: { $ref: '#/$defs/valueExpr' },
        then: { type: 'array', items: { $ref: '#/$defs/sense' } },
      },
      required: ['if', 'then'],
      additionalProperties: false,
    },
  ],
};

const gatedBoolean: Record<string, unknown> = {
  oneOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: { if: { $ref: '#/$defs/valueExpr' }, then: { type: 'boolean' } },
      required: ['if', 'then'],
      additionalProperties: false,
    },
  ],
};

const gatedTurnDodge: Record<string, unknown> = {
  oneOf: [
    {
      type: 'object',
      properties: { ability: { $ref: '#/$defs/valueExpr' } },
      required: ['ability'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        if: { $ref: '#/$defs/valueExpr' },
        then: {
          type: 'object',
          properties: { ability: { $ref: '#/$defs/valueExpr' } },
          required: ['ability'],
          additionalProperties: false,
        },
      },
      required: ['if', 'then'],
      additionalProperties: false,
    },
  ],
};

const gatedTriggerAction: Record<string, unknown> = {
  oneOf: [
    { $ref: '#/$defs/triggerAction' },
    {
      type: 'object',
      properties: { if: { $ref: '#/$defs/valueExpr' }, then: { $ref: '#/$defs/triggerAction' } },
      required: ['if', 'then'],
      additionalProperties: false,
    },
  ],
};

const gatedEffectTriggerSpec: Record<string, unknown> = {
  oneOf: [
    { $ref: '#/$defs/effectTriggerSpec' },
    {
      type: 'object',
      properties: { if: { $ref: '#/$defs/valueExpr' }, then: { $ref: '#/$defs/effectTriggerSpec' } },
      required: ['if', 'then'],
      additionalProperties: false,
    },
  ],
};

const triggerList: Record<string, unknown> = {
  oneOf: [
    { $ref: '#/$defs/gatedTriggerAction' },
    { type: 'array', items: { $ref: '#/$defs/gatedTriggerAction' } },
  ],
};

const effectTriggers: Record<string, unknown> = {
  type: 'object',
  properties: {
    startOfTurn: { $ref: '#/$defs/gatedEffectTriggerSpec' },
    endOfTurn: { $ref: '#/$defs/gatedEffectTriggerSpec' },
    targetedByAttack: { $ref: '#/$defs/triggerList' },
    damaged: { $ref: '#/$defs/triggerList' },
    hpReachedZero: { $ref: '#/$defs/triggerList' },
    healReceived: { $ref: '#/$defs/triggerList' },
    deathSave: { $ref: '#/$defs/triggerList' },
    ownAttackRoll: { $ref: '#/$defs/triggerList' },
    ownSpellCast: { $ref: '#/$defs/triggerList' },
    ownDamageDealt: { $ref: '#/$defs/triggerList' },
    willingMove: { $ref: '#/$defs/triggerList' },
    saveSucceeded: { $ref: '#/$defs/triggerList' },
  },
  additionalProperties: false,
};

const usesSpec: Record<string, unknown> = {
  oneOf: [
    {
      type: 'object',
      properties: {
        kind: { const: 'charges' },
        count: { $ref: '#/$defs/valueExpr' },
        on: { const: 'rangedWeaponAttack' },
      },
      required: ['kind', 'count'],
      additionalProperties: false,
    },
    { type: 'object', properties: { kind: { const: 'consumeOnAttack' } }, required: ['kind'], additionalProperties: false },
    { type: 'object', properties: { kind: { const: 'consumeOnSave' } }, required: ['kind'], additionalProperties: false },
    {
      type: 'object',
      properties: {
        kind: { const: 'misdirect' },
        charges: { type: 'integer', minimum: 1 },
        die: { type: 'string', minLength: 1 },
        threshold: { type: 'integer' },
      },
      required: ['kind', 'charges', 'die', 'threshold'],
      additionalProperties: false,
    },
  ],
};

const loadoutSpec: Record<string, unknown> = {
  oneOf: [
    {
      type: 'object',
      properties: {
        kind: { const: 'augment' },
        attack: { $ref: '#/$defs/valueExpr' },
        damage: { $ref: '#/$defs/valueExpr' },
        magic: { type: 'boolean' },
      },
      required: ['kind'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        kind: { const: 'weaponOverride' },
        weapons: { type: 'array', items: { type: 'string' } },
        dice: { $ref: '#/$defs/valueExpr' },
        damageType: { $ref: '#/$defs/valueExpr' },
        abilityMod: { $ref: '#/$defs/valueExpr' },
      },
      required: ['kind', 'weapons', 'dice', 'damageType', 'abilityMod'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        kind: { const: 'shadowBlade' },
        dice: { $ref: '#/$defs/valueExpr' },
        inHand: { type: 'boolean' },
      },
      required: ['kind', 'dice', 'inHand'],
      additionalProperties: false,
    },
  ],
};

const payloadSpec: Record<string, unknown> = {
  type: 'object',
  properties: {
    save: { $ref: '#/$defs/save' },
    damage: { $ref: '#/$defs/damageSpec' },
    heal: {
      type: 'object',
      properties: { dice: { $ref: '#/$defs/valueExpr' } },
      required: ['dice'],
      additionalProperties: false,
    },
    successDamage: {
      type: 'object',
      properties: { dice: { $ref: '#/$defs/valueExpr' }, types: { type: 'array', items: { type: 'string' } } },
      required: ['dice'],
      additionalProperties: false,
    },
    effects: { type: 'array', items: { $ref: '#/$defs/effect' } },
    endConditions: { type: 'array', items: enumOf(CONDITION_KEYS) },
    healTo: { type: 'number' },
    containment: enumOf(['anyCell', 'fullyWithin']),
  },
  additionalProperties: false,
};

const wallDimsSpec: Record<string, unknown> = {
  oneOf: [
    {
      type: 'object',
      properties: {
        length: { type: 'number' },
        width: { type: 'number' },
        outerRadius: { type: 'number' },
        innerRadius: { type: 'number' },
        thin: { type: 'boolean' },
        panelFeet: { type: 'number' },
      },
      required: ['length', 'width', 'outerRadius', 'innerRadius'],
      additionalProperties: false,
    },
    { type: 'object', properties: { from: { const: 'spell' } }, required: ['from'], additionalProperties: false },
  ],
};

const utilitySpec: Record<string, unknown> = {
  type: 'object',
  properties: {
    kind: enumOf(UTILITY_KINDS),
    amount: { type: 'number' },
    ability: enumOf(ABILITY),
    maxSize: enumOf(['normal', 'large', 'huge']),
    targets: { type: 'number' },
    destinationFeet: { type: 'number' },
    multiplier: { type: 'number' },
    thenMove: { type: 'boolean' },
    direction: enumOf(['up', 'down', 'left', 'right']),
    passenger: {
      type: 'object',
      properties: { feet: { type: 'number' }, destFeet: { type: 'number' }, maxSize: { type: 'boolean' } },
      required: ['feet', 'destFeet'],
      additionalProperties: false,
    },
    fromBurst: {
      type: 'object',
      properties: {
        feet: { type: 'number' },
        save: { $ref: '#/$defs/save' },
        damage: { $ref: '#/$defs/damageSpec' },
      },
      required: ['feet', 'save'],
      additionalProperties: false,
    },
    ignoreSight: { type: 'boolean' },
    dice: { $ref: '#/$defs/valueExpr' },
    blockedDamage: { $ref: '#/$defs/damageSpec' },
  },
  required: ['kind'],
  additionalProperties: false,
};

const actionSpec: Record<string, unknown> = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    cost: enumOf(['action', 'bonus', 'free']),
    defName: { type: 'string' },
    defKey: { type: 'string' },
    subKey: { type: 'string' },
    banishOnFail: { type: 'boolean' },
    requiresCreatureTypes: { type: 'array', items: { type: 'string' } },
    retarget: { type: 'boolean' },
    baseActionId: { type: 'string' },
    lifesteal: { type: 'boolean' },
    primary: enumOf(RESOLUTIONS),
    attack: {
      type: 'object',
      properties: { rangeType: enumOf(['melee', 'ranged']), advantageInZone: { type: 'boolean' } },
      required: ['rangeType'],
      additionalProperties: false,
    },
    count: { type: 'integer', minimum: 1 },
    shrinkFeet: { type: 'number' },
    endsEffect: { type: 'boolean' },
    area: {
      oneOf: [
        { $ref: '#/$defs/area' },
        {
          type: 'object',
          properties: { from: { const: 'spell' }, fallback: { $ref: '#/$defs/area' } },
          required: ['from', 'fallback'],
          additionalProperties: false,
        },
      ],
    },
    targeting: {
      oneOf: [
        { $ref: '#/$defs/targeting' },
        {
          type: 'object',
          properties: { kind: { const: 'area' }, fromArea: { const: true } },
          required: ['kind', 'fromArea'],
          additionalProperties: false,
        },
      ],
    },
    save: { $ref: '#/$defs/save' },
    damage: {
      type: 'object',
      properties: {
        dice: { $ref: '#/$defs/valueExpr' },
        types: { type: 'array', items: { $ref: '#/$defs/valueExpr' } },
        abilityMod: { type: 'boolean' },
      },
      required: ['dice'],
      additionalProperties: false,
    },
    effects: { type: 'array', items: { $ref: '#/$defs/effect' } },
    utility: { $ref: '#/$defs/utilitySpec' },
  },
  required: ['id', 'name', 'cost'],
  additionalProperties: false,
};

const effectSpec: Record<string, unknown> = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    duration: { $ref: '#/$defs/leveledDuration' },
    concentration: { $ref: '#/$defs/leveledBoolean' },
    to: enumOf(['self', 'targets']),
    modifiers: { type: 'array', items: { $ref: '#/$defs/gatedModifier' } },
    conditions: { type: 'array', items: { $ref: '#/$defs/gatedValueExpr' } },
    conditionImmunities: { type: 'array', items: { $ref: '#/$defs/gatedValueExpr' } },
    conditionImmunitiesFrom: {
      type: 'object',
      properties: { conditions: { type: 'array', items: enumOf(CONDITION_KEYS) }, types: { type: 'array', items: { type: 'string' } } },
      required: ['conditions', 'types'],
      additionalProperties: false,
    },
    immuneToSpeedReduction: { type: 'boolean' },
    ignoresDifficultTerrain: { type: 'boolean' },
    escape: {
      type: 'object',
      properties: {
        kind: enumOf(['check', 'save']),
        ability: { $ref: '#/$defs/valueExpr' },
        skill: { $ref: '#/$defs/valueExpr' },
        dc: { type: 'number' },
        label: { type: 'string' },
        iconKey: { type: 'string' },
      },
      required: ['ability'],
      additionalProperties: false,
    },
    escalate: {
      type: 'object',
      properties: { condition: { $ref: '#/$defs/valueExpr' }, duration: { $ref: '#/$defs/duration' } },
      required: ['condition'],
      additionalProperties: false,
    },
    onEnd: { $ref: '#/$defs/effect' },
    banish: { type: 'boolean' },
    light: { $ref: '#/$defs/light' },
    senses: { $ref: '#/$defs/gatedSenseList' },
    seesInvisible: { $ref: '#/$defs/gatedBoolean' },
    variant: { $ref: '#/$defs/valueExpr' },
    markTarget: { type: 'boolean' },
    mark: { type: 'boolean' },
    targets: { $ref: '#/$defs/valueExpr' },
    uses: { $ref: '#/$defs/usesSpec' },
    tempHp: { $ref: '#/$defs/valueExpr' },
    dominates: { type: 'boolean' },
    triggers: { $ref: '#/$defs/effectTriggers' },
    selfOnFail: { type: 'boolean' },
    maxHpBonus: {
      type: 'object',
      properties: { dice: { type: 'string', minLength: 1 } },
      required: ['dice'],
      additionalProperties: false,
    },
    turnDodge: { $ref: '#/$defs/gatedTurnDodge' },
    markSaved: { type: 'boolean' },
    restrictions: { $ref: '#/$defs/restrictions' },
    movement: {
      type: 'object',
      properties: {
        zephyrStrike: {
          type: 'object',
          properties: {
            dice: { type: 'string', minLength: 1 },
            damageType: { type: 'string', minLength: 1 },
            speedFeet: { type: 'number' },
          },
          required: ['dice', 'damageType', 'speedFeet'],
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    actions: { type: 'array', items: { $ref: '#/$defs/actionSpec' } },
    loadout: { $ref: '#/$defs/loadoutSpec' },
  },
  required: ['id', 'name', 'duration'],
  additionalProperties: false,
};

const zoneSpec: Record<string, unknown> = {
  type: 'object',
  properties: {
    area: {
      oneOf: [
        { $ref: '#/$defs/area' },
        {
          type: 'object',
          properties: { wall: { $ref: '#/$defs/wallDimsSpec' } },
          required: ['wall'],
          additionalProperties: false,
        },
      ],
    },
    origin: enumOf(['self', 'point']),
    duration: { $ref: '#/$defs/duration' },
    actions: { type: 'array', items: { $ref: '#/$defs/actionSpec' } },
    anchor: enumOf(['source', 'point']),
    containment: enumOf(['anyCell', 'fullyWithin']),
    side: enumOf(['hostile', 'ally']),
    light: { $ref: '#/$defs/light' },
    enterOncePerTurn: { type: 'boolean' },
    movable: { type: 'boolean' },
    onCreate: { $ref: '#/$defs/payloadSpec' },
    charges: { $ref: '#/$defs/valueExpr' },
    dealtLimit: { type: 'number' },
    excludeCreatureTypes: { type: 'array', items: { type: 'string' } },
    aura: { $ref: '#/$defs/payloadSpec' },
    excludeSource: { type: 'boolean' },
    triggers: {
      type: 'object',
      properties: {
        enter: { $ref: '#/$defs/payloadSpec' },
        exit: { $ref: '#/$defs/payloadSpec' },
        startOfTurn: { $ref: '#/$defs/payloadSpec' },
        endOfTurn: { $ref: '#/$defs/payloadSpec' },
      },
      additionalProperties: false,
    },
    wall: {
      type: 'object',
      properties: {
        sectionFeet: { type: 'number' },
        hp: { type: 'number' },
        ac: { type: 'number' },
        immunities: { type: 'array', items: { type: 'string' } },
        resistances: { type: 'array', items: { type: 'string' } },
        vulnerabilities: { type: 'array', items: { type: 'string' } },
        breach: { $ref: '#/$defs/payloadSpec' },
        immune: { type: 'boolean' },
        blocksMovement: { type: 'boolean' },
        blocksLineOfSight: { type: 'boolean' },
        blocksActions: { type: 'boolean' },
      },
      required: ['sectionFeet'],
      additionalProperties: false,
    },
    flags: {
      type: 'object',
      properties: {
        difficultTerrain: { type: 'boolean' },
        movementCost: { type: 'number' },
        obscured: enumOf(['light', 'heavy']),
        blocksLight: { type: 'boolean' },
        blocksLineOfSight: { type: 'boolean' },
        subtle: { type: 'boolean' },
        sprite: enumOf(['hammer', 'fey', 'guardian']),
        silence: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const weaponAttackSpec: Record<string, unknown> = {
  type: 'object',
  properties: {
    riderDice: { $ref: '#/$defs/valueExpr' },
    replace: { type: 'boolean' },
    anyWeapon: { type: 'boolean' },
    spellAbility: { type: 'boolean' },
    secondary: {
      type: 'object',
      properties: {
        rangeFeet: { type: 'number' },
        dice: { $ref: '#/$defs/valueExpr' },
        damageType: { type: 'string', minLength: 1 },
        save: { $ref: '#/$defs/save' },
        includePrimary: { type: 'boolean' },
      },
      required: ['rangeFeet', 'damageType'],
      additionalProperties: false,
    },
    hitEffect: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        duration: { $ref: '#/$defs/duration' },
        to: enumOf(['self', 'targets']),
        modifiers: { type: 'array', items: { $ref: '#/$defs/modifierPlain' } },
        conditions: { type: 'array', items: enumOf(CONDITION_KEYS) },
        triggers: { $ref: '#/$defs/effectTriggers' },
      },
      required: ['name', 'duration'],
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const choiceSpec: Record<string, unknown> = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    param: enumOf(['damageType', 'ability', 'skill', 'condition', 'mode', 'effect', 'command']),
    options: { type: 'array', minItems: 1, items: { type: 'string' } },
    default: { type: 'string' },
  },
  required: ['id', 'param', 'options'],
  additionalProperties: false,
};

const automation: Record<string, unknown> = {
  type: 'object',
  properties: {
    primary: enumOf(RESOLUTIONS),
    area: {
      oneOf: [
        { $ref: '#/$defs/area' },
        {
          type: 'object',
          properties: { from: { const: 'spell' }, fallback: { $ref: '#/$defs/area' } },
          required: ['from', 'fallback'],
          additionalProperties: false,
        },
      ],
    },
    concentration: { $ref: '#/$defs/leveledBoolean' },
    maxRounds: { $ref: '#/$defs/leveledMaxRounds' },
    save: { $ref: '#/$defs/save' },
    shape: {
      type: 'object',
      properties: { kind: { const: 'polymorph' }, crByTarget: { type: 'boolean' } },
      required: ['kind'],
      additionalProperties: false,
    },
    force: {
      type: 'object',
      properties: { kind: enumOf(['push', 'pull']), feet: { type: 'number' }, maxSize: enumOf(['normal', 'large', 'huge']) },
      required: ['kind', 'feet'],
      additionalProperties: false,
    },
    halfOnMiss: { type: 'boolean' },
    damage: { $ref: '#/$defs/damageSpec' },
    successDamage: { $ref: '#/$defs/damageSpec' },
    undeadTempHp: { type: 'boolean' },
    heal: {
      type: 'object',
      properties: {
        dice: { $ref: '#/$defs/valueExpr' },
        types: { type: 'array', items: { $ref: '#/$defs/valueExpr' } },
        abilityMod: { type: 'boolean' },
      },
      required: ['dice'],
      additionalProperties: false,
    },
    maxHpFromDamage: { type: 'boolean' },
    lifesteal: { type: 'boolean' },
    lifeTransfer: {
      type: 'object',
      properties: { factor: { type: 'number' } },
      required: ['factor'],
      additionalProperties: false,
    },
    attack: {
      type: 'object',
      properties: { rangeType: enumOf(['melee', 'ranged']), advantageInZone: { type: 'boolean' } },
      required: ['rangeType'],
      additionalProperties: false,
    },
    count: { $ref: '#/$defs/valueExpr' },
    targets: { type: 'integer', minimum: 1 },
    autoTargets: {
      type: 'object',
      properties: {
        feet: { type: 'number' },
        side: enumOf(['hostile', 'ally', 'any']),
        includeSelf: { type: 'boolean' },
      },
      required: ['feet', 'side'],
      additionalProperties: false,
    },
    side: enumOf(['hostile', 'ally']),
    chain: {
      type: 'object',
      properties: { jumps: { $ref: '#/$defs/valueExpr' }, feet: { type: 'number' } },
      required: ['jumps', 'feet'],
      additionalProperties: false,
    },
    burst: {
      type: 'object',
      properties: {
        rangeFeet: { type: 'number' },
        dice: { $ref: '#/$defs/valueExpr' },
        damageType: { $ref: '#/$defs/valueExpr' },
        save: { $ref: '#/$defs/save' },
        includePrimary: { type: 'boolean' },
      },
      required: ['rangeFeet', 'damageType'],
      additionalProperties: false,
    },
    targeting: { $ref: '#/$defs/targeting' },
    utility: { $ref: '#/$defs/utilitySpec' },
    movement: {
      type: 'object',
      properties: {
        teleportAfter: {
          type: 'object',
          properties: { feet: { type: 'number' } },
          required: ['feet'],
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    endConditions: { type: 'array', items: enumOf(CONDITION_KEYS) },
    excludeCreatureTypes: { type: 'array', items: { type: 'string' } },
    requiresCreatureTypes: { type: 'array', items: { type: 'string' } },
    saveAdvantageInCombat: { type: 'boolean' },
    effects: { type: 'array', items: { $ref: '#/$defs/effect' } },
    saveSuccess: { type: 'array', items: { $ref: '#/$defs/effect' } },
    zone: { $ref: '#/$defs/zoneSpec' },
    weaponAttack: { $ref: '#/$defs/weaponAttackSpec' },
    summon: {
      type: 'object',
      properties: {
        creature: { type: 'string', minLength: 1 },
        fromFamiliar: { type: 'boolean' },
        count: { type: 'integer', minimum: 1 },
        duration: { $ref: '#/$defs/duration' },
        initiative: enumOf(['afterCaster', 'own']),
        baseLevel: { type: 'integer', minimum: 1 },
      },
      required: ['initiative'],
      additionalProperties: false,
    },
    manual: {
      type: 'object',
      properties: {
        byDesign: { type: 'boolean' },
        chip: { anyOf: [enumOf(CONDITION_KEYS), { type: 'null' }] },
        chipActions: { type: 'array', items: { $ref: '#/$defs/actionSpec' } },
      },
      additionalProperties: false,
    },
    choices: { type: 'array', items: { $ref: '#/$defs/choiceSpec' } },
  },
  required: ['primary'],
};

const DEFS: Record<string, unknown> = {
  valueExpr,
  duration,
  leveledDuration,
  leveledBoolean,
  leveledMaxRounds,
  damageSpec,
  save,
  area,
  targeting,
  sense,
  restrictions,
  light,
  modifierFilterSpec,
  modifierSpec,
  modifierPlain,
  effectTriggerSpec,
  triggerAction,
  gatedValueExpr,
  gatedModifier,
  gatedSenseList,
  gatedBoolean,
  gatedTurnDodge,
  gatedTriggerAction,
  gatedEffectTriggerSpec,
  triggerList,
  effectTriggers,
  usesSpec,
  loadoutSpec,
  payloadSpec,
  wallDimsSpec,
  utilitySpec,
  actionSpec,
  effect: effectSpec,
  zoneSpec,
  weaponAttackSpec,
  choiceSpec,
  automation,
  spec: {
    type: 'object',
    properties: { key: { type: 'string', minLength: 1 }, name: { type: 'string', minLength: 1 } },
    required: ['key', 'name'],
    allOf: [{ $ref: '#/$defs/automation' }],
    unevaluatedProperties: false,
  },
  materialized: {
    type: 'object',
    allOf: [{ $ref: '#/$defs/automation' }],
    unevaluatedProperties: false,
  },
};

export const AUTOMATION_SPEC_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $defs: DEFS,
  $ref: '#/$defs/spec',
};

export const MATERIALIZED_AUTOMATION_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $defs: DEFS,
  $ref: '#/$defs/materialized',
};
