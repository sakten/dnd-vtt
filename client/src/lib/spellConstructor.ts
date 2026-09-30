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

export type WizardProfileId = 'attack' | 'save' | 'heal' | 'buff' | 'control' | 'summon' | 'utility';

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
  { id: 'summon', labelKey: 'ui.constructor.profile.summon', hintKey: 'ui.constructor.profile.summonHint' },
  { id: 'utility', labelKey: 'ui.constructor.profile.utility', hintKey: 'ui.constructor.profile.utilityHint' },
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
    case 'summon':
      return { ...spell, automation: { primary: 'summon', summon: { initiative: 'afterCaster' } } };
    case 'utility':
      return { ...spell, automation: { primary: 'utility', utility: { kind: 'tempHp', dice: '1d4 + 4' } } };
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

/** Слот использования части урона: i18n-ключ, спасбросок payload и признак триггера. */
export interface PartUsage {
  /** I18n-ключ слота (`ui.constructor.usage.*`). */
  key: string;
  /** Спасбросок payload слота (Hunger of Hadar: кислота — DEX). */
  save?: AbilityKey;
  /** Слот из `triggers` зоны/эффекта — для подписи «без спасброска». */
  trigger?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const saveAbilityOf = (payload: unknown): AbilityKey | undefined => {
  if (!isRecord(payload) || !isRecord(payload.save)) return undefined;
  const ability = payload.save.ability;
  return typeof ability === 'string' ? (ability as AbilityKey) : undefined;
};

/**
 * Когда срабатывает каждая часть урона карточки: сканирует автоматизацию на ссылки
 * `{ref:'part'}` и сопоставляет индексу части слот + спасбросок payload (Hunger of
 * Hadar: холод — начало хода без сейва, кислота — конец хода со спасом DEX).
 * Ссылки без индекса (`role`) относят слот ко всем частям этой роли.
 */
export function partUsageKeys(record: SpellDef): Record<number, PartUsage[]> {
  const parts = record.damage?.parts ?? [];
  const found = new Map<number, PartUsage[]>();
  const add = (index: number, usage: PartUsage) => {
    const list = found.get(index) ?? [];
    if (!list.some((u) => u.key === usage.key && u.save === usage.save && u.trigger === usage.trigger)) {
      list.push(usage);
    }
    found.set(index, list);
  };
  const walk = (node: unknown, path: string[], payload?: Record<string, unknown>) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, path, payload);
      return;
    }
    const obj = node as Record<string, unknown>;
    // Payload-объект триггера: `{ save, damage }` — спас относится к вложенным костям.
    const nextPayload = 'damage' in obj || 'save' in obj ? obj : payload;
    if (obj.ref === 'part') {
      const key = partUsageKey(path);
      if (key) {
        const save = saveAbilityOf(nextPayload);
        const usage: PartUsage = {
          key,
          ...(save ? { save } : {}),
          ...(path.includes('triggers') ? { trigger: true } : {}),
        };
        if (typeof obj.index === 'number') add(obj.index, usage);
        else if (typeof obj.part === 'string') {
          parts.forEach((part, index) => {
            if (part.role === obj.part) add(index, usage);
          });
        }
      }
    }
    for (const [key, value] of Object.entries(obj)) walk(value, [...path, key], nextPayload);
  };
  walk(record.automation, []);
  return Object.fromEntries(found);
}

/** Read-only заметка о блоках автоматизации, которые форма пока не редактирует. */
export interface AutomationNote {
  kind: 'zone' | 'zoneTrigger' | 'auraEffect' | 'effectTriggers' | 'choice' | 'weaponAttack' | 'uses' | 'movement' | 'loadout';
  slot?: string;
  ability?: AbilityKey;
  types?: string[];
  name?: string;
  param?: string;
  options?: string[];
  shape?: string;
  size?: number;
  duration?: string;
  flags?: string[];
  conditions?: string[];
}

const damageTypesOf = (damage: unknown): string[] => {
  if (!isRecord(damage)) return [];
  if (Array.isArray(damage.parts)) {
    const out = new Set<string>();
    for (const part of damage.parts) {
      if (!isRecord(part)) continue;
      if (typeof part.type === 'string') out.add(part.type);
      if (Array.isArray(part.types)) for (const type of part.types) if (typeof type === 'string') out.add(type);
    }
    return [...out];
  }
  return Array.isArray(damage.types) ? damage.types.filter((type): type is string => typeof type === 'string') : [];
};

/** Сводка сложной автоматизации записи (зоны, триггеры, ауры, выборы) для формы. */
export function automationNotes(record: SpellDef): AutomationNote[] {
  const notes: AutomationNote[] = [];
  const automation = record.automation;
  const zone = automation.zone;
  if (zone) {
    const area = !zone.area ? undefined : 'shape' in zone.area ? zone.area : undefined;
    const duration = isRecord(zone.duration) && typeof zone.duration.type === 'string' ? zone.duration.type : undefined;
    notes.push({
      kind: 'zone',
      ...(area ? { shape: area.shape, size: area.size } : {}),
      ...(duration ? { duration } : {}),
      flags: Object.entries(zone.flags ?? {})
        .filter(([, value]) => value === true)
        .map(([key]) => key),
    });
    for (const [slot, payload] of Object.entries(zone.triggers ?? {})) {
      if (!payload) continue;
      notes.push({
        kind: 'zoneTrigger',
        slot,
        ...(saveAbilityOf(payload) ? { ability: saveAbilityOf(payload) } : {}),
        types: damageTypesOf(payload.damage),
      });
    }
    for (const effect of zone.aura?.effects ?? []) {
      notes.push({
        kind: 'auraEffect',
        name: effect.name,
        conditions: (effect.conditions ?? []).filter((c): c is string => typeof c === 'string'),
      });
    }
  }
  for (const effect of automation.effects ?? []) {
    if (effect.triggers && Object.keys(effect.triggers).length) {
      notes.push({ kind: 'effectTriggers', name: effect.name });
    }
    if (effect.loadout) notes.push({ kind: 'loadout' });
    if (effect.uses) notes.push({ kind: 'uses' });
  }
  for (const choice of automation.choices ?? []) {
    notes.push({ kind: 'choice', name: choice.id, param: choice.param, options: [...choice.options] });
  }
  if (automation.weaponAttack) notes.push({ kind: 'weaponAttack' });
  if (automation.movement) notes.push({ kind: 'movement' });
  return notes;
}

export type ConstructorIssueCode =
  | 'nameRequired'
  | 'nameTooLong'
  | 'diceInvalid'
  | 'compileFailed'
  | 'summonFormRequired';
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
  const summon = record.automation.summon;
  if (record.automation.primary === 'summon' && summon && !summon.creature && !summon.fromFamiliar) {
    local.push({ code: 'summonFormRequired' });
  }
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
