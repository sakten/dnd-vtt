import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ABILITIES, type EffectInstance } from 'shared';
import { makeConnCtx } from '../test/ctx';
import { makeCombatRoom, makeRoom, makeToken } from '../test/fixtures';
import { applyDamage } from './damage';

function setup(defenses: { id: string; type: 'resistance' | 'immunity' | 'vulnerability'; damageType: string }[]) {
  const target = makeToken('t1', { hpMax: '50', hpCurrent: 50, damageDefenses: defenses });
  const room = makeRoom();
  room.scene.maps[0]!.tokens.push(target);
  const f = makeConnCtx(room, { dm: true });
  return { target, f, ctx: f.ctx };
}

const laughter = (dc: number) =>
  ({
    id: 'ef1',
    name: 'Hideous Laughter',
    duration: { type: 'untilSave', ability: 'wis', dc, timing: 'end' } as const,
    modifiers: [],
    saveOnDamage: { advantage: true },
  });

describe('applyDamage: составной урон', () => {
  it('иммунитет к огню режет только огненную часть', () => {
    const { target, ctx } = setup([{ id: 'd1', type: 'immunity', damageType: 'fire' }]);
    const result = applyDamage(ctx, {
      target,
      mapId: 'm1',
      amount: 18,
      damageType: 'slashing',
      parts: [
        { damageType: 'slashing', amount: 13 },
        { damageType: 'fire', amount: 5 },
      ],
    });
    expect(result.amount).toBe(13);
    expect(target.hpCurrent).toBe(37);
  });

  it('части без типа наследуют основной тип атаки', () => {
    const { target, ctx } = setup([{ id: 'd1', type: 'resistance', damageType: 'slashing' }]);
    const result = applyDamage(ctx, {
      target,
      mapId: 'm1',
      amount: 11,
      damageType: 'slashing',
      parts: [{ amount: 11 }],
    });
    expect(result.amount).toBe(5);
    expect(target.hpCurrent).toBe(45);
  });

  it('сопротивление считается по каждой части отдельно', () => {
    const { target, ctx } = setup([{ id: 'd1', type: 'resistance', damageType: 'fire' }]);
    const result = applyDamage(ctx, {
      target,
      mapId: 'm1',
      amount: 18,
      damageType: 'slashing',
      parts: [
        { damageType: 'slashing', amount: 13 },
        { damageType: 'fire', amount: 5 },
      ],
    });
    expect(result.amount).toBe(15);
    expect(target.hpCurrent).toBe(35);
  });
});

describe('Warding Bond: перенос урона', () => {
  function bonding() {
    const target = makeToken('t1', { x: 100, y: 100, hpMax: '50', hpCurrent: 50 });
    const caster = makeToken('t2', {
      x: 150,
      y: 100,
      hpMax: '30',
      hpCurrent: 30,
      damageDefenses: [{ id: 'd1', type: 'resistance', damageType: 'slashing' }],
    });
    const room = makeRoom();
    room.scene.maps[0]!.tokens.push(target, caster);
    const f = makeConnCtx(room, { dm: true });
    target.effects = [
      { id: 'wb', name: 'Warding Bond', duration: { type: 'permanent' }, modifiers: [], damageLink: { tokenId: 't2' } },
    ];
    return { target, caster, f };
  }

  it('урон цели переносится источнику без его защит', () => {
    const { target, caster, f } = bonding();
    applyDamage(f.ctx, { target, mapId: 'm1', amount: 10, damageType: 'slashing' });
    expect(target.hpCurrent).toBe(40);
    expect(caster.hpCurrent).toBe(20);
  });

  it('разрыв >60 фт снимает связь, урон не переносится', () => {
    const { target, caster, f } = bonding();
    caster.x = 1000;
    applyDamage(f.ctx, { target, mapId: 'm1', amount: 10, damageType: 'slashing' });
    expect(target.hpCurrent).toBe(40);
    expect(caster.hpCurrent).toBe(30);
    expect(target.effects.some((e) => e.damageLink)).toBe(false);
  });

  it('падение источника до 0 снимает связь', () => {
    const { target, caster, f } = bonding();
    caster.hpCurrent = 5;
    applyDamage(f.ctx, { target, mapId: 'm1', amount: 10, damageType: 'slashing' });
    expect(caster.hpCurrent).toBeLessThanOrEqual(0);
    expect(target.effects.some((e) => e.damageLink)).toBe(false);
  });
});

describe('повторный спасбросок от урона (Hideous Laughter)', () => {
  it('провал сейва оставляет эффект, бросок идёт с преимуществом', () => {
    const { target, f, ctx } = setup([]);
    target.effects.push(laughter(100));
    applyDamage(ctx, { target, mapId: 'm1', amount: 5, damageType: 'slashing' });
    expect(target.effects).toHaveLength(1);
    const msg = f.emitted.find((e) => e.event === 'chat:message')!.payload as {
      roll?: { dice?: { advantage?: string | null }[] };
    };
    expect(msg.roll?.dice?.[0]?.advantage).toBe('a');
  });

  it('успех снимает эффект и его состояния', () => {
    const { target, f, ctx } = setup([]);
    target.effects.push(laughter(0));
    target.conditions.push({ key: 'incapacitated', name: 'Недееспособен', rounds: null, effectId: 'ef1' });
    applyDamage(ctx, { target, mapId: 'm1', amount: 5, damageType: 'slashing' });
    expect(target.effects).toHaveLength(0);
    expect(target.conditions).toHaveLength(0);
    const msg = f.emitted.find((e) => e.event === 'chat:message')!.payload as { labelParams?: { saveOutcome?: string } };
    expect(msg.labelParams?.saveOutcome).toBe('success');
  });
});

describe('Armor of Agathys: ответный урон', () => {
  function aoa() {
    const target = makeToken('t1', { hpMax: '50', hpCurrent: 50, hpTemp: 5 });
    const attacker = makeToken('t2', { hpMax: '30', hpCurrent: 30 });
    const room = makeRoom();
    room.scene.maps[0]!.tokens.push(target);
    const f = makeConnCtx(room, { dm: true });
    target.effects.push({
      id: 'aoa1',
      name: 'Armor of Agathys',
      sourceKey: 'XPHB:Armor of Agathys',
      sourceId: target.id,
      duration: { type: 'permanent' },
      modifiers: [],
      retaliate: { damageType: 'cold', amount: 5 },
    });
    return { target, attacker, f };
  }

  it('ближняя атака: атакующий получает холод, THP съедаются первыми', () => {
    const { target, attacker, f } = aoa();
    applyDamage(f.ctx, {
      target,
      mapId: 'm1',
      amount: 7,
      damageType: 'slashing',
      attacker,
      melee: true,
    });
    expect(target.hpCurrent).toBe(48);
    expect(attacker.hpCurrent).toBe(25);
  });

  it('дальняя атака и удар без THP не отвечают', () => {
    const { target, attacker, f } = aoa();
    applyDamage(f.ctx, { target, mapId: 'm1', amount: 3, damageType: 'piercing', attacker, melee: false });
    expect(attacker.hpCurrent).toBe(30);
    target.hpTemp = 0;
    applyDamage(f.ctx, { target, mapId: 'm1', amount: 3, damageType: 'piercing', attacker, melee: true });
    expect(attacker.hpCurrent).toBe(30);
  });

  it('ответный урон костями (Fire Shield/Shadow of Moil): бросается 2d8', () => {
    const { target, attacker, f } = aoa();
    target.effects[0]!.retaliate = { damageType: 'fire', dice: '2d8' };
    const original = Math.random;
    Math.random = () => 0.5; // каждая d8 = 5
    try {
      applyDamage(f.ctx, { target, mapId: 'm1', amount: 3, damageType: 'slashing', attacker, melee: true });
    } finally {
      Math.random = original;
    }
    expect(attacker.hpCurrent).toBe(20); // 30 − 10
  });

  it('нанесение урона обрывает эффект с breakOn:damage (Sanctuary)', () => {
    const { target, attacker, f } = aoa();
    // Защищённый сам наносит урон — Sanctuary спадает.
    attacker.effects = [
      {
        id: 'sanc1',
        name: 'Sanctuary',
        sourceKey: 'XPHB:Sanctuary',
        duration: { type: 'permanent' },
        modifiers: [],
        sanctuary: { dc: 14 },
        breakOn: ['attack', 'spell', 'damage'],
      },
    ];
    applyDamage(f.ctx, { target, mapId: 'm1', amount: 3, damageType: 'piercing', attacker, melee: true });
    expect(attacker.effects.some((e) => e.id === 'sanc1')).toBe(false);
  });
});

describe('Resistance: снижение урона зарядом', () => {
  function resist() {
    const target = makeToken('t1', { hpMax: '50', hpCurrent: 50 });
    // CON 30: концентрация не спадает от тестового урона (проверяем только заряд).
    target.statblock = { abilities: { ...DEFAULT_ABILITIES, con: 30 } };
    const room = makeRoom();
    room.scene.maps[0]!.tokens.push(target);
    const f = makeConnCtx(room, { dm: true });
    target.effects.push({
      id: 'res1',
      name: 'Resistance',
      sourceKey: 'XPHB:Resistance',
      sourceId: target.id,
      concentration: true,
      duration: { type: 'concentration' },
      modifiers: [],
      damageReduce: { dice: '1d4', types: ['fire'] },
      charges: { remaining: 1 },
    });
    return { target, f };
  }

  it('урон выбранного типа режется на 1d4, заряд тратится до конца хода', () => {
    const { target, f } = resist();
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.75); // d4 = 4
    const first = applyDamage(f.ctx, { target, mapId: 'm1', amount: 10, damageType: 'fire' });
    rand.mockRestore();
    expect(first.amount).toBe(6);
    expect(target.hpCurrent).toBe(44);
    expect(target.effects[0]?.charges?.remaining).toBe(0);
    const second = applyDamage(f.ctx, { target, mapId: 'm1', amount: 10, damageType: 'fire' });
    expect(second.amount).toBe(10);
    expect(target.hpCurrent).toBe(34);
  });

  it('урон другого типа заряд не тратит', () => {
    const { target, f } = resist();
    const result = applyDamage(f.ctx, { target, mapId: 'm1', amount: 10, damageType: 'cold' });
    expect(result.amount).toBe(10);
    expect(target.effects[0]?.charges?.remaining).toBe(1);
  });

  it('заряд обновляется в начале хода носителя', () => {
    const { target, f } = resist();
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.75);
    applyDamage(f.ctx, { target, mapId: 'm1', amount: 10, damageType: 'fire' });
    rand.mockRestore();
    expect(target.effects[0]?.charges?.remaining).toBe(0);
    f.ctx.manager.tickEffects(f.room, target, 'start');
    expect(target.effects[0]?.charges?.remaining).toBe(1);
  });
});

describe('неуменьшаемый урон (Life Transference)', () => {
  it('сопротивления и Resistance не уменьшают, заряд не тратится', () => {
    const target = makeToken('t1', {
      hpMax: '50',
      hpCurrent: 50,
      damageDefenses: [{ id: 'd1', type: 'resistance', damageType: 'necrotic' }],
    });
    const room = makeRoom();
    room.scene.maps[0]!.tokens.push(target);
    const f = makeConnCtx(room, { dm: true });
    // CON 30: концентрация не спадает от тестового урона (проверяем только неуменьшаемость).
    target.statblock = { abilities: { ...DEFAULT_ABILITIES, con: 30 } };
    target.effects.push({
      id: 'res1',
      name: 'Resistance',
      sourceKey: 'XPHB:Resistance',
      sourceId: target.id,
      concentration: true,
      duration: { type: 'concentration' },
      modifiers: [],
      damageReduce: { dice: '1d4', types: ['necrotic'] },
      charges: { remaining: 1 },
    });
    const result = applyDamage(f.ctx, {
      target,
      mapId: 'm1',
      amount: 12,
      damageType: 'necrotic',
      unreducible: true,
    });
    expect(result.amount).toBe(12);
    expect(target.hpCurrent).toBe(38);
    expect(target.effects[0]?.charges?.remaining).toBe(1);
  });
});

describe('концентрация от урона (Greater Invisibility)', () => {
  // GI — концентрация (без breakOn): урон заставляет спас CON, эффект не «обрывается» атакой.
  const gi = (sourceId: string): EffectInstance[] => [
    {
      id: 'gi',
      name: 'Greater Invisibility',
      sourceKey: 'XPHB:Greater Invisibility',
      sourceId,
      concentration: true,
      duration: { type: 'concentration' },
      conditions: ['invisible'],
      modifiers: [],
    },
    {
      id: 'anchor',
      name: 'Greater Invisibility',
      sourceKey: 'XPHB:Greater Invisibility',
      sourceId,
      concentration: true,
      duration: { type: 'concentration' },
      modifiers: [],
    },
  ];

  it('успешный спас сохраняет эффект, бросок концентрации идёт в чат', () => {
    const { target, f, ctx } = setup([]);
    target.statblock = { abilities: { ...DEFAULT_ABILITIES, con: 30 } };
    target.effects = gi('t1');
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    applyDamage(ctx, { target, mapId: 'm1', amount: 10, damageType: 'radiant' });
    rand.mockRestore();
    expect(target.effects.some((e) => e.id === 'gi')).toBe(true);
    expect(f.room.chat.some((m) => m.kind === 'roll' && m.rollKind === 'save')).toBe(true);
  });

  it('провал снимает эффект вместе с состоянием', () => {
    const { target, ctx } = setup([]);
    target.statblock = { abilities: { ...DEFAULT_ABILITIES, con: 1 } };
    target.effects = gi('t1');
    target.conditions = [{ key: 'invisible', name: 'Невидим', rounds: null, effectId: 'gi' }];
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
    applyDamage(ctx, { target, mapId: 'm1', amount: 10, damageType: 'radiant' });
    rand.mockRestore();
    expect(target.effects.some((e) => e.id === 'gi')).toBe(false);
    expect(target.conditions.some((c) => c.key === 'invisible')).toBe(false);
  });

  it('GI чужого кастера урон по носителю не снимает', () => {
    const { target, ctx } = setup([]);
    target.statblock = { abilities: { ...DEFAULT_ABILITIES, con: 1 } };
    target.effects = gi('t9');
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
    applyDamage(ctx, { target, mapId: 'm1', amount: 10, damageType: 'radiant' });
    rand.mockRestore();
    expect(target.effects.some((e) => e.id === 'gi')).toBe(true);
  });
});

describe('Elemental Bane: снятие сопротивления и доп. урон', () => {
  const bane = (damageType: string): EffectInstance => ({
    id: 'eb',
    name: 'Elemental Bane',
    sourceKey: 'XGE:Elemental Bane',
    sourceId: 't9',
    concentration: true,
    duration: { type: 'concentration' },
    modifiers: [],
    elementalBane: { damageType, dice: '2d6' },
  });

  it('сопротивление выбранному типу не действует', () => {
    const { target, ctx } = setup([{ id: 'd1', type: 'resistance', damageType: 'fire' }]);
    target.effects.push(bane('fire'));
    const result = applyDamage(ctx, { target, mapId: 'm1', amount: 10, damageType: 'fire' });
    // 10 без сопротивления + 2к6 (2..12).
    expect(result.amount).toBeGreaterThanOrEqual(12);
    expect(result.amount).toBeLessThanOrEqual(22);
    expect(target.hpCurrent).toBe(50 - result.amount);
  });

  it('первый урон за ход даёт 2к6, повторный — нет, новый ход — снова', () => {
    const target = makeToken('t1', { hpMax: '50', hpCurrent: 50 });
    target.effects.push(bane('fire'));
    const room = makeCombatRoom([target]);
    const f = makeConnCtx(room, { dm: true });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5); // d6 = 4 → 2к6 = 8
    const first = applyDamage(f.ctx, { target, mapId: 'm1', amount: 10, damageType: 'fire' });
    const second = applyDamage(f.ctx, { target, mapId: 'm1', amount: 10, damageType: 'fire' });
    expect(first.amount).toBe(18);
    expect(second.amount).toBe(10);
    expect(target.effects[0]?.elementalBane?.usedTurn).toBe('1:e1');
    expect(f.room.chat.some((m) => m.kind === 'roll' && m.labelParams?.damageType === 'fire')).toBe(true);
    room.scene.maps[0]!.combat!.round = 2;
    const third = applyDamage(f.ctx, { target, mapId: 'm1', amount: 10, damageType: 'fire' });
    rand.mockRestore();
    expect(third.amount).toBe(18);
    expect(target.hpCurrent).toBe(4);
  });

  it('урон другого типа не срабатывает', () => {
    const { target, ctx } = setup([]);
    target.effects.push(bane('fire'));
    const result = applyDamage(ctx, { target, mapId: 'm1', amount: 10, damageType: 'cold' });
    expect(result.amount).toBe(10);
    expect(target.effects[0]?.elementalBane?.usedTurn).toBeUndefined();
  });

  it('вне боя срабатывает один раз — до начала боя', () => {
    const { target, ctx } = setup([]);
    target.effects.push(bane('fire'));
    const first = applyDamage(ctx, { target, mapId: 'm1', amount: 10, damageType: 'fire' });
    const second = applyDamage(ctx, { target, mapId: 'm1', amount: 10, damageType: 'fire' });
    expect(first.amount).toBeGreaterThan(10);
    expect(second.amount).toBe(10);
    expect(target.effects[0]?.elementalBane?.usedTurn).toBeNull();
  });
});

describe('Bestow Curse: спас в начале хода и принудительное Уклонение', () => {
  const curse = (): EffectInstance => ({
    id: 'bc',
    name: 'Bestow Curse',
    sourceKey: 'XPHB:Bestow Curse',
    sourceId: 't9',
    concentration: true,
    duration: { type: 'concentration' },
    modifiers: [],
    turnDodge: { ability: 'wis', dc: 15 },
  });

  it('провал накладывает Уклонение с запретом действий', () => {
    const { target, f, ctx } = setup([]);
    target.effects.push(curse());
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1 → провал
    const res = ctx.manager.tickEffects(f.room, target, 'start');
    rand.mockRestore();
    expect(res.saves[0]).toMatchObject({ name: 'Bestow Curse', success: false });
    const dodge = target.effects.find((e) => e.name === 'Уклонение');
    expect(dodge?.restrictions).toEqual({ noActions: true });
    expect(dodge?.duration).toEqual({ type: 'endOfTurn', of: 'target' });
    expect(dodge?.modifiers.some((m) => m.target === 'attack' && m.mode === 'disadvantage')).toBe(true);
    expect(res.forced).toEqual(['Bestow Curse']);
  });

  it('успешный спас Уклонение не накладывает', () => {
    const { target, f, ctx } = setup([]);
    target.effects.push(curse());
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99); // d20 = 20 → успех
    const res = ctx.manager.tickEffects(f.room, target, 'start');
    rand.mockRestore();
    expect(res.saves[0]).toMatchObject({ name: 'Bestow Curse', success: true });
    expect(target.effects.some((e) => e.name === 'Уклонение')).toBe(false);
    expect(res.forced).toEqual([]);
  });
});

describe('Immolation: повторный спас в конце хода', () => {
  const burning = (): EffectInstance => ({
    id: 'im',
    name: 'Immolation',
    sourceKey: 'XGE:Immolation',
    sourceId: 't9',
    concentration: true,
    duration: {
      type: 'untilSave',
      ability: 'dex',
      dc: 15,
      timing: 'end',
      damage: { dice: '4d6fire', types: ['fire'] },
    },
    modifiers: [],
  });

  it('провал — бросок урона в saveDamage, эффект остаётся', () => {
    const { target, f, ctx } = setup([]);
    target.effects.push(burning());
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1 → провал, d6 = 1 → 4
    const res = ctx.manager.tickEffects(f.room, target, 'end');
    rand.mockRestore();
    expect(res.saves[0]).toMatchObject({ name: 'Immolation', success: false });
    expect(res.saveDamage[0]).toMatchObject({ name: 'Immolation', damageType: 'fire' });
    expect(res.saveDamage[0]?.roll.total).toBe(4);
    expect(target.effects.some((e) => e.id === 'im')).toBe(true);
  });

  it('успех — эффект снят, урона нет', () => {
    const { target, f, ctx } = setup([]);
    target.effects.push(burning());
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99); // d20 = 20 → успех
    const res = ctx.manager.tickEffects(f.room, target, 'end');
    rand.mockRestore();
    expect(res.saves[0]?.success).toBe(true);
    expect(res.saveDamage).toHaveLength(0);
    expect(target.effects.some((e) => e.id === 'im')).toBe(false);
  });
});
