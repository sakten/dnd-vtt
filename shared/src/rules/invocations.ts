import type { CharacterSheet } from '../domain/sheet';
import type { InvocationEntry, InvocationPact, InvocationPrereq } from '../domain/invocation';
import type { Sense } from '../domain/sense';
import { applyPatch } from './automation/compile';
import { spellRangeFeet } from './spellCast';
import type { Spell } from './spells';
import { PACT_OF_CHAIN_FORMS } from './summons';

/** Пакт-инвокации: ключи и требуемый уровень механики. */
export const INVOCATION_PACT_KEYS: Record<InvocationPact, string> = {
  blade: 'XPHB:Pact of the Blade',
  chain: 'XPHB:Pact of the Chain',
  tome: 'XPHB:Pact of the Tome',
};

/** Что движок умеет делать из инвокаций (остальное — текстом, вручную). */
export interface InvocationMechanics {
  /** Пассивное зрение (Devil's Sight). */
  sense?: Sense;
  /** Преимущество на спасброски концентрации (Eldritch Mind). */
  concentrationAdvantage?: boolean;
  /** Заклинание без ячейки (ключ каталога). */
  atWill?: string;
  /** At-will каст — действием, а не временем заклинания (Pact of the Chain: Find Familiar). */
  actionCast?: boolean;
  /** Пакт-инвокация (Blade/Chain/Tome). */
  pact?: InvocationPact;
  /** Патчи заклинаний по именованным путям (модификаторы Eldritch Blast). */
  patches?: Record<string, InvocationPatches>;
  /** Выбор 3 кантрипов + 2 ритуалов (Pact of the Tome). */
  tome?: boolean;
}

/** Патч инвокации: `automation.*` — деф, `meta.*` — поля заклинания (дальность). */
export interface InvocationPatches {
  automation?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export const INVOCATION_MECHANICS: Record<string, InvocationMechanics> = {
  "XPHB:Devil's Sight": { sense: { type: 'devilsight', range: 120 } },
  'XPHB:Eldritch Mind': { concentrationAdvantage: true },
  'XPHB:Pact of the Blade': { pact: 'blade' },
  // Pact of the Chain: Find Familiar без ячейки (XPHB) действием + особые формы в пикере.
  'XPHB:Pact of the Chain': { pact: 'chain', atWill: 'XPHB:Find Familiar', actionCast: true },
  'XPHB:Pact of the Tome': { pact: 'tome', tome: true },
  'XPHB:Agonizing Blast': { patches: { 'XPHB:Eldritch Blast': { automation: { 'damage.abilityMod': true } } } },
  'XPHB:Repelling Blast': {
    patches: {
      'XPHB:Eldritch Blast': { automation: { force: { kind: 'push', feet: 10, maxSize: 'large' } } },
    },
  },
  'XPHB:Eldritch Spear': {
    patches: { 'XPHB:Eldritch Blast': { meta: { 'range.distance.amount': 300 } } },
  },
  'XPHB:Armor of Shadows': { atWill: 'XPHB:Mage Armor' },
  'XPHB:Fiendish Vigor': { atWill: 'XPHB:False Life' },
  'XPHB:Mask of Many Faces': { atWill: 'XPHB:Disguise Self' },
  'XPHB:Misty Visions': { atWill: 'XPHB:Silent Image' },
  'XPHB:Otherworldly Leap': { atWill: 'XPHB:Jump' },
  'XPHB:One with Shadows': { atWill: 'XPHB:Invisibility' },
  'XPHB:Gift of the Depths': { atWill: 'XPHB:Water Breathing' },
  'XPHB:Ascendant Step': { atWill: 'XPHB:Levitate' },
  'XPHB:Master of Myriad Forms': { atWill: 'XPHB:Alter Self' },
  'XPHB:Whispers of the Grave': { atWill: 'XPHB:Speak with Dead' },
  'XPHB:Visions of Distant Realms': { atWill: 'XPHB:Arcane Eye' },
};

export function invocationMechanics(key: string): InvocationMechanics | undefined {
  return INVOCATION_MECHANICS[key];
}

/**
 * At-will заклинания, которые инвокация разрешает только на себя (XPHB):
 * Armor of Shadows (Mage Armor), Fiendish Vigor, Mask of Many Faces, Otherworldly Leap,
 * One with Shadows, Ascendant Step, Master of Myriad Forms.
 */
const AT_WILL_SELF_ONLY = new Set([
  'XPHB:Mage Armor',
  'XPHB:False Life',
  'XPHB:Disguise Self',
  'XPHB:Jump',
  'XPHB:Invisibility',
  'XPHB:Levitate',
  'XPHB:Alter Self',
]);

export function invocationAtWillSelfOnly(spellKey: string): boolean {
  return AT_WILL_SELF_ONLY.has(spellKey);
}

export function warlockLevelOf(sheet: Pick<CharacterSheet, 'classes'>): number {
  return sheet.classes.find((c) => c.className === 'warlock')?.level ?? 0;
}

/** Сколько инвокаций доступно на уровне варлока (таблица XPHB). */
export function invocationLimit(warlockLevel: number, limits: number[]): number {
  const level = Math.min(20, Math.max(1, Math.round(warlockLevel)));
  return warlockLevel > 0 ? limits[level - 1] ?? 0 : 0;
}

export type InvocationIssue = 'level' | 'pact' | 'requires' | 'cantrip';

export interface InvocationCheckContext {
  warlockLevel: number;
  /** Уже выбранные (включая проверяемую) ключи инвокаций. */
  chosen: Set<string>;
  /** Кантрипы персонажа: наносящие урон / с атакой — для Agonizing/Repelling/Spear. */
  cantrips: { key: string; damage: boolean; attack: boolean }[];
}

/** Нарушение предпосылок инвокации (undefined — можно брать). */
export function invocationIssue(inv: InvocationEntry, ctx: InvocationCheckContext): InvocationIssue | undefined {
  const req: InvocationPrereq | undefined = inv.prereq;
  if (ctx.warlockLevel < (req?.level ?? inv.level)) return 'level';
  if (!req) return undefined;
  if (req.pact && !ctx.chosen.has(INVOCATION_PACT_KEYS[req.pact])) return 'pact';
  if (req.requires && !ctx.chosen.has(req.requires)) return 'requires';
  if (req.cantrip) {
    const ok = ctx.cantrips.some((c) => (req.cantrip === 'spellAttack' ? c.attack : c.damage));
    if (!ok) return 'cantrip';
  }
  return undefined;
}

export function hasInvocation(sheet: Pick<CharacterSheet, 'invocations'>, key: string): boolean {
  return (sheet.invocations ?? []).includes(key);
}

/** Заклинания «по желанию» из выбранных инвокаций (ключи каталога). */
export function invocationAtWillSpells(sheet: Pick<CharacterSheet, 'invocations'>): string[] {
  const out: string[] = [];
  for (const key of sheet.invocations ?? []) {
    const spell = INVOCATION_MECHANICS[key]?.atWill;
    if (spell && !out.includes(spell)) out.push(spell);
  }
  return out;
}

/** Врождённые сенсы инвокаций (Devil's Sight). */
export function invocationSenses(sheet: Pick<CharacterSheet, 'invocations'>): Sense[] {
  const out: Sense[] = [];
  for (const key of sheet.invocations ?? []) {
    const sense = INVOCATION_MECHANICS[key]?.sense;
    if (sense && !out.some((s) => s.type === sense.type)) out.push(sense);
  }
  return out;
}

export function hasConcentrationAdvantage(sheet: Pick<CharacterSheet, 'invocations'>): boolean {
  return (sheet.invocations ?? []).some((key) => INVOCATION_MECHANICS[key]?.concentrationAdvantage === true);
}

/** Патчи выбранных инвокаций для заклинания (в порядке списка инвокаций персонажа). */
export function invocationPatches(spellKey: string, invocations?: string[]): InvocationPatches[] {
  const out: InvocationPatches[] = [];
  for (const key of invocations ?? []) {
    const patch = INVOCATION_MECHANICS[key]?.patches?.[spellKey];
    if (patch) out.push(patch);
  }
  return out;
}

/** Заклинание доступно персонажу без ячейки по инвокации. */
export function invocationCoversSpell(sheet: Pick<CharacterSheet, 'invocations'>, spellKey: string): boolean {
  return invocationAtWillSpells(sheet).includes(spellKey);
}

/** At-will заклинание кастуется действием, а не своим временем (Pact of the Chain: Find Familiar). */
export function invocationActionCast(sheet: Pick<CharacterSheet, 'invocations'>, spellKey: string): boolean {
  return (sheet.invocations ?? []).some((key) => {
    const mechanics = INVOCATION_MECHANICS[key];
    return mechanics?.actionCast === true && mechanics.atWill === spellKey;
  });
}

/** Дальность заклинания с учётом инвокаций (Eldritch Spear: патч `range.distance.amount`). */
export function effectiveSpellRangeFeet(spell: Pick<Spell, 'key' | 'range'>, invocations?: string[]): number | null {
  const meta = invocationPatches(spell.key, invocations).filter((p) => p.meta);
  if (!meta.length) return spellRangeFeet(spell as Spell);
  const copy = structuredClone(spell) as unknown as Record<string, unknown>;
  for (const patch of meta) applyPatch(copy, patch.meta!);
  return spellRangeFeet(copy as unknown as Spell);
}

/** Доступна ли форма фамильяра: обычные — всегда, особые Pact of the Chain — только с инвокацией. */
export function familiarFormAvailable(key: string, familiar: boolean | undefined, pactChain: boolean): boolean {
  return PACT_OF_CHAIN_FORMS.includes(key) ? pactChain : familiar === true;
}

/**
 * Есть ли у инвокации механический эффект в движке. Для «заклинание по желанию»
 * смотрим автоматизацию самого заклинания — иначе рисуем красный маркер.
 */
export function invocationAutomated(
  key: string,
  opts: { spellAutomated?: (spellKey: string) => boolean } = {}
): boolean {
  const mechanics = INVOCATION_MECHANICS[key];
  if (!mechanics) return false;
  if (mechanics.atWill) return opts.spellAutomated?.(mechanics.atWill) === true;
  return (
    mechanics.sense !== undefined ||
    mechanics.concentrationAdvantage === true ||
    mechanics.patches !== undefined ||
    mechanics.pact === 'chain'
  );
}
