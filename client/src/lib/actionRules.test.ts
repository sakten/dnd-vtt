import { describe, expect, it } from 'vitest';
import { emptyResources, emptyTurnState, type Spell, type Token } from 'shared';
import { canSpendSlot, maxCastableForSpell, spellCastInfo, spellSlotOf, type TurnContext } from './actionRules';

function makeSpell(over: Partial<Spell> = {}): Spell {
  return {
    key: 'XPHB:Fire Bolt',
    name: 'Fire Bolt',
    source: 'XPHB',
    level: 0,
    school: 'Evocation',
    time: [{ number: 1, unit: 'action' }],
    range: { type: 'ranged', distance: { type: 'feet', amount: 120 } },
    components: { v: true, s: true },
    duration: [{ type: 'instant' }],
    classes: ['wizard'],
    description: ['Описание'],
    damage: { dice: ['1d10'], types: ['fire'] },
    spellAttack: 'ranged',
    automation: 'full',
    ...over,
  };
}

const outOfCombat: TurnContext = {
  combatActive: false,
  isActive: true,
  turn: undefined,
  ownTurn: undefined,
  incapacitated: false,
  controlled: true,
};

describe('spellSlotOf', () => {
  it('раскладывает заклинания по секциям панели', () => {
    expect(spellSlotOf(makeSpell({ time: [{ number: 1, unit: 'action' }] }))).toBe('action');
    expect(spellSlotOf(makeSpell({ time: [{ number: 1, unit: 'bonus' }] }))).toBe('bonus');
    expect(spellSlotOf(makeSpell({ time: [{ number: 1, unit: 'reaction' }] }))).toBe('reaction');
    expect(spellSlotOf(makeSpell({ time: [{ number: 1, unit: 'minute' }] }))).toBe('other');
  });
});

describe('maxCastableForSpell', () => {
  it('у персонажа — по ячейкам ресурсов, у монстра — по ячейкам статблока', () => {
    const spell = makeSpell({ level: 2 });
    const resources = {
      ...emptyResources(),
      spellSlots: [
        { level: 1, current: 1, max: 1 },
        { level: 3, current: 1, max: 1 },
      ],
    };
    expect(maxCastableForSpell(spell, { isCharacter: true, resources, token: undefined })).toBe(3);

    const token = {
      statblock: { spellcasting: { ability: 'wis', slots: [{ level: 2, current: 0, max: 1 }] } },
    } as unknown as Token;
    expect(maxCastableForSpell(spell, { isCharacter: false, resources: null, token })).toBe(0);
  });
});

describe('spellCastInfo', () => {
  it('фокус: без круга и апкаста', () => {
    const info = spellCastInfo(makeSpell(), 0, {
      isCharacter: true,
      resources: emptyResources(),
      token: undefined,
      classes: [],
    });
    expect(info.isCantrip).toBe(true);
    expect(info.canCast).toBe(true);
    expect(info.slotLevel).toBeUndefined();
    expect(info.levels).toEqual([]);
    expect(info.multi).toBe(false);
  });

  it('левел-спелл: круг ограничен ячейками, область определяется areaSpec', () => {
    const spell = makeSpell({
      level: 3,
      areaSpec: { shape: 'sphere', size: 20 },
      area: ['S'],
      save: ['dex'],
      spellAttack: undefined,
    });
    const withoutSlots = spellCastInfo(spell, 3, {
      isCharacter: true,
      resources: emptyResources(),
      token: undefined,
      classes: [],
    });
    expect(withoutSlots.canCast).toBe(false);
    expect(withoutSlots.area).toBe(true);

    const resources = {
      ...emptyResources(),
      spellSlots: [{ level: 3, current: 1, max: 1 }],
    };
    const withSlot = spellCastInfo(spell, 3, { isCharacter: true, resources, token: undefined, classes: [] });
    expect(withSlot.canCast).toBe(true);
    expect(withSlot.levels).toEqual([3]);
  });
});

describe('canSpendSlot', () => {
  it('вне боя — всегда; в чужой ход действие закрыто, реакция — по своему ходу', () => {
    expect(canSpendSlot(outOfCombat, 'action', 'attack')).toBe(true);

    const turn = { ...emptyTurnState(30), actionUsed: true };
    const ctx: TurnContext = {
      combatActive: true,
      isActive: true,
      turn,
      ownTurn: undefined,
      incapacitated: false,
      controlled: true,
    };
    expect(canSpendSlot(ctx, 'action', 'attack')).toBe(false);
    expect(canSpendSlot(ctx, 'reaction', 'attack')).toBe(true);

    const offTurn: TurnContext = { ...ctx, isActive: false, turn: undefined, ownTurn: turn };
    expect(canSpendSlot(offTurn, 'action', 'attack')).toBe(false);
    expect(canSpendSlot(offTurn, 'reaction', 'attack')).toBe(true);
  });
});
