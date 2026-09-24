import { describe, expect, it } from 'vitest';
import type { AttackEntry, CharacterSheet } from 'shared';
import { findSpell } from '../spells';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { resolveSpellCast, validateSpellCast, type SpellCastInput } from './spellResolve';

/** Сид Math.random на время колбэка (броски детерминированы). */
function withRandom(value: number, fn: () => void): void {
  const original = Math.random;
  Math.random = () => value;
  try {
    fn();
  } finally {
    Math.random = original;
  }
}

const SWORD: AttackEntry = {
  id: 'sword',
  name: 'Longsword',
  hit: 'd20+5',
  damage: '1d10+3',
  damageType: 'slashing',
  rangeType: 'melee',
  rangeNormal: 5,
  rangeLong: 0,
  weaponKey: 'XPHB:Longsword',
};

const BOW: AttackEntry = {
  id: 'bow',
  name: 'Shortbow',
  hit: 'd20+5',
  damage: '1d6+3',
  damageType: 'piercing',
  rangeType: 'ranged',
  rangeNormal: 80,
  rangeLong: 320,
  weaponKey: 'XPHB:Shortbow',
};

function setup(opts: { hands?: CharacterSheet['hands']; attacks?: AttackEntry[]; level?: number; secondary?: boolean; targetAc?: string; big?: boolean } = {}) {
  const attacker = makeToken('t1', { libraryItemId: 'lib1', isPlayerToken: true, faction: 'ally', x: opts.big ? 175 : 50, y: opts.big ? 75 : 75 });
  const primary = makeToken('t2', {
    faction: 'enemy',
    x: opts.big ? 275 : 100,
    y: opts.big ? 75 : 100,
    ...(opts.big ? { cells: 3, w: 150, h: 150 } : {}),
    ac: opts.targetAc ?? '10',
    hpMax: '40',
    hpCurrent: 40,
  });
  const tokens = [attacker, primary];
  if (opts.secondary) {
    tokens.push(
      makeToken('t3', {
        faction: 'enemy',
        x: opts.big ? 425 : 150,
        y: opts.big ? 75 : 100,
        ...(opts.big ? { cells: 3, w: 150, h: 150 } : {}),
        ac: '10',
        hpMax: '40',
        hpCurrent: 40,
      })
    );
  }
  const room = makeCombatRoom(tokens, { p1: 'lib1' });
  const level = opts.level ?? 5;
  room.sheets['p1'] = {
    name: 'Маг',
    abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
    proficiencyBonus: '3',
    classes: [{ className: 'wizard', level }],
    attacks: opts.attacks ?? [SWORD],
    hands: opts.hands ?? { right: 'sword' },
    spells: [{ key: 'TCE:Green-Flame Blade', className: 'wizard' }],
    saves: {},
    skills: {},
    damageDefenses: [],
    senses: [],
    hpMax: '30',
    ac: '16',
    speed: 30,
  } as unknown as CharacterSheet;
  const f = makeConnCtx(room, { playerId: 'p1', dm: true, all: true });
  const input: SpellCastInput = {
    caster: attacker,
    mapId: 'm1',
    spell: findSpell('TCE:Green-Flame Blade')!,
    castLevel: 0,
    characterLevel: level,
    stats: { ability: 'int', mod: 3, dc: 13, attack: 5 },
    targets: [primary],
    author: 'Маг',
  };
  return { attacker, primary, secondary: tokens[2], room, f, input };
}

describe('Green-Flame Blade через каст', () => {
  it('5 уровень: оружие + 1к8 огнём, вторичная цель — ближайший враг (мод + 1к8)', () => {
    const { primary, secondary, f, input } = setup({ secondary: true });
    withRandom(0.5, () => resolveSpellCast(f.ctx, input));
    // 1d10+3 (6+3) + 1d8fire (5) = 14; вторично 3 + 1d8 (5) = 8.
    expect(primary.hpCurrent).toBe(26);
    expect(secondary!.hpCurrent).toBe(32);
    // В чат: системное сообщение и ролл вторичного урона.
    const messages = f.emitted.filter((e) => e.event === 'chat:message').map((e) => e.payload as Record<string, unknown>);
    expect(
      messages.some(
        (m) => (m.system as { code?: string } | undefined)?.code === 'automation.greenFlame'
      )
    ).toBe(true);
    expect(
      messages.some(
        (m) => (m.labelParams as { subject?: string } | undefined)?.subject === 'Green-Flame Blade · t3'
      )
    ).toBe(true);
  });

  it('1 уровень: без костей — только урон оружия и мод вторично', () => {
    const { primary, secondary, f, input } = setup({ secondary: true, level: 1 });
    withRandom(0.5, () => resolveSpellCast(f.ctx, input));
    expect(primary.hpCurrent).toBe(31); // 40 - (6+3)
    expect(secondary!.hpCurrent).toBe(37); // 40 - 3
  });

  it('универсальное при занятой левой: одноручная кость', () => {
    const { primary, f, input } = setup({ hands: { right: 'sword', left: 'shield' } });
    withRandom(0.5, () => resolveSpellCast(f.ctx, input));
    expect(primary.hpCurrent).toBe(27); // 1d8+3 (5+3) + 1d8 (5) = 13
  });

  it('промах: ни урона, ни вторичной цели', () => {
    const { primary, secondary, f, input } = setup({ secondary: true, targetAc: '30' });
    withRandom(0.5, () => resolveSpellCast(f.ctx, input));
    expect(primary.hpCurrent).toBe(40);
    expect(secondary!.hpCurrent).toBe(40);
  });

  it('нет вторичной цели — каст не падает', () => {
    const { primary, f, input } = setup({});
    withRandom(0.5, () => resolveSpellCast(f.ctx, input));
    expect(primary.hpCurrent).toBe(26);
  });

  it('большие токены 3×3 вплотную: сосед получает вторичный урон', () => {
    const { primary, secondary, f, input } = setup({ secondary: true, big: true });
    withRandom(0.5, () => resolveSpellCast(f.ctx, input));
    expect(primary.hpCurrent).toBe(26);
    expect(secondary!.hpCurrent).toBe(32);
  });

  it('валидация: без оружия в правой руке — noHeldWeapon', () => {
    const { room, input } = setup({ hands: {} });
    expect(validateSpellCast(room, input)).toEqual({ code: 'noHeldWeapon' });
  });

  it('валидация: щит в правой и дальнее оружие — noHeldWeapon', () => {
    const shield = setup({ hands: { right: 'shield' } });
    expect(validateSpellCast(shield.room, shield.input)).toEqual({ code: 'noHeldWeapon' });
    const bow = setup({ hands: { right: 'bow' }, attacks: [BOW] });
    expect(validateSpellCast(bow.room, bow.input)).toEqual({ code: 'noHeldWeapon' });
  });

  it('валидация: цель вне досягаемости оружия — outOfRange', () => {
    const { room, input, primary } = setup({});
    primary.x = 250; // 20 фт от кастера
    expect(validateSpellCast(room, input)?.code).toBe('outOfRange');
  });
});
