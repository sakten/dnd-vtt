import {
  CUSTOM_SPELL_PREFIX,
  automationForSpell,
  generatedAutomation,
  parseDiceExpression,
  validateSpec,
  type AbilityKey,
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
    range: { type: 'point', distance: { type: 'feet', amount: 60 } },
    components: { v: true, s: true },
    duration: [{ type: 'instant' }],
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

/** I18n-ключ слота срабатывания части урона по пути ссылки `{ref:'part'}` в автоматизации. */
function partUsageKey(path: string[]): string | undefined {
  const TRIGGER_SLOTS = new Set(['startOfTurn', 'endOfTurn', 'enter', 'exit']);
  const trigger = path.indexOf('triggers');
  if (trigger >= 0) {
    const slot = path[trigger + 1];
    return slot && TRIGGER_SLOTS.has(slot) ? `ui.constructor.usage.${slot}` : 'ui.constructor.usage.zoneTrigger';
  }
  if (path.includes('onCreate')) return 'ui.constructor.usage.onCreate';
  if (path.includes('aura')) return 'ui.constructor.usage.aura';
  if (path.includes('successDamage')) return 'ui.constructor.usage.onSuccess';
  if (path.includes('damage')) return 'ui.constructor.usage.onCast';
  if (path.includes('heal')) return 'ui.constructor.usage.heal';
  return undefined;
}

/**
 * Когда срабатывает каждая часть урона карточки: сканирует автоматизацию на ссылки
 * `{ref:'part'}` и сопоставляет индексу части i18n-ключ слота (Hunger of Hadar:
 * холод — начало хода, кислота — конец хода). Ссылки без индекса (`role`) относят
 * слот ко всем частям этой роли.
 */
export function partUsageKeys(record: SpellDef): Record<number, string[]> {
  const parts = record.damage?.parts ?? [];
  const found = new Map<number, Set<string>>();
  const add = (index: number, key: string) => {
    const set = found.get(index) ?? new Set<string>();
    set.add(key);
    found.set(index, set);
  };
  const walk = (node: unknown, path: string[]) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, path);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (obj.ref === 'part') {
      const key = partUsageKey(path);
      if (key) {
        if (typeof obj.index === 'number') add(obj.index, key);
        else if (typeof obj.part === 'string') {
          parts.forEach((part, index) => {
            if (part.role === obj.part) add(index, key);
          });
        }
      }
    }
    for (const [key, value] of Object.entries(obj)) walk(value, [...path, key]);
  };
  walk(record.automation, []);
  const out: Record<number, string[]> = {};
  for (const [index, keys] of found) out[index] = [...keys];
  return out;
}

export type SimpleBranch = 'attack' | 'save' | 'auto' | 'effect';

/** Ветки, между которыми безопасно переключаться формой (без zone/призывов/форм/оружия). */
const SIMPLE_BRANCHES: SimpleBranch[] = ['attack', 'save', 'auto', 'effect'];

/** Можно ли менять ведущую ветку: автоматизация не содержит сложных блоков. */
export function canSwitchPrimary(record: SpellDef): boolean {
  const a = record.automation;
  if (a.zone || a.summon || a.shape || a.weaponAttack || a.manual || a.utility || a.choices?.length) return false;
  return SIMPLE_BRANCHES.includes(a.primary as SimpleBranch);
}

/**
 * Переключение ведущей ветки простой записи: payload (damage/heal/effects)
 * сохраняется, меняются только ветко-специфичные поля. Для сложных записей
 * форма ветку не трогает (`canSwitchPrimary`).
 */
export function switchPrimary(record: SpellDef, primary: SimpleBranch): SpellDef {
  if (!canSwitchPrimary(record)) return record;
  const automation = structuredClone(record.automation);
  delete automation.save;
  delete automation.attack;
  if (primary === 'attack') {
    automation.attack = { rangeType: record.spellAttack ?? 'ranged' };
    automation.count ??= { ref: 'spellAttackCount' };
  } else if (primary === 'save') {
    automation.save = { ability: record.save?.[0] ?? 'dex', ...(record.saveHalf ? { half: true } : {}) };
  } else if (primary === 'effect' && !automation.effects?.length) {
    automation.effects = [{ id: 'effect', name: record.name, duration: { type: 'permanent' }, to: 'targets', modifiers: [] }];
  }
  automation.primary = primary;
  return { ...record, automation };
}

/** Смена характеристики атаки заклинанием: мета + `attack.rangeType` записи (если атака в ней есть). */
export function withSpellAttack(record: SpellDef, value: Spell['spellAttack']): SpellDef {
  const next: SpellDef = { ...record, spellAttack: value };
  const attack = record.automation.attack;
  if (value && attack && !record.automation.weaponAttack) {
    next.automation = { ...record.automation, attack: { ...attack, rangeType: value } };
  }
  return next;
}

/** Смена спасброска: мета + `save` записи (характеристика/половина); пусто — блок убирается. */
export function withSave(record: SpellDef, ability: AbilityKey | undefined, half: boolean): SpellDef {
  const next: SpellDef = {
    ...record,
    save: ability ? [ability] : undefined,
    saveHalf: ability && half ? true : undefined,
  };
  const automation = { ...record.automation };
  if (ability) {
    const save = { ...(automation.save ?? { ability }) };
    save.ability = ability;
    if (half) save.half = true;
    else delete save.half;
    automation.save = save;
  } else {
    delete automation.save;
  }
  next.automation = automation;
  return next;
}

export type ConstructorIssueCode = 'nameRequired' | 'nameTooLong' | 'diceInvalid' | 'compileFailed';
/** Локальная ошибка конструктора (мета/кости), вне `validateSpec`. */export interface ConstructorIssue {
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
