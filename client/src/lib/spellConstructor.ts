import {
  CUSTOM_SPELL_PREFIX,
  automationForSpell,
  generatedAutomation,
  parseDiceExpression,
  validateSpec,
  type AutomationSpec,
  type MaterializedAutomation,
  type Spell,
  type SpellDef,
  type SpecIssue,
} from 'shared';

/**
 * Конструктор кастомных заклинаний (R16 К1): чистые операции над канонической
 * записью `SpellDef = meta + automation`. Форма правит запись, сохранение —
 * тем же `custom:import`, что и JSON-импорт; сервер остаётся финальным
 * валидатором (схема + `validateSpec` + `compileSpec`).
 */

export type WizardProfileId = 'attack' | 'save' | 'heal' | 'buff' | 'control';

export interface WizardProfile {
  id: WizardProfileId;
  /** Заголовок карточки профиля (`ui.constructor.profile.<id>`). */
  labelKey: string;
  hintKey: string;
}

export const WIZARD_PROFILES: WizardProfile[] = [
  { id: 'attack', labelKey: 'ui.constructor.profile.attack', hintKey: 'ui.constructor.profile.attackHint' },
  { id: 'save', labelKey: 'ui.constructor.profile.save', hintKey: 'ui.constructor.profile.saveHint' },
  { id: 'heal', labelKey: 'ui.constructor.profile.heal', hintKey: 'ui.constructor.profile.healHint' },
  { id: 'buff', labelKey: 'ui.constructor.profile.buff', hintKey: 'ui.constructor.profile.buffHint' },
  { id: 'control', labelKey: 'ui.constructor.profile.control', hintKey: 'ui.constructor.profile.controlHint' },
];

/** Ключ кастомной записи из имени (сервер дополнит префикс, если его нет). */
export function keyFromName(name: string): string {
  return `${CUSTOM_SPELL_PREFIX}${name.trim()}`;
}

/** Базовая мета нового кастомного заклинания. */
function blankMeta(name: string): Spell {
  return {
    key: keyFromName(name),
    name,
    source: 'CUSTOM',
    level: 1,
    school: 'Evocation',
    time: [{ number: 1, unit: 'action' }],
    range: { type: 'ranged', distance: { type: 'feet', amount: 60 } },
    components: { v: true, s: true },
    duration: [{ type: 'instantaneous' }],
    classes: [],
    description: [''],
  };
}

/** Эффект-носитель для профилей «бафф» и «контроль». */
function buffAutomation(name: string): MaterializedAutomation {
  return {
    primary: 'effect',
    effects: [{ id: 'effect', name, duration: { type: 'permanent' }, to: 'targets', modifiers: [] }],
  };
}

/** Запись по профилю мастера: мета + автоматизация из данных/шаблона. */
export function blankRecord(profile: WizardProfileId, name: string): SpellDef {
  const spell = blankMeta(name);
  switch (profile) {
    case 'attack':
      spell.spellAttack = 'ranged';
      spell.damage = { dice: ['1d10'], types: ['force'] };
      break;
    case 'save':
      spell.save = ['dex'];
      spell.saveHalf = true;
      spell.damage = { dice: ['3d6'], types: ['fire'] };
      break;
    case 'heal':
      spell.healing = true;
      spell.damage = { dice: ['1d8'], types: [] };
      break;
    case 'buff':
      return { ...spell, automation: buffAutomation(name) };
    case 'control':
      spell.save = ['wis'];
      return {
        ...spell,
        automation: {
          primary: 'save',
          save: { ability: 'wis' },
          effects: [{ id: 'effect', name, duration: { type: 'permanent' }, to: 'targets', modifiers: [], conditions: [] }],
        },
      };
  }
  return { ...spell, automation: generatedAutomation(spell) };
}

/** Копия канона/кастома под новым именем (сложная автоматизация сохраняется). */
export function copyRecord(base: SpellDef, suffix: string): SpellDef {
  const clone = structuredClone(base);
  clone.name = suffix ? `${base.name} ${suffix}` : base.name;
  clone.key = keyFromName(clone.name);
  clone.source = 'CUSTOM';
  return clone;
}

export type ConstructorIssueCode = 'nameRequired' | 'nameTooLong' | 'diceInvalid' | 'compileFailed';

/** Локальная ошибка конструктора (мета/кости), вне `validateSpec`. */
export interface ConstructorIssue {
  code: ConstructorIssueCode;
  params?: Record<string, string | number>;
}

export interface ConstructorValidation {
  /** Семантические ошибки спека (коды i18n `error.spec.*`). */
  spec: SpecIssue[];
  /** Ошибки формы: имя, кости, пробная компиляция. */
  local: ConstructorIssue[];
}

/** Все кости записи, которые правятся в форме (урон/апкаст/кантрип). */
function diceExpressions(record: SpellDef): string[] {
  return [
    ...(record.damage?.dice ?? []),
    ...(record.upcast?.dice ? [record.upcast.dice] : []),
    ...(record.cantrip ?? []).flatMap((tier) => (tier.dice ? [tier.dice] : [])),
  ];
}

/**
 * Клиентская проверка записи: имя, кости, семантика спека (`validateSpec`)
 * и пробная компиляция (`automationForSpell` — ловит битые ссылки/данные).
 */
export function validateConstructor(record: SpellDef): ConstructorValidation {
  const local: ConstructorIssue[] = [];
  const name = record.name.trim();
  if (!name) local.push({ code: 'nameRequired' });
  else if (name.length > 80) local.push({ code: 'nameTooLong' });
  for (const expr of diceExpressions(record)) {
    try {
      parseDiceExpression(expr);
    } catch {
      local.push({ code: 'diceInvalid', params: { expr } });
    }
  }
  const spec = { ...structuredClone(record.automation), key: record.key, name: record.name } as AutomationSpec;
  const specIssues = validateSpec(spec);
  if (!specIssues.length && !local.length) {
    try {
      automationForSpell(record);
    } catch (err) {
      local.push({ code: 'compileFailed', params: { message: err instanceof Error ? err.message : String(err) } });
    }
  }
  return { spec: specIssues, local };
}
