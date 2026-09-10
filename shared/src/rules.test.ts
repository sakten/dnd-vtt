import { describe, expect, it } from 'vitest';
import { DEFAULT_ABILITIES, normalizeSheet, type AbilityKey } from './types';
import {
  applyRest,
  autoResourceDefs,
  casterLevelOf,
  classSaves,
  computedMaxHp,
  effectiveMaxHp,
  emptyResources,
  hitDiceMaxes,
  initiativeBonus,
  pactMax,
  proficiencyBonus,
  sanitizeResources,
  sheetMods,
  spellSlotMaxes,
  subclassList,
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

describe('proficiencyBonus', () => {
  it('по уровню персонажа', () => {
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(4)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(9)).toBe(4);
    expect(proficiencyBonus(13)).toBe(5);
    expect(proficiencyBonus(17)).toBe(6);
  });
});

describe('subclass resources', () => {
  it('Zealot: пул костей Воина богов растёт на 6/12/17', () => {
    const key = 'barbarian.zealot:warriorOfTheGods';
    const at = (level: number) =>
      autoResourceDefs([{ className: 'barbarian', level, subclass: 'zealot' }], mods()).find((r) => r.key === key)?.max;
    expect(at(3)).toBe(4);
    expect(at(6)).toBe(5);
    expect(at(12)).toBe(6);
    expect(at(17)).toBe(7);
  });

  it('Battle Master: кости превосходства на 7/15, а не на 8', () => {
    const at = (level: number) =>
      autoResourceDefs([{ className: 'fighter', level, subclass: 'battleMaster' }], mods()).find(
        (r) => r.key === 'fighter.battleMaster:superiorityDice'
      )?.max;
    expect(at(3)).toBe(4);
    expect(at(6)).toBe(4);
    expect(at(7)).toBe(5);
    expect(at(15)).toBe(6);
  });

  it('Psi Warrior / Soulknife: кости пси-энергии по таблице', () => {
    const psi = (level: number) =>
      autoResourceDefs([{ className: 'fighter', level, subclass: 'psiWarrior' }], mods()).find(
        (r) => r.key === 'fighter.psiWarrior:psionicEnergyDice'
      )?.max;
    expect(psi(3)).toBe(4);
    expect(psi(5)).toBe(6);
    expect(psi(11)).toBe(8);
    expect(psi(17)).toBe(12);
    const soul = autoResourceDefs([{ className: 'rogue', level: 9, subclass: 'soulknife' }], mods()).find(
      (r) => r.key === 'rogue.soulknife:psionicEnergyDice'
    );
    expect(soul?.max).toBe(8);
    expect(soul?.reset).toBe('short');
  });

  it('пулы по профишенси-бонусу используют суммарный уровень персонажа', () => {
    const solo = autoResourceDefs([{ className: 'rogue', level: 3, subclass: 'phantom' }], mods()).find(
      (r) => r.key === 'rogue.phantom:wailsFromTheGrave'
    );
    expect(solo?.max).toBe(2);
    const multi = autoResourceDefs(
      [{ className: 'rogue', level: 3, subclass: 'phantom' }, { className: 'fighter', level: 3 }],
      mods()
    ).find((r) => r.key === 'rogue.phantom:wailsFromTheGrave');
    expect(multi?.max).toBe(3);
  });

  it('Light: Warding Flare перезаряжается на коротком отдыхе с 6 ур., Corona — по Мудрости', () => {
    const at = (level: number) =>
      autoResourceDefs([{ className: 'cleric', level, subclass: 'light' }], mods({ wis: 16 })).find(
        (r) => r.key === 'cleric.light:wardingFlare'
      );
    expect(at(3)?.reset).toBe('long');
    expect(at(6)?.reset).toBe('short');
    const corona = autoResourceDefs([{ className: 'cleric', level: 17, subclass: 'light' }], mods({ wis: 18 })).find(
      (r) => r.key === 'cleric.light:coronaOfLight'
    );
    expect(corona?.max).toBe(4);
  });

  it('War Domain: War Priest перезаряжается на коротком отдыхе', () => {
    const def = autoResourceDefs([{ className: 'cleric', level: 3, subclass: 'war' }], mods({ wis: 14 })).find(
      (r) => r.key === 'cleric.war:warPriest'
    );
    expect(def?.max).toBe(2);
    expect(def?.reset).toBe('short');
  });

  it('Diviner: число предзнаменований 2, с 14 ур. — 3', () => {
    const at = (level: number) =>
      autoResourceDefs([{ className: 'wizard', level, subclass: 'diviner' }], mods()).find(
        (r) => r.key === 'wizard.diviner:portent'
      )?.max;
    expect(at(3)).toBe(2);
    expect(at(14)).toBe(3);
  });

  it('Circle of Dreams: пул костей равен уровню друида', () => {
    const def = autoResourceDefs([{ className: 'druid', level: 6, subclass: 'dreams' }], mods()).find(
      (r) => r.key === 'druid.dreams:balmOfTheSummerCourt'
    );
    expect(def?.max).toBe(6);
  });
});

describe('subclassList', () => {
  it('содержит источник подкласса', () => {
    const rogue = subclassList('rogue');
    expect(rogue.find((s) => s.key === 'soulknife')?.source).toBe('PHB');
    expect(rogue.find((s) => s.key === 'swashbuckler')?.source).toBe('XGE');
    expect(subclassList('artificer').every((s) => s.source === 'TCE')).toBe(true);
  });
});

describe('classSaves', () => {
  it('даёт профишенси спасбросков класса', () => {
    expect(classSaves('fighter')).toEqual(['str', 'con']);
    expect(classSaves('wizard')).toEqual(['int', 'wis']);
    expect(classSaves('paladin')).toEqual(['wis', 'cha']);
    expect(classSaves('unknown')).toEqual([]);
  });
});

describe('одноразовые способности', () => {
  const find = (classes: Parameters<typeof autoResourceDefs>[0], key: string) =>
    autoResourceDefs(classes, mods()).find((r) => r.key === key);

  it('max = 0 до уровня разблокировки и 1 после', () => {
    expect(find([{ className: 'barbarian', level: 13, subclass: 'berserker' }], 'barbarian.berserker:intimidatingPresence')?.max).toBe(0);
    const at14 = find([{ className: 'barbarian', level: 14, subclass: 'berserker' }], 'barbarian.berserker:intimidatingPresence');
    expect(at14?.max).toBe(1);
    expect(at14?.reset).toBe('long');
  });

  it('Hexblade: проклятие на коротком отдыхе с 1 ур.', () => {
    const curse = find([{ className: 'warlock', level: 1, subclass: 'hexblade' }], 'warlock.hexblade:hexbladesCurse');
    expect(curse?.max).toBe(1);
    expect(curse?.reset).toBe('short');
    expect(find([{ className: 'warlock', level: 5, subclass: 'hexblade' }], 'warlock.hexblade:accursedSpecter')?.max).toBe(0);
    expect(find([{ className: 'warlock', level: 6, subclass: 'hexblade' }], 'warlock.hexblade:accursedSpecter')?.max).toBe(1);
  });

  it('Divine Soul: Favored by the Gods с 1 ур., короткий отдых', () => {
    const d = find([{ className: 'sorcerer', level: 1, subclass: 'divineSoul' }], 'sorcerer.divineSoul:favoredByTheGods');
    expect(d?.max).toBe(1);
    expect(d?.reset).toBe('short');
  });

  it('капстоуны паладинов открываются на 20 ур.', () => {
    expect(find([{ className: 'paladin', level: 19, subclass: 'devotion' }], 'paladin.devotion:holyNimbus')?.max).toBe(0);
    expect(find([{ className: 'paladin', level: 20, subclass: 'devotion' }], 'paladin.devotion:holyNimbus')?.max).toBe(1);
  });

  it('переменный пул и одноразовая на одном подклассе сосуществуют', () => {
    const keys = autoResourceDefs([{ className: 'fighter', level: 15, subclass: 'psiWarrior' }], mods()).map((r) => r.key);
    expect(keys).toContain('fighter.psiWarrior:psionicEnergyDice');
    expect(keys).toContain('fighter.psiWarrior:bulwarkOfForce');
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

  it('заметки сохраняются при sync/sanitize/отдыхе', () => {
    const res = emptyResources();
    res.notes = 'про дракона';
    expect(syncResources(res, [], mods(), 'soft').notes).toBe('про дракона');
    expect(applyRest(res, 'long').notes).toBe('про дракона');
    expect(sanitizeResources(res, [], mods()).notes).toBe('про дракона');
  });
});

describe('initiativeBonus', () => {
  const players = [
    { id: 'p1', name: 'Игрок' },
    { id: 'p2', name: 'Другой' },
  ];
  const sheets = { p1: normalizeSheet({ abilities: { ...DEFAULT_ABILITIES, dex: 16 } }) };

  it('явный бонус токена важнее листа', () => {
    expect(initiativeBonus({ name: 'Игрок', initiativeBonus: '+7', ownerId: 'p2' }, players, sheets)).toBe('+7');
  });

  it('имя токена совпадает с именем игрока — берём его Ловкость', () => {
    expect(initiativeBonus({ name: 'Игрок', initiativeBonus: '', ownerId: 'p2' }, players, sheets)).toBe('+3');
  });

  it('нет совпадения — фолбэк на лист владельца', () => {
    expect(initiativeBonus({ name: 'Волк', initiativeBonus: '', ownerId: 'p1' }, players, sheets)).toBe('+3');
  });

  it('нет листа — пусто', () => {
    expect(initiativeBonus({ name: 'Статуя', initiativeBonus: '', ownerId: 'p2' }, players, sheets)).toBe('');
  });
});
