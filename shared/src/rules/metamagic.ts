import type { AutomationDef } from '../domain/automation';
import type { FeatureChoice } from '../domain/feature';
import type { ClassLevel } from '../domain/sheet';
import { clampLevel } from './classes';
import { effectiveSpellRangeFeet } from './invocations';
import type { Spell } from './spells';

/** Метамагия чародея (XPHB): выбор 2/4/6 опций, применение при касте за очки чародейства. */
export const CAREFUL_SPELL_KEY = 'XPHB:Careful Spell';
export const DISTANT_SPELL_KEY = 'XPHB:Distant Spell';
export const EMPOWERED_SPELL_KEY = 'XPHB:Empowered Spell';
export const EXTENDED_SPELL_KEY = 'XPHB:Extended Spell';
export const HEIGHTENED_SPELL_KEY = 'XPHB:Heightened Spell';
export const QUICKENED_SPELL_KEY = 'XPHB:Quickened Spell';
export const SEEKING_SPELL_KEY = 'XPHB:Seeking Spell';
export const SUBTLE_SPELL_KEY = 'XPHB:Subtle Spell';
export const TRANSMUTED_SPELL_KEY = 'XPHB:Transmuted Spell';
export const TWINNED_SPELL_KEY = 'XPHB:Twinned Spell';

export const TRANSMUTABLE_DAMAGE_TYPES = ['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder'] as const;

export interface MetamagicCast {
  key: string;
  /** Transmuted Spell: новый тип урона. */
  damageType?: string;
  /** Seeking Spell: переброс промаха (можно вместе с другой опцией). */
  seeking?: boolean;
  /** Careful Spell: существа, автоматически проходящие спасбросок. */
  careful?: string[];
}

export interface MetamagicDef {
  key: string;
  name: string;
  nameEn: string;
  cost: number;
  /** Механика автоматизирована; иначе эффект ведёт игрок/мастер вручную. */
  automated: boolean;
  description: string;
}

export const METAMAGIC_OPTIONS: MetamagicDef[] = [
  {
    key: CAREFUL_SPELL_KEY,
    name: 'Осторожное заклинание',
    nameEn: 'Careful Spell',
    cost: 1,
    automated: true,
    description:
      'Существа до мод. Харизмы (минимум одно) автоматически проходят спасбросок против заклинания и не получают урон при успехе.',
  },
  {
    key: DISTANT_SPELL_KEY,
    name: 'Далёкое заклинание',
    nameEn: 'Distant Spell',
    cost: 1,
    automated: true,
    description: 'Дистанция удваивается; заклинание с дистанцией касание получает дистанцию 30 фт.',
  },
  {
    key: EMPOWERED_SPELL_KEY,
    name: 'Усиленное заклинание',
    nameEn: 'Empowered Spell',
    cost: 1,
    automated: false,
    description: 'Перебросить до мод. Харизмы (минимум одну) костей урона заклинания, новые значения обязательны.',
  },
  {
    key: EXTENDED_SPELL_KEY,
    name: 'Продлённое заклинание',
    nameEn: 'Extended Spell',
    cost: 1,
    automated: true,
    description: 'Удвоить длительность заклинания (1 минута и больше), но не более 24 часов.',
  },
  {
    key: HEIGHTENED_SPELL_KEY,
    name: 'Обострённое заклинание',
    nameEn: 'Heightened Spell',
    cost: 2,
    automated: true,
    description: 'Одна цель совершает спасброски против заклинания с помехой.',
  },
  {
    key: QUICKENED_SPELL_KEY,
    name: 'Ускоренное заклинание',
    nameEn: 'Quickened Spell',
    cost: 2,
    automated: true,
    description: 'Заклинание с временем накладывания «действие» накладывается бонусным действием.',
  },
  {
    key: SEEKING_SPELL_KEY,
    name: 'Наводящееся заклинание',
    nameEn: 'Seeking Spell',
    cost: 1,
    automated: true,
    description: 'При промахе заклинательной атакой перебросить d20; новый результат обязателен.',
  },
  {
    key: SUBTLE_SPELL_KEY,
    name: 'Незаметное заклинание',
    nameEn: 'Subtle Spell',
    cost: 1,
    automated: true,
    description: 'Накладывается без вербальных, соматических и материальных компонентов (кроме расходуемых и стоящих золота).',
  },
  {
    key: TRANSMUTED_SPELL_KEY,
    name: 'Преобразованное заклинание',
    nameEn: 'Transmuted Spell',
    cost: 1,
    automated: true,
    description: 'Сменить тип урона среди кислоты, холода, огня, электричества, яда и звука на другой из этого списка.',
  },
  {
    key: TWINNED_SPELL_KEY,
    name: 'Сдвоенное заклинание',
    nameEn: 'Twinned Spell',
    cost: 1,
    automated: true,
    description: 'Заклинание, которое за большую ячейку получает доп. цель, накладывается с эффективным уровнем на 1 выше.',
  },
];

const byKey = new Map(METAMAGIC_OPTIONS.map((option) => [option.key, option]));

export function metamagicDef(key: string): MetamagicDef | undefined {
  return byKey.get(key);
}

/** Сколько опций метамагии известно: 2 на 2 ур., 4 на 10, 6 на 17. */
export function metamagicLimit(classes: ClassLevel[]): number {
  const level = clampLevel(classes.find((c) => c.className === 'sorcerer')?.level ?? 0);
  if (level < 2) return 0;
  if (level >= 17) return 6;
  if (level >= 10) return 4;
  return 2;
}

/** Выбранные опции метамагии листа. */
export function knownMetamagic(choices?: readonly FeatureChoice[]): string[] {
  return (choices ?? [])
    .filter((choice) => choice.kind === 'metamagic' && !!byKey.has(choice.key))
    .map((choice) => choice.key);
}

/** Дистанция с учётом Далёкого заклинания. */
export function metamagicRangeFeet(
  spell: Spell,
  invocations: string[] | undefined,
  metamagicKey: string | undefined
): number | null {
  const base = effectiveSpellRangeFeet(spell, invocations);
  if (metamagicKey !== DISTANT_SPELL_KEY || base === null) return base;
  if (spell.range.distance?.type === 'touch') return 30;
  return base >= 5 ? base * 2 : base;
}

/** Продлённое заклинание применимо: длительность 1 минута и больше. */
export function extendedSpellEligible(spell: Spell): boolean {
  const timed = spell.duration.find((duration) => duration.type === 'timed');
  const amount = timed?.duration?.amount ?? 0;
  const unit = timed?.duration?.type;
  return unit === 'hour' || unit === 'day' || (unit === 'minute' && amount >= 1);
}

/** Сдвоенное заклинание (2024) применимо: апкаст добавляет цели. */
export function twinnedSpellEligible(spell: Spell): boolean {
  return !!spell.upcast?.targets;
}

/** Продлённое заклинание: ×2 длительности (до 24 ч) и преимущество на концентрацию. */
export function extendAutomation(def: AutomationDef): AutomationDef {
  const clone = structuredClone(def);
  const cap = 14_400;
  const double = <T extends { type: string; rounds?: number }>(duration: T): T =>
    duration.type === 'rounds'
      ? { ...duration, rounds: Math.min(cap, Math.max(1, duration.rounds ?? 1) * 2) }
      : duration;
  if (typeof clone.maxRounds === 'number') clone.maxRounds = Math.min(cap, clone.maxRounds * 2);
  if (clone.zone) clone.zone.duration = double(clone.zone.duration);
  if (clone.summon) clone.summon.duration = double(clone.summon.duration);
  for (const effect of clone.effects ?? []) {
    effect.duration = double(effect.duration);
  }
  clone.concentrationAdvantage = true;
  return clone;
}

const TRANSMUTABLE_SET = new Set<string>(TRANSMUTABLE_DAMAGE_TYPES);

function retypeDice(expr: string, type: string): string {
  let out = expr;
  for (const old of TRANSMUTABLE_DAMAGE_TYPES) {
    if (old === type) continue;
    out = out.replace(new RegExp(`(\\d*d\\d+|\\d+)\\s*${old}\\b`, 'gi'), `$1${type}`);
  }
  return out;
}

/** Преобразованное заклинание: заменить все типы урона из списка на выбранный. */
export function transmuteAutomation(def: AutomationDef, type: string): AutomationDef {
  const clone = structuredClone(def);
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.types)) {
      record.types = record.types.map((item) =>
        typeof item === 'string' && TRANSMUTABLE_SET.has(item) ? type : item
      );
    }
    if (typeof record.damageType === 'string' && TRANSMUTABLE_SET.has(record.damageType)) {
      record.damageType = type;
    }
    if (typeof record.dice === 'string') record.dice = retypeDice(record.dice, type);
    if (typeof record.riderDice === 'string') record.riderDice = retypeDice(record.riderDice, type);
    for (const item of Object.values(record)) walk(item);
  };
  walk(clone);
  return clone;
}
