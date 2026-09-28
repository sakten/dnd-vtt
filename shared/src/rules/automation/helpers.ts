import type { AutomationEffect, AutomationSave, GrantedAction, ZoneDef } from '../../domain/automation';
import type { Spell } from '../spells';
import { PERMANENT } from './header';

/**
 * Вспомогательное автоматизации: хелперы костей (сумма/апкаст), каталог составного
 * урона для тултипов (`COMPOSITE_CONFIGS`) и выданное действие Shadow Blade.
 * Билдеры заклинаний мигрированы в спеки (R16, `specs/`).
 */

/**
 * Shadow Blade: выданное действие «Вернуть клинок» (живёт в эффекте всегда;
 * клиент показывает его, только пока клинок брошен — `shadowBlade.inHand`).
 */
export function shadowBladeReturnAction(): GrantedAction {
  return {
    id: 'return',
    name: 'Вернуть клинок',
    cost: 'bonus',
    def: {
      key: 'XGE:Shadow Blade:return',
      name: 'Вернуть клинок',
      resolution: 'utility',
      utility: { kind: 'recallWeapon' },
    },
  };
}

/** Складывает базовую кость с однотипными костями апкаста: `'1d8'` + `'1d8 + 1d8'` → `'3d8'`. */
export function addDiceExpression(base: string, extra: string | undefined): string {
  if (!extra) return base;
  const m = base.match(/^(\d*)d(\d+)$/);
  if (!m) return `${base} + ${extra}`;
  const terms = extra
    .split('+')
    .map((term) => term.trim())
    .filter(Boolean);
  if (!terms.length || terms.some((term) => !new RegExp(`^\\d*d${m[2]}$`).test(term))) return `${base} + ${extra}`;
  return `${Number(m[1] || 1) + terms.length}d${m[2]}`;
}

/** Часть составного урона: кость и тип (Flame Strike: 5d6 огнём + 5d6 излучением). */
export interface CompositePart {
  dice: string;
  type: string;
}

/** Составной урон одним броском: части, апкаст, выбор типа, спас и эффекты при провале. */
export interface CompositeConfig {
  parts: CompositePart[];
  /** Какие части растут апкастом: `all` — обе (Flame Strike), `first` — только первая (Ice Storm). */
  upcast?: 'all' | 'first';
  /** Индекс части, тип которой выбирается при касте (Destructive Wave: изл./некр.). */
  variantPart?: number;
  save: AutomationSave;
  /** Эффекты при провале спаса (Destructive Wave: ничком). */
  onFail?: Omit<AutomationEffect, 'name'>[];
  /** Зона после каста (Ice Storm: град — труднопроходимость до конца следующего хода). */
  zone?: ZoneDef;
}

export const COMPOSITE_CONFIGS: Record<string, CompositeConfig> = {
  'XPHB:Flame Strike': {
    parts: [
      { dice: '5d6', type: 'fire' },
      { dice: '5d6', type: 'radiant' },
    ],
    upcast: 'all',
    save: { ability: 'dex', half: true },
  },
  'XPHB:Ice Storm': {
    parts: [
      { dice: '2d10', type: 'bludgeoning' },
      { dice: '4d6', type: 'cold' },
    ],
    upcast: 'first',
    save: { ability: 'dex', half: true },
    // Град: труднопроходимость «до конца вашего следующего хода» — круги тикают
    // в начале хода источника, поэтому два.
    zone: {
      area: { shape: 'sphere', size: 20 },
      origin: 'point',
      duration: { type: 'rounds', rounds: 2 },
      flags: { difficultTerrain: true },
    },
  },
  'XPHB:Destructive Wave': {
    parts: [
      { dice: '5d6', type: 'thunder' },
      { dice: '5d6', type: 'radiant' },
    ],
    variantPart: 1,
    save: { ability: 'con', half: true },
    onFail: [{ duration: PERMANENT, to: 'targets', modifiers: [], conditions: ['prone'] }],
  },
};

/** Число шагов апкаста выше базового круга (`upcast.above/every`); 0 — не растёт. */
export function upcastSteps(spell: Spell, castLevel: number): number {
  const up = spell.upcast;
  if (!up?.dice || up.above === undefined || castLevel <= up.above) return 0;
  return Math.floor((castLevel - up.above) / Math.max(1, up.every ?? 1));
}

/** Кость части со скейлом: `base` + `steps` × `extra` (одинаковые кости суммируются). */
export function scaledDice(base: string, extra: string | undefined, steps: number): string {
  let out = base;
  for (let i = 0; i < steps && extra; i++) out = addDice(out, extra);
  return out;
}

/** Сумма костей одного вида: `1d8` + `1d8` → `2d8` (иначе обычное сложение). */
export function addDice(expr: string | undefined, extra: string): string {
  if (!expr) return extra;
  const a = expr.match(/^(\d*)d(\d+)$/);
  const b = extra.match(/^(\d*)d(\d+)$/);
  if (a && b && a[2] === b[2]) return `${Number(a[1] || 1) + Number(b[1] || 1)}d${a[2]}`;
  return `${expr} + ${extra}`;
}
