import { describe, expect, it } from 'vitest';
import type { AttackEntry, CharacterSheet, DamageDefense } from 'shared';
import { findSpell } from '../spells';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { resolveWeaponAttack } from './attackResolve';
import { resolveSpellCast, validateSpellCast, type SpellCastInput } from './spellResolve';
import { handleWillingMoveEffects } from './willingMove';

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

describe('Booming Blade, True Strike и Zephyr Strike', () => {
  function setupSpell(
    key: string,
    opts: { hands?: CharacterSheet['hands']; attacks?: AttackEntry[]; level?: number; targetAc?: string } = {}
  ) {
    const attacker = makeToken('t1', { libraryItemId: 'lib1', isPlayerToken: true, faction: 'ally', x: 50, y: 75 });
    const primary = makeToken('t2', {
      faction: 'enemy',
      x: 100,
      y: 100,
      ac: opts.targetAc ?? '10',
      hpMax: '40',
      hpCurrent: 40,
    });
    const room = makeCombatRoom([attacker, primary], { p1: 'lib1' });
    const level = opts.level ?? 5;
    room.sheets['p1'] = {
      name: 'Маг',
      abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
      proficiencyBonus: '3',
      classes: [{ className: 'wizard', level }],
      attacks: opts.attacks ?? [SWORD],
      hands: opts.hands ?? { right: 'sword' },
      spells: [{ key, className: 'wizard' }],
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
      spell: findSpell(key)!,
      castLevel: 0,
      characterLevel: level,
      stats: { ability: 'int', mod: 3, dc: 13, attack: 5 },
      targets: [primary],
      author: 'Маг',
    };
    return { attacker, primary, room, f, input };
  }

  it('Booming Blade: райдер звуком и эффект движения', () => {
    const { primary, f, input } = setupSpell('TCE:Booming Blade');
    withRandom(0.5, () => resolveSpellCast(f.ctx, input));
    expect(primary.hpCurrent).toBe(26); // 40 − (1d10+3 = 9) − (1d8 звуком = 5)
    const effect = primary.effects.find((e) => e.sourceKey === 'TCE:Booming Blade');
    expect(effect?.onWillingMove).toEqual({ dice: '2d8', damageType: 'thunder', feet: 5 });
  });

  it('Booming Blade: добровольное движение 5 фт — 2d8 звуком и конец эффекта', () => {
    const { primary, f, room, input } = setupSpell('TCE:Booming Blade');
    withRandom(0.5, () => resolveSpellCast(f.ctx, input));
    const fromX = primary.x;
    const fromY = primary.y;
    primary.x += 50;
    withRandom(0.5, () => handleWillingMoveEffects(f.ctx, room, 'm1', primary, fromX, fromY));
    expect(primary.hpCurrent).toBe(16); // 26 − (2d8 = 10)
    expect(primary.effects.some((e) => e.sourceKey === 'TCE:Booming Blade')).toBe(false);
  });

  it('Booming Blade: смещение меньше 5 фт не срабатывает', () => {
    const { primary, f, room, input } = setupSpell('TCE:Booming Blade');
    withRandom(0.5, () => resolveSpellCast(f.ctx, input));
    const fromX = primary.x;
    const fromY = primary.y;
    primary.x += 20;
    withRandom(0.5, () => handleWillingMoveEffects(f.ctx, room, 'm1', primary, fromX, fromY));
    expect(primary.hpCurrent).toBe(26);
    expect(primary.effects.some((e) => e.sourceKey === 'TCE:Booming Blade')).toBe(true);
  });

  it('True Strike: атака от заклинательной характеристики и выбор типа урона', () => {
    const attack: AttackEntry = { ...SWORD, hit: 'd20+str', damage: '1d10+str' };
    const slashingResist: DamageDefense = { id: 'd1', type: 'resistance', damageType: 'slashing' };

    // Вариант «излучение»: базовый урон не режется сопротивлением к рубящему.
    const radiant = setupSpell('XPHB:True Strike', { attacks: [attack], targetAc: '12' });
    radiant.primary.damageDefenses = [slashingResist];
    withRandom(0.5, () => resolveSpellCast(radiant.f.ctx, { ...radiant.input, variant: 'radiant' }));
    expect(radiant.primary.hpCurrent).toBe(27); // d20 11 + Инт 3 = 14 ≥ 12; (1d10+3 = 9) + (1d6 = 4)

    // Вариант «как у оружия»: рубящее сопротивление режет базовую часть (STR 10 не попал бы: 11 < 12).
    const weapon = setupSpell('XPHB:True Strike', { attacks: [attack], targetAc: '12' });
    weapon.primary.damageDefenses = [slashingResist];
    withRandom(0.5, () => resolveSpellCast(weapon.f.ctx, weapon.input));
    expect(weapon.primary.hpCurrent).toBe(32); // 9 рубящего → 4 после сопротивления + 4 излучением
  });

  it('Zephyr Strike: расход на атаку — преимущество, 1d8 силовым и скорость +30', () => {
    const { attacker, primary, f, input } = setupSpell('XGE:Zephyr Strike');
    withRandom(0.5, () => resolveSpellCast(f.ctx, input));
    expect(attacker.effects.some((e) => e.zephyrStrike)).toBe(true);

    withRandom(0.5, () =>
      resolveWeaponAttack(f.ctx, {
        attacker,
        attackerMapId: 'm1',
        target: primary,
        targetMapId: 'm1',
        attack: SWORD,
        author: 'Маг',
      })
    );
    expect(primary.hpCurrent).toBe(26); // 40 − (1d10+3 = 9) − (1d8 силовым = 5)
    expect(attacker.effects.some((e) => e.zephyrStrike)).toBe(false); // одноразовый
    expect(
      attacker.effects.some((e) => e.modifiers.some((m) => m.target === 'speed' && m.mode === 'add' && m.value === 30))
    ).toBe(true);
  });
});
