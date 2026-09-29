import { describe, expect, it } from 'vitest';
import type { PlayerResources } from '../domain/sheet';
import { normalizeSheet } from '../normalize';
import { deriveAttackCount, deriveCantripTiers, deriveUpcast, type Spell } from './spells';
import {
  casterStats,
  castableLevels,
  characterLevel,
  maxCastableLevel,
  spellActionCost,
  spellAreaOrigin,
  spellAttackCount,
  spellDamageExpression,
  spellExtraTargets,
  spellHasArea,
  spellIsSelf,
  spellRangeFeet,
  spellTargetKind,
  spellUpcastAt,
  spellUpcastDice,
  snapWallJoint,
  snapWallAnchor,
  wallMaxPanels,
  wallPanelFeet,
  wallPathIssue,
} from './spellCast';

function makeSpell(partial: Partial<Spell>): Spell {
  const spell: Spell = {
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
    description: [],
    ...partial,
  };
  // Фикстуры: числа скейла выводим так же, как сборщик данных (npm run spells).
  const hi = spell.higherLevel;
  if (!spell.upcast && hi?.length) spell.upcast = deriveUpcast(hi);
  if (!spell.cantrip && spell.level === 0 && hi?.length) {
    spell.cantrip = deriveCantripTiers(hi, spell.description ?? []);
  }
  if (!spell.attacks) spell.attacks = deriveAttackCount(spell.description ?? []);
  return spell;
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

  it('ступени апкаста заменяют кость (Shadow Blade), а не суммируются', () => {
    const spell = makeSpell({
      level: 2,
      damage: { dice: ['2d8'], types: ['psychic'] },
      upcast: {
        tiers: [
          { level: 3, dice: '3d8' },
          { level: 5, dice: '4d8' },
          { level: 7, dice: '5d8' },
        ],
      },
    });
    expect(spellDamageExpression(spell, 2, 5)).toBe('2d8');
    expect(spellDamageExpression(spell, 3, 5)).toBe('3d8');
    expect(spellDamageExpression(spell, 4, 5)).toBe('3d8');
    expect(spellDamageExpression(spell, 6, 5)).toBe('4d8');
    expect(spellDamageExpression(spell, 9, 5)).toBe('5d8');
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

describe('spellUpcastAt (числовой апкаст)', () => {
  it('линейный: кости/атака/цели за круги выше', () => {
    const spell = makeSpell({ level: 1, upcast: { above: 1, dice: '1d6', attack: 1, targets: 1 } });
    expect(spellUpcastAt(spell, 1)).toEqual({});
    expect(spellUpcastAt(spell, 3)).toEqual({ dice: '1d6 + 1d6', attack: 2, targets: 2 });
    expect(spellUpcastDice(spell, 4)).toBe('1d6 + 1d6 + 1d6');
  });

  it('шаг «за каждые два круга»', () => {
    const spell = makeSpell({ level: 3, upcast: { above: 3, every: 2, dice: '1d8' } });
    expect(spellUpcastAt(spell, 4)).toEqual({});
    expect(spellUpcastAt(spell, 5)).toEqual({ dice: '1d8' });
    expect(spellUpcastAt(spell, 7)).toEqual({ dice: '1d8 + 1d8' });
  });

  it('ступени: значения с ближайшего достигнутого круга', () => {
    const spell = makeSpell({
      level: 3,
      upcast: {
        tiers: [
          { level: 5, attack: 2, dice: '2d4' },
          { level: 7, attack: 3, dice: '3d4' },
        ],
      },
    });
    expect(spellUpcastAt(spell, 4)).toEqual({});
    expect(spellUpcastAt(spell, 6)).toEqual({ attack: 2, dice: '2d4' });
    expect(spellUpcastAt(spell, 9)).toEqual({ attack: 3, dice: '3d4' });
  });

  it('интеграция: spellDamageExpression и spellExtraTargets из upcast', () => {
    const damage = makeSpell({ level: 1, damage: { dice: ['2d6'], types: ['fire'] }, upcast: { above: 1, dice: '1d6' } });
    expect(spellDamageExpression(damage, 3, 1)).toBe('2d6 + 1d6 + 1d6');
    const targets = makeSpell({ level: 1, upcast: { above: 1, targets: 1 } });
    expect(spellExtraTargets(targets, 4)).toBe(3);
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

  it('эманация 2024 (Aura of Life) — тоже self', () => {
    const spell = makeSpell({ range: { type: 'emanation', distance: { type: 'feet', amount: 30 } } });
    expect(spellTargetKind(spell)).toBe('self');
  });

  it('True Strike: range self в данных, но каст целится в существо', () => {
    const spell = makeSpell({
      key: 'XPHB:True Strike',
      range: { type: 'point', distance: { type: 'self' } },
    });
    expect(spellTargetKind(spell)).toBe('creature');
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
    // Эманация от себя — область даже без AoE-тега (Conjure Woodland Beings).
    expect(
      spellHasArea(
        makeSpell({
          areaSpec: { shape: 'sphere', size: 10 },
          save: ['wis'],
          range: { type: 'emanation', distance: { type: 'feet', amount: 10 } },
        })
      )
    ).toBe(true);
    // Daylight — зона от точки без спасброска: прицел всё равно нужен.
    expect(spellHasArea(makeSpell({ key: 'XPHB:Daylight', areaSpec: { shape: 'sphere', size: 60 } }))).toBe(true);
    // Dragon's Breath: areaSpec относится к выданному действию, каст — по существу.
    expect(
      spellHasArea(
        makeSpell({
          key: "XPHB:Dragon's Breath",
          areaSpec: { shape: 'cone', size: 15 },
          save: ['dex'],
          area: ['ST'],
        })
      )
    ).toBe(false);
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

  it('ячейки монстра из статблока', () => {
    const spell = makeSpell({ level: 2 });
    expect(maxCastableLevel(spell, null, [{ level: 2, current: 1 }])).toBe(2);
    expect(maxCastableLevel(spell, null, [{ level: 1, current: 3 }])).toBe(0);
    expect(maxCastableLevel(spell, null, [{ level: 4, current: 1 }])).toBe(4);
    expect(maxCastableLevel(spell, null, [{ level: 3, current: 0 }])).toBe(0);
    // без настроенных ячеек каст не ограничиваем
    expect(maxCastableLevel(spell, null)).toBe(2);
  });
});

describe('castableLevels', () => {
  it('только круги с ячейками, пустые промежуточные пропускаются', () => {
    const spell = makeSpell({ level: 1 });
    const res = resources({
      spellSlots: [
        { level: 1, current: 0, max: 2 },
        { level: 2, current: 1, max: 1 },
        { level: 3, current: 1, max: 1 },
      ],
    });
    expect(castableLevels(spell, res)).toEqual([2, 3]);
  });

  it('пакт учитывается, круг ниже базового — нет', () => {
    const spell = makeSpell({ level: 3 });
    expect(castableLevels(spell, resources({}))).toEqual([]);
    expect(castableLevels(spell, resources({ pact: { current: 1, max: 1, level: 5 } }))).toEqual([5]);
    expect(castableLevels(spell, resources({ pact: { current: 1, max: 1, level: 2 } }))).toEqual([]);
  });

  it('ячейки монстра и фолбэк без настроенных ячеек', () => {
    const spell = makeSpell({ level: 2 });
    expect(
      castableLevels(spell, null, [
        { level: 3, current: 2 },
        { level: 2, current: 0 },
      ])
    ).toEqual([3]);
    expect(castableLevels(spell, null)).toEqual([2]);
    expect(castableLevels(makeSpell({ level: 0 }), resources({}))).toEqual([]);
  });
});

describe('spellExtraTargets', () => {
  it('базовый круг — без прироста, апкаст — по кругу выше', () => {
    const hold = makeSpell({
      level: 2,
      higherLevel: ['You can target one additional Humanoid for each spell slot level above 2.'],
    });
    expect(spellExtraTargets(hold, 2)).toBe(0);
    expect(spellExtraTargets(hold, 3)).toBe(1);
    expect(spellExtraTargets(hold, 5)).toBe(3);
  });

  it('не путает снаряды и свет с целями', () => {
    const ray = makeSpell({
      key: 'XPHB:Scorching Ray',
      higherLevel: ['You create one additional ray for each spell slot level above 2.'],
    });
    expect(spellExtraTargets(ray, 5)).toBe(0);
    const light = makeSpell({
      key: 'XPHB:Light',
      level: 0,
      higherLevel: ['Dim Light for an additional 20 feet.'],
    });
    expect(spellExtraTargets(light, 5)).toBe(0);
  });

  it('Banishment: +1 цель за круг выше 4-го', () => {
    const banish = makeSpell({
      level: 4,
      higherLevel: ['You can target one additional creature for each spell slot level above 4.'],
    });
    expect(spellExtraTargets(banish, 4)).toBe(0);
    expect(spellExtraTargets(banish, 5)).toBe(1);
    expect(spellExtraTargets(banish, 7)).toBe(3);
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

describe('цепочка панелей тонкой стены (Wall of Ice)', () => {
  const grid = { size: 50 };
  const panel = 100; // 10 фт на сетке 50px

  it('параметры панели и лимит — только у тонких стен', () => {
    expect(wallPanelFeet('XPHB:Wall of Ice')).toBe(10);
    expect(wallMaxPanels('XPHB:Wall of Ice')).toBe(10);
    expect(wallPanelFeet('XPHB:Wall of Fire')).toBeUndefined();
  });

  it('снап в узлы: ортогонально 2 клетки и полудиагональ 1×2, без 45° 2×2', () => {
    expect(snapWallJoint({ x: 0, y: 0 }, { x: 100, y: 10 }, 50)).toEqual({ x: 100, y: 0 });
    expect(snapWallJoint({ x: 0, y: 0 }, { x: 50, y: 90 }, 50)).toEqual({ x: 50, y: 100 });
    // Курсор ровно на 45°: шаг 2×2 запрещён — берём ближайшую полудиагональ.
    const diagonal = snapWallJoint({ x: 0, y: 0 }, { x: 100, y: 100 }, 50);
    expect(
      (diagonal.x === 50 && diagonal.y === 100) || (diagonal.x === 100 && diagonal.y === 50)
    ).toBe(true);
  });

  it('якорь садится на пересечение сетки (с учётом смещения)', () => {
    expect(snapWallAnchor({ x: 63, y: 38 }, 50)).toEqual({ x: 50, y: 50 });
    expect(snapWallAnchor({ x: 73, y: 43 }, 50, { x: 10, y: 5 })).toEqual({ x: 60, y: 55 });
  });

  it('валидация пути: шаги-узлы, лимит и дистанция панелей', () => {
    const caster = { x: 125, y: 125 };
    const path = [
      { x: 325, y: 125 },
      { x: 425, y: 125 },
      { x: 425, y: 225 },
    ];
    expect(wallPathIssue(path, 'XPHB:Wall of Ice', caster, grid, 120)).toBeUndefined();
    // Полудиагональ 1×2 разрешена.
    expect(
      wallPathIssue([{ x: 325, y: 125 }, { x: 375, y: 225 }], 'XPHB:Wall of Ice', caster, grid, 120)
    ).toBeUndefined();
    // 45° 2×2 запрещена.
    expect(
      wallPathIssue([{ x: 325, y: 125 }, { x: 425, y: 225 }], 'XPHB:Wall of Ice', caster, grid, 120)
    ).toEqual({ code: 'wallPathBad' });
    // Шаг в полторы клетки — не узел.
    expect(wallPathIssue([path[0]!, { x: 400, y: 125 }], 'XPHB:Wall of Ice', caster, grid, 120)).toEqual({
      code: 'wallPathBad',
    });
    // Панель за пределами дистанции каста.
    const far = [
      { x: 1400, y: 125 },
      { x: 1500, y: 125 },
    ];
    expect(wallPathIssue(far, 'XPHB:Wall of Ice', caster, grid, 120)).toMatchObject({ code: 'outOfRange' });
  });

  it('лимит панелей: одиннадцатая панель запрещена', () => {
    const path = Array.from({ length: 12 }, (_, i) => ({ x: 125 + i * panel, y: 125 }));
    expect(wallPathIssue(path, 'XPHB:Wall of Ice', { x: 125, y: 125 }, grid, 9999)).toEqual({ code: 'wallPathBad' });
  });
});
