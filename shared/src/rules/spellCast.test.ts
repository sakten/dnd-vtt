import { describe, expect, it } from 'vitest';
import type { PlayerResources } from '../types';
import { normalizeSheet } from '../types';
import type { Spell } from './spells';
import {
  casterStats,
  characterLevel,
  maxCastableLevel,
  spellActionCost,
  spellAreaOrigin,
  spellAttackCount,
  spellDamageExpression,
  spellHasArea,
  spellIsSelf,
  spellRangeFeet,
  spellTargetKind,
} from './spellCast';

function makeSpell(partial: Partial<Spell>): Spell {
  return {
    key: 'XPHB:Test',
    name: 'Test',
    source: 'XPHB',
    level: 1,
    school: 'Evocation',
    time: [{ number: 1, unit: 'action' }],
    range: { type: 'point', distance: { type: 'feet', amount: 60 } },
    components: {},
    duration: [{ type: 'instant' }],
    classes: ['wizard'],
    automation: 'full',
    description: [],
    ...partial,
  };
}

function resources(partial: Partial<PlayerResources>): PlayerResources {
  return {
    hp: { current: 10, max: 10, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    hitDice: [],
    spellSlots: [
      { level: 1, current: 2, max: 2 },
      { level: 2, current: 1, max: 1 },
      { level: 3, current: 0, max: 0 },
    ],
    pact: { current: 0, max: 0, level: 0 },
    resources: [],
    notes: '',
    ...partial,
  };
}

describe('spellActionCost', () => {
  it('по времени накладывания', () => {
    expect(spellActionCost(makeSpell({ time: [{ number: 1, unit: 'action' }] }))).toBe('action');
    expect(spellActionCost(makeSpell({ time: [{ number: 1, unit: 'bonus' }] }))).toBe('bonus');
    expect(spellActionCost(makeSpell({ time: [{ number: 1, unit: 'reaction' }] }))).toBe('reaction');
    expect(spellActionCost(makeSpell({ time: [{ number: 10, unit: 'minute' }] }))).toBe('special');
  });
});

describe('spellDamageExpression', () => {
  it('базовый урон без апкаста', () => {
    const spell = makeSpell({ level: 3, damage: { dice: ['8d6'], types: ['fire'] } });
    expect(spellDamageExpression(spell, 3, 5)).toBe('8d6');
  });

  it('апкаст повторяет кость из higherLevel', () => {
    const spell = makeSpell({
      level: 3,
      damage: { dice: ['8d6'], types: ['fire'] },
      higherLevel: ['The damage increases by 8d6 for each spell slot level above 3.'],
    });
    expect(spellDamageExpression(spell, 4, 5)).toBe('8d6 + 8d6');
    expect(spellDamageExpression(spell, 5, 5)).toBe('8d6 + 8d6 + 8d6');
  });

  it('апкаст с ординалом и одной костью', () => {
    const spell = makeSpell({
      level: 1,
      damage: { dice: ['2d8'], types: [] },
      higherLevel: ['The healing increases by 2d8 for each spell slot level above 1st.'],
    });
    expect(spellDamageExpression(spell, 2, 5)).toBe('2d8 + 2d8');
  });

  it('кантрип масштабируется по уровню персонажа', () => {
    const spell = makeSpell({
      level: 0,
      damage: { dice: ['1d10'], types: ['fire'] },
      higherLevel: ['The damage increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10).'],
    });
    expect(spellDamageExpression(spell, 0, 4)).toBe('1d10');
    expect(spellDamageExpression(spell, 0, 5)).toBe('2d10');
    expect(spellDamageExpression(spell, 0, 11)).toBe('3d10');
    expect(spellDamageExpression(spell, 0, 17)).toBe('4d10');
  });

  it('без костей — null (manual)', () => {
    expect(spellDamageExpression(makeSpell({ damage: undefined }), 1, 5)).toBeNull();
  });
});

describe('spellAttackCount', () => {
  it('обычное заклинание — одна атака', () => {
    expect(spellAttackCount(makeSpell({ damage: { dice: ['1d10'], types: ['fire'] } }), 1, 5)).toBe(1);
  });

  it('Scorching Ray: три луча, апкаст добавляет по лучу', () => {
    const spell = makeSpell({
      level: 2,
      description: ['You hurl three fiery rays. Make a ranged spell attack for each ray.'],
      higherLevel: ['You create one additional ray for each spell slot level above 2.'],
      damage: { dice: ['2d6'], types: ['fire'] },
    });
    expect(spellAttackCount(spell, 2, 5)).toBe(3);
    expect(spellAttackCount(spell, 4, 5)).toBe(5);
  });

  it('Eldritch Blast: лучи по уровню персонажа', () => {
    const spell = makeSpell({
      level: 0,
      description: ['You hurl a beam of crackling energy.'],
      higherLevel: [
        'The spell creates two beams at level 5, three beams at level 11, and four beams at level 17.',
      ],
      damage: { dice: ['1d10'], types: ['force'] },
    });
    expect(spellAttackCount(spell, 0, 4)).toBe(1);
    expect(spellAttackCount(spell, 0, 5)).toBe(2);
    expect(spellAttackCount(spell, 0, 11)).toBe(3);
    expect(spellAttackCount(spell, 0, 17)).toBe(4);
  });

  it('Magic Missile: три дротика, апкаст добавляет', () => {
    const spell = makeSpell({
      level: 1,
      description: ['You create three glowing darts of magical force.'],
      higherLevel: ['The spell creates one more dart for each spell slot level above 1.'],
      damage: { dice: ['1d4 + 1'], types: ['force'] },
    });
    expect(spellAttackCount(spell, 1, 5)).toBe(3);
    expect(spellAttackCount(spell, 3, 5)).toBe(5);
  });
});

describe('spellRangeFeet', () => {
  it('футы, касание, self, special', () => {
    expect(spellRangeFeet(makeSpell({ range: { type: 'point', distance: { type: 'feet', amount: 120 } } }))).toBe(120);
    expect(spellRangeFeet(makeSpell({ range: { type: 'point', distance: { type: 'touch' } } }))).toBe(5);
    expect(spellRangeFeet(makeSpell({ range: { type: 'self' } }))).toBe(0);
    expect(spellRangeFeet(makeSpell({ range: { type: 'special' } }))).toBeNull();
  });
});

describe('spellTargetKind', () => {
  it('self и существо', () => {
    expect(spellTargetKind(makeSpell({ range: { type: 'self' } }))).toBe('self');
    expect(spellTargetKind(makeSpell({ range: { type: 'point', distance: { type: 'feet', amount: 30 } } }))).toBe(
      'creature'
    );
  });

  it('self через distance.type (формат 5e.tools)', () => {
    const spell = makeSpell({ range: { type: 'point', distance: { type: 'self' } } });
    expect(spellIsSelf(spell)).toBe(true);
    expect(spellTargetKind(spell)).toBe('self');
    expect(spellRangeFeet(spell)).toBe(0);
  });
});

describe('области (Ф7)', () => {
  it('spellHasArea: геометрия + спасбросок + AoE-тег', () => {
    expect(
      spellHasArea(makeSpell({ areaSpec: { shape: 'sphere', size: 20 }, save: ['dex'], area: ['S'] }))
    ).toBe(true);
    expect(
      spellHasArea(makeSpell({ areaSpec: { shape: 'sphere', size: 20 }, save: ['dex'], area: ['ST'] }))
    ).toBe(false);
    expect(spellHasArea(makeSpell({ areaSpec: { shape: 'sphere', size: 20 }, area: ['S'] }))).toBe(false);
  });

  it('spellAreaOrigin: конус/линия/куб/эманация — от кастера', () => {
    expect(spellAreaOrigin(makeSpell({ range: { type: 'cone', distance: { type: 'feet', amount: 15 } } }))).toBe('self');
    expect(spellAreaOrigin(makeSpell({ range: { type: 'emanation', distance: { type: 'feet', amount: 15 } } }))).toBe(
      'self'
    );
    expect(spellAreaOrigin(makeSpell({ range: { type: 'point', distance: { type: 'feet', amount: 120 } } }))).toBe(
      'point'
    );
  });
});

describe('maxCastableLevel', () => {
  it('максимум доступной ячейки под круг заклинания', () => {
    const spell = makeSpell({ level: 2 });
    expect(maxCastableLevel(spell, resources({}))).toBe(2);
    expect(
      maxCastableLevel(
        spell,
        resources({ spellSlots: [{ level: 1, current: 3, max: 3 }] })
      )
    ).toBe(0);
  });

  it('pact-ячейки учитываются', () => {
    const spell = makeSpell({ level: 2 });
    expect(maxCastableLevel(spell, resources({ spellSlots: [], pact: { current: 1, max: 1, level: 3 } }))).toBe(3);
  });

  it('кантрип — 0', () => {
    expect(maxCastableLevel(makeSpell({ level: 0 }), resources({}))).toBe(0);
  });
});

describe('characterLevel', () => {
  it('сумма уровней классов', () => {
    expect(characterLevel([{ className: 'wizard', level: 5 }, { className: 'fighter', level: 2 }])).toBe(7);
  });
});

describe('casterStats', () => {
  it('DC и атака по классу заклинания', () => {
    const sheet = normalizeSheet({
      abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
      proficiencyBonus: '3',
      classes: [{ className: 'wizard', level: 5 }],
    });
    expect(casterStats(sheet, 'wizard')).toEqual({ ability: 'int', mod: 4, dc: 15, attack: 7 });
    expect(casterStats(sheet, 'barbarian')).toBeNull();
  });
});
