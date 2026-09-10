import { describe, expect, it } from 'vitest';
import { DEFAULT_ABILITIES, normalizeSheet, type AbilityKey } from './types';
import {
  applyRest,
  autoResourceDefs,
  casterLevelOf,
  computedMaxHp,
  effectiveMaxHp,
  emptyResources,
  hitDiceMaxes,
  pactMax,
  sanitizeResources,
  sheetMods,
  spellSlotMaxes,
  syncResources,
} from './rules';

const mods = (over: Partial<Record<AbilityKey, number>> = {}) =>
  sheetMods({ ...DEFAULT_ABILITIES, ...over });

describe('casterLevelOf', () => {
  it('полный кастер = уровень', () => {
    expect(casterLevelOf([{ className: 'wizard', level: 5 }])).toBe(5);
  });

  it('полукастер = уровень/2 (вниз)', () => {
    expect(casterLevelOf([{ className: 'paladin', level: 6 }])).toBe(3);
    expect(casterLevelOf([{ className: 'ranger', level: 5 }])).toBe(2);
  });

  it('колдун (pact) не учитывается в caster level', () => {
    expect(casterLevelOf([{ className: 'warlock', level: 9 }])).toBe(0);
  });

  it('третье-кастер сабкласс = уровень/3 (вниз)', () => {
    expect(casterLevelOf([{ className: 'fighter', level: 6, subclass: 'eldritchKnight' }])).toBe(2);
    expect(casterLevelOf([{ className: 'rogue', level: 9, subclass: 'arcaneTrickster' }])).toBe(3);
  });

  it('мультикласс суммирует вклады', () => {
    expect(casterLevelOf([{ className: 'wizard', level: 3 }, { className: 'cleric', level: 2 }])).toBe(5);
    expect(casterLevelOf([{ className: 'paladin', level: 6 }, { className: 'sorcerer', level: 3 }])).toBe(6);
  });
});

describe('spellSlotMaxes', () => {
  it('полный кастер', () => {
    expect(spellSlotMaxes([{ className: 'wizard', level: 1 }])).toEqual([2]);
    expect(spellSlotMaxes([{ className: 'wizard', level: 5 }])).toEqual([4, 3, 2]);
  });

  it('мультикласс по общей таблице', () => {
    expect(spellSlotMaxes([{ className: 'cleric', level: 3 }, { className: 'paladin', level: 2 }])).toEqual([4, 3]);
  });

  it('без кастеров — пусто', () => {
    expect(spellSlotMaxes([{ className: 'barbarian', level: 5 }])).toEqual([]);
    expect(spellSlotMaxes([{ className: 'warlock', level: 5 }])).toEqual([]);
  });
});

describe('pactMax', () => {
  it('по уровню колдуна', () => {
    expect(pactMax([{ className: 'warlock', level: 1 }])).toEqual({ count: 1, level: 1 });
    expect(pactMax([{ className: 'warlock', level: 11 }])).toEqual({ count: 3, level: 5 });
    expect(pactMax([{ className: 'warlock', level: 20 }])).toEqual({ count: 4, level: 5 });
  });

  it('без колдуна — ноль', () => {
    expect(pactMax([{ className: 'wizard', level: 3 }])).toEqual({ count: 0, level: 0 });
  });
});

describe('hitDiceMaxes', () => {
  it('группирует по размеру кости', () => {
    expect(hitDiceMaxes([{ className: 'fighter', level: 3 }, { className: 'wizard', level: 2 }])).toEqual([
      { die: 10, max: 3 },
      { die: 6, max: 2 },
    ]);
  });
});

describe('autoResourceDefs', () => {
  it('базовые ресурсы классов', () => {
    expect(autoResourceDefs([{ className: 'barbarian', level: 1 }], mods()).find((d) => d.key === 'barbarian:rage')?.max).toBe(2);
    expect(autoResourceDefs([{ className: 'monk', level: 7 }], mods()).find((d) => d.key === 'monk:focus')?.max).toBe(7);
    expect(autoResourceDefs([{ className: 'paladin', level: 4 }], mods()).find((d) => d.key === 'paladin:layOnHands')?.max).toBe(20);
  });

  it('ресурс от модификатора (Bardic Inspiration = мод. Харизмы, мин 1)', () => {
    const d = autoResourceDefs([{ className: 'bard', level: 1 }], mods({ cha: 16 }));
    expect(d.find((r) => r.key === 'bard:bardicInspiration')?.max).toBe(3);
  });

  it('ключи разных классов не конфликтуют', () => {
    const d = autoResourceDefs([{ className: 'cleric', level: 2 }, { className: 'paladin', level: 3 }], mods());
    const keys = d.map((r) => r.key);
    expect(keys).toContain('cleric:channelDivinity');
    expect(keys).toContain('paladin:channelDivinity');
  });

  it('подклассовые ресурсы', () => {
    const d = autoResourceDefs([{ className: 'fighter', level: 3, subclass: 'battleMaster' }], mods());
    expect(d.find((r) => r.key === 'fighter.battleMaster:superiorityDice')?.max).toBe(4);
  });

  it('Light domain: Warding Flare = мод. Мудрости', () => {
    const d = autoResourceDefs([{ className: 'cleric', level: 3, subclass: 'light' }], mods({ wis: 16 }));
    expect(d.find((r) => r.key === 'cleric.light:wardingFlare')?.max).toBe(3);
  });
});

describe('computedMaxHp', () => {
  it('1-й уровень: кость хитов + мод. Телосложения', () => {
    expect(computedMaxHp([{ className: 'fighter', level: 1 }], { ...DEFAULT_ABILITIES, con: 14 })).toBe(12);
  });

  it('далее среднее кости + мод.', () => {
    expect(computedMaxHp([{ className: 'fighter', level: 3 }], { ...DEFAULT_ABILITIES, con: 14 })).toBe(28);
  });

  it('мультикласс учитывает кости обоих классов', () => {
    expect(
      computedMaxHp([{ className: 'wizard', level: 1 }, { className: 'barbarian', level: 1 }], { ...DEFAULT_ABILITIES })
    ).toBe(13);
  });
});

describe('effectiveMaxHp', () => {
  it('ручное значение из карточки перекрывает авто', () => {
    const sheet = normalizeSheet({
      classes: [{ className: 'fighter', level: 1 }],
      abilities: { ...DEFAULT_ABILITIES, con: 14 },
      hpMax: '50',
    });
    expect(effectiveMaxHp(sheet)).toBe(50);
  });

  it('пусто — авто-расчёт', () => {
    const sheet = normalizeSheet({ classes: [{ className: 'fighter', level: 1 }], abilities: { ...DEFAULT_ABILITIES, con: 14 } });
    expect(effectiveMaxHp(sheet)).toBe(12);
  });
});

describe('syncResources', () => {
  it('full: ячейки и авто-ресурсы к max, кастом и HP не трогаются', () => {
    const prev = emptyResources();
    prev.hp = { current: 10, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 };
    prev.resources.push({ id: 'c', name: 'Кастом', current: 5, max: 5, reset: 'long' });
    const s = syncResources(prev, [{ className: 'wizard', level: 3 }], mods(), 'full');
    expect(s.spellSlots.map((x) => x.max)).toEqual([4, 2]);
    expect(s.spellSlots.every((x) => x.current === x.max)).toBe(true);
    expect(s.hitDice).toEqual([{ die: 6, max: 3, current: 3 }]);
    expect(s.resources.find((r) => !r.auto)?.name).toBe('Кастом');
    expect(s.hp.current).toBe(10);
  });

  it('soft: current зажимается при уменьшении max', () => {
    const prev = emptyResources();
    prev.spellSlots = [
      { level: 1, current: 4, max: 4 },
      { level: 2, current: 2, max: 2 },
    ];
    const s = syncResources(prev, [{ className: 'wizard', level: 1 }], mods(), 'soft');
    expect(s.spellSlots).toEqual([{ level: 1, current: 2, max: 2 }]);
  });

  it('soft: сохраняет current у авто-ресурса при том же ключе', () => {
    const classes = [{ className: 'monk', level: 5 }];
    const prev = emptyResources();
    prev.resources = [{ id: 'k', key: 'monk:focus', name: 'Очки сосредоточения', current: 2, max: 5, reset: 'short', auto: true }];
    const s = syncResources(prev, classes, mods(), 'soft');
    expect(s.resources.find((r) => r.key === 'monk:focus')?.current).toBe(2);
  });
});

describe('sanitizeResources', () => {
  it('максимумы из правил, значения зажаты', () => {
    const input = emptyResources();
    input.resources = [
      { id: 'x', key: 'monk:focus', name: 'hack', current: 99, max: 99, reset: 'short', auto: true },
      { id: 'c', name: 'Свой', current: 10, max: 3, reset: 'long' },
    ];
    input.hp = { current: 50, max: 10, temp: -5, deathSuccesses: 9, deathFailures: 9 };
    const s = sanitizeResources(input, [{ className: 'monk', level: 5 }], mods());
    const focus = s.resources.find((r) => r.key === 'monk:focus');
    expect(focus?.max).toBe(5);
    expect(focus?.current).toBe(5);
    expect(s.resources.find((r) => !r.auto)?.current).toBe(3);
    expect(s.hp.current).toBe(10);
    expect(s.hp.temp).toBe(0);
    expect(s.hp.deathSuccesses).toBe(3);
  });
});

describe('applyRest', () => {
  it('короткий отдых: short-ресурсы и pact, ячейки не трогает', () => {
    const res = emptyResources();
    res.pact = { current: 0, max: 2, level: 1 };
    res.spellSlots = [{ level: 1, current: 0, max: 2 }];
    res.resources = [
      { id: 'a', name: 'Rage', current: 0, max: 3, reset: 'short' },
      { id: 'b', name: 'LoH', current: 0, max: 10, reset: 'long' },
    ];
    const s = applyRest(res, 'short');
    expect(s.resources.find((r) => r.id === 'a')?.current).toBe(3);
    expect(s.resources.find((r) => r.id === 'b')?.current).toBe(0);
    expect(s.pact.current).toBe(2);
    expect(s.spellSlots[0].current).toBe(0);
  });

  it('долгий отдых: всё по max и HP', () => {
    const res = emptyResources();
    res.hp = { current: 3, max: 20, temp: 5, deathSuccesses: 2, deathFailures: 1 };
    res.hitDice = [{ die: 10, current: 0, max: 3 }];
    res.spellSlots = [{ level: 1, current: 0, max: 2 }];
    res.resources = [{ id: 'b', name: 'LoH', current: 0, max: 10, reset: 'long' }];
    const s = applyRest(res, 'long');
    expect(s.hp).toEqual({ current: 20, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 });
    expect(s.hitDice[0].current).toBe(3);
    expect(s.spellSlots[0].current).toBe(2);
    expect(s.resources[0].current).toBe(10);
  });
});
