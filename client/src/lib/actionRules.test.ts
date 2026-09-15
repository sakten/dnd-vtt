import { describe, expect, it } from 'vitest';
import { emptyResources, emptyTurnState, type Spell, type Token } from 'shared';
import {
  canSpendSlot,
  castLevelsForSpell,
  maxCastableForSpell,
  sortPanelSpells,
  spellHasEffects,
  spellSlotOf,
  spellCastInfo,
  type TurnContext,
} from './actionRules';

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

  it('в меню кругов только ячейки в наличии (без пустых)', () => {
    const spell = makeSpell({ level: 1 });
    const resources = {
      ...emptyResources(),
      spellSlots: [
        { level: 1, current: 0, max: 2 },
        { level: 2, current: 1, max: 1 },
      ],
    };
    const info = spellCastInfo(spell, 1, { isCharacter: true, resources, token: undefined, classes: [] });
    expect(info.levels).toEqual([2]);
    expect(info.canCast).toBe(true);
  });
});

describe('castLevelsForSpell', () => {
  it('ячейки статблока монстра', () => {
    const token = {
      statblock: {
        spellcasting: {
          slots: [
            { level: 1, current: 0, max: 1 },
            { level: 2, current: 1, max: 1 },
          ],
        },
      },
    } as unknown as Token;
    expect(castLevelsForSpell(makeSpell({ level: 1 }), { isCharacter: false, resources: null, token })).toEqual([2]);
  });
});

describe('spellCastInfo: мульти-цели', () => {
  const caster = {
    isCharacter: true,
    resources: { ...emptyResources(), spellSlots: [{ level: 3, current: 1, max: 1 }] },
    token: undefined,
    classes: [],
  };

  it('Mass Healing Word: до 6 существ', () => {
    const spell = makeSpell({
      key: 'XPHB:Mass Healing Word',
      name: 'Mass Healing Word',
      level: 3,
      spellAttack: undefined,
      healing: true,
      damage: { dice: ['2d4'], types: [] },
    });
    const info = spellCastInfo(spell, 3, caster);
    expect(info.multi).toBe(true);
    expect(info.multiCount).toBe(6);
    expect(info.multiKind).toBe('targets');
  });

  it('Scorching Ray: снаряды (повторы допустимы)', () => {
    const spell = makeSpell({
      key: 'XPHB:Scorching Ray',
      name: 'Scorching Ray',
      level: 2,
      description: ['You create three rays of fire.'],
      damage: { dice: ['2d6'], types: ['fire'] },
    });
    const info = spellCastInfo(spell, 2, caster);
    expect(info.multi).toBe(true);
    expect(info.multiCount).toBe(3);
    expect(info.multiKind).toBe('projectiles');
  });

  it('Hold Person: +1 цель за круг выше 2-го', () => {
    const spell = makeSpell({
      key: 'XPHB:Hold Person',
      name: 'Hold Person',
      level: 2,
      spellAttack: undefined,
      higherLevel: ['You can target one additional Humanoid for each spell slot level above 2.'],
    });
    const upcast = spellCastInfo(spell, 3, caster);
    expect(upcast.multi).toBe(true);
    expect(upcast.multiCount).toBe(2);
    expect(upcast.multiKind).toBe('targets');
    expect(spellCastInfo(spell, 2, caster).multi).toBe(false);
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

describe('spellHasEffects', () => {
  it('прямые эффекты, аура и триггеры зоны — да; чистый урон — нет', () => {
    expect(spellHasEffects(makeSpell({ key: 'XPHB:Bless', name: 'Bless', level: 1 }))).toBe(true);
    expect(spellHasEffects(makeSpell({ key: 'XPHB:Hunger of Hadar', name: 'Hunger of Hadar', level: 3 }))).toBe(true);
    expect(spellHasEffects(makeSpell({ key: 'XPHB:Spirit Guardians', name: 'Spirit Guardians', level: 3 }))).toBe(true);
    expect(spellHasEffects(makeSpell())).toBe(false);
    expect(spellHasEffects(makeSpell({ key: 'XPHB:Fireball', name: 'Fireball', level: 3 }))).toBe(false);
  });
});

describe('sortPanelSpells', () => {
  it('сначала с эффектами, затем авто-механика, красные — в конце; внутри круг и название', () => {
    const fireBolt = makeSpell();
    const fireball = makeSpell({ key: 'XPHB:Fireball', name: 'Fireball', level: 3 });
    const lightning = makeSpell({ key: 'XPHB:Lightning Bolt', name: 'Lightning Bolt', level: 3 });
    const bless = makeSpell({ key: 'XPHB:Bless', name: 'Bless', level: 1 });
    const hypnotic = makeSpell({ key: 'XPHB:Hypnotic Pattern', name: 'Hypnotic Pattern', level: 3 });
    const manual = makeSpell({ key: 'XPHB:Detect Magic', name: 'Detect Magic', level: 1, automation: 'manual' });

    const sorted = sortPanelSpells([manual, fireball, hypnotic, fireBolt, lightning, bless]);
    expect(sorted.map((s) => s.name)).toEqual([
      'Bless',
      'Hypnotic Pattern',
      'Fire Bolt',
      'Fireball',
      'Lightning Bolt',
      'Detect Magic',
    ]);
    expect(sortPanelSpells([])).toEqual([]);
  });
});
