import { describe, expect, it } from 'vitest';
import type { RawBestiaryMonster } from '../domain/bestiary';
import {
  bestiaryEntryFromRaw,
  bestiaryTokenFields,
  parseAttackText,
  parseDamageDefenses,
  parseMultiattack,
  parseSaveText,
  parseSpellcasting,
  slugId,
} from './bestiary';

const WOLF: RawBestiaryMonster = {
  name: 'Wolf',
  source: 'XMM',
  size: ['M'],
  type: 'beast',
  cr: '1/4',
  familiar: true,
  ac: [14],
  hp: { average: 11, formula: '2d8 + 2' },
  speed: { walk: 40 },
  str: 14,
  dex: 15,
  con: 12,
  int: 3,
  wis: 12,
  cha: 6,
  senses: ['Darkvision 60 ft.'],
  trait: [{ name: 'Pack Tactics', entries: ['The wolf has {@variantrule Advantage|XPHB} while an ally is near.'] }],
  action: [
    {
      name: 'Bite',
      entries: [
        '{@atkr m} {@hit 4}, reach 5 ft. {@h}5 ({@damage 1d6 + 2}) Piercing damage. If the target is a Large or smaller creature, it has the {@condition Prone|XPHB} condition.',
      ],
    },
  ],
};

const GOBLIN: RawBestiaryMonster = {
  name: 'Goblin Warrior',
  source: 'XMM',
  size: ['S'],
  type: 'fey',
  cr: '1/4',
  ac: [15],
  hp: { average: 10, formula: '3d6' },
  speed: { walk: 30 },
  action: [
    {
      name: 'Scimitar',
      entries: [
        '{@atkr m} {@hit 4}, reach 5 ft. {@h}5 ({@damage 1d6 + 2}) Slashing damage, plus 2 ({@damage 1d4}) Slashing damage if the attack roll had {@variantrule Advantage|XPHB}.',
      ],
    },
    {
      name: 'Shortbow',
      entries: ['{@atkr r} {@hit 4}, range 80/320 ft. {@h}5 ({@damage 1d6 + 2}) Piercing damage.'],
    },
  ],
  bonus: [{ name: 'Nimble Escape', entries: ['The goblin takes the {@action Disengage|XPHB} action.'] }],
};

const DRAGON: RawBestiaryMonster = {
  name: 'Adult Red Dragon',
  source: 'XMM',
  size: ['H'],
  type: 'dragon',
  cr: '17',
  ac: [19],
  hp: { average: 256, formula: '19d12 + 133' },
  speed: { walk: 40, fly: 80 },
  str: 27,
  dex: 10,
  con: 25,
  int: 16,
  wis: 13,
  cha: 23,
  save: { dex: '+6', wis: '+7' },
  senses: ['Blindsight 60 ft.', 'Darkvision 120 ft.'],
  immune: ['fire'],
  action: [
    { name: 'Multiattack', entries: ['The dragon makes three Rend attacks.'] },
    {
      name: 'Rend',
      entries: ['{@atkr m} {@hit 14}, reach 10 ft. {@h}13 ({@damage 1d10 + 8}) Slashing damage plus 5 ({@damage 2d4}) Fire damage.'],
    },
    {
      name: 'Fire Breath {@recharge 5}',
      entries: [
        '{@actSave dex} {@dc 21}, each creature in a 60-foot {@variantrule Cone [Area of Effect]|XPHB|Cone}. {@actSaveFail} 59 ({@damage 17d6}) Fire damage. {@actSaveSuccess} Half damage.',
      ],
    },
  ],
  legendary: [
    { name: 'Pounce', entries: ['The dragon moves up to half its Speed.'] },
    { name: 'Wing Attack', entries: ['Costs 2 Actions. The dragon beats its wings.'] },
  ],
  spellcasting: [
    {
      name: 'Spellcasting',
      headerEntries: ['The dragon casts one of the following spells (spell save {@dc 20}, {@hit 12} to hit with spell attacks):'],
      will: ['{@spell Command|XPHB}'],
      daily: { 1: ['{@spell Fireball|XPHB}'] },
      ability: 'cha',
    },
  ],
};

const SPIRIT: RawBestiaryMonster = {
  name: 'Bestial Spirit',
  source: 'XPHB',
  size: ['S'],
  type: 'beast',
  cr: '—',
  ac: [{ special: "11 + the spell's level" }],
  hp: { special: '20 (Air only) or 30 (Land and Water only) + 5 for each spell level above 2' },
  speed: { walk: 30, fly: 60 },
  action: [
    { name: 'Multiattack', entries: ["The spirit makes a number of Rend attacks equal to half this spell's level (round down)."] },
    {
      name: 'Rend',
      entries: ['{@atkr m} {@hitYourSpellAttack Bonus equals your spell attack modifier}, reach 5 ft. {@h}{@damage 1d8 + 4 + summonSpellLevel} Piercing damage.'],
    },
  ],
};

const PIRANHA: RawBestiaryMonster = {
  name: 'Piranha',
  source: 'XMM',
  size: ['T'],
  type: 'beast',
  cr: '0',
  ac: [13],
  hp: { average: 1, formula: '1d4 - 1' },
  speed: { walk: 0, swim: 40 },
  action: [
    {
      name: 'Bite',
      entries: ["{@atkr m} {@hit 5}, reach 5 ft. {@h}1 Piercing damage."],
    },
  ],
};

const SKELETON: RawBestiaryMonster = {
  name: 'Skeleton',
  source: 'XMM',
  size: ['M'],
  type: 'undead',
  cr: '1/4',
  ac: [14],
  hp: { average: 13, formula: '2d8 + 4' },
  speed: { walk: 30 },
  immune: ['poison'],
  resist: [],
  vulnerable: ['bludgeoning'],
  action: [
    {
      name: 'Shortsword',
      entries: ['{@atkr m} {@hit 5}, reach 5 ft. {@h}6 ({@damage 1d6 + 3}) Piercing damage.'],
    },
  ],
};

const known = new Set(['XPHB:Command', 'XPHB:Fireball', 'XPHB:Detect Magic']);

describe('бестиарий: разбор атак', () => {
  it('условный довесок не входит в урон', () => {
    const entry = bestiaryEntryFromRaw(GOBLIN, known)!;
    expect(entry.attacks[0]).toMatchObject({ name: 'Scimitar', hit: '+4', damage: '1d6 + 2', damageType: 'slashing', rangeType: 'melee' });
    expect(entry.attacks[1]).toMatchObject({ name: 'Shortbow', rangeType: 'ranged', rangeNormal: 80, rangeLong: 320 });
  });

  it('части урона сливаются, инотипные — с суффиксом типа', () => {
    const text = 'Melee Attack Roll: +14, reach 10 ft. Hit: 13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage.';
    expect(parseAttackText(text)).toMatchObject({
      hit: '+14',
      reach: 10,
      damage: '1d10 + 8 + 2d4fire',
      damageType: 'slashing',
      melee: true,
      ranged: false,
    });
  });

  it('урон без костей парсится как фиксированный', () => {
    const entry = bestiaryEntryFromRaw(PIRANHA, known)!;
    expect(entry.attacks[0]).toMatchObject({ name: 'Bite', damage: '1', damageType: 'piercing' });
    expect(entry.speed).toBe(40);
    expect(entry.cells).toBe(1);
  });

  it('мультиатака числом слов', () => {
    expect(parseMultiattack('The dragon makes three Rend attacks.')).toBe(3);
    expect(parseMultiattack("The spirit makes a number of Rend attacks equal to half this spell's level")).toBeUndefined();
  });
});

describe('бестиарий: сейвы и эффекты', () => {
  it('сейв с областью, уроном и перезарядкой', () => {
    const entry = bestiaryEntryFromRaw(DRAGON, known)!;
    const breath = entry.actions.find((a) => a.name === 'Fire Breath')!;
    expect(breath.recharge).toBe(5);
    expect(breath.ability?.save).toEqual({ ability: 'dex' });
    expect(breath.ability?.dc).toBe(21);
    expect(breath.ability?.damage).toEqual({ dice: '17d6', types: ['fire'] });
    expect(breath.targeting).toMatchObject({ kind: 'area', area: { shape: 'cone', size: 60 } });
  });

  it('укус волка: атака с prone уходит в действия, а не в быстрые атаки', () => {
    const entry = bestiaryEntryFromRaw(WOLF, known)!;
    expect(entry.abilities.str).toBe(14);
    expect(entry.saves).toBeUndefined();
    expect(entry.attacks).toEqual([]);
    const bite = entry.actions.find((a) => a.name === 'Bite')!;
    expect(bite.ability?.attack).toMatchObject({ rangeType: 'melee', damage: '1d6 + 2', types: ['piercing'] });
    expect(bite.ability?.effects).toEqual([{ condition: 'prone', duration: { type: 'endOfTurn', of: 'target' } }]);
  });

  it('легендарные: максимум 3 и стоимость из текста', () => {
    const entry = bestiaryEntryFromRaw(DRAGON, known)!;
    expect(entry.legendaryMax).toBe(3);
    const wing = entry.actions.find((a) => a.name === 'Wing Attack')!;
    expect(wing.legendaryCost).toBe(2);
    expect(wing.costs).toEqual([]);
  });

  it('сейв без урона не теряет сам бросок', () => {
    const save = parseSaveText('Wisdom Saving Throw: DC 16, one creature within 60 feet. Failure: The target has the Frightened condition until the end of its next turn.');
    expect(save?.ability).toBe('wis');
    expect(save?.effects).toEqual([{ condition: 'frightened', duration: { type: 'endOfTurn', of: 'target' } }]);
  });
});

describe('бестиарий: заклинания и запись целиком', () => {
  it('ключи заклинаний сопоставляются с каталогом', () => {
    const entry = bestiaryEntryFromRaw(DRAGON, known)!;
    expect(entry.spellcasting).toMatchObject({ ability: 'cha', dc: 20, attack: 12 });
    expect(entry.spellcasting?.spells).toEqual(['XPHB:Command', 'XPHB:Fireball']);
  });

  it('без совпадений по каталогу каст не выдумывается', () => {
    expect(parseSpellcasting({ will: ['{@spell Etherealness|XPHB}'], ability: 'cha' }, new Set())).toBeUndefined();
  });

  it('шаблон призыва: скейл HP/AC, атака от кастера (spell attack)', () => {
    const entry = bestiaryEntryFromRaw(SPIRIT, known)!;
    expect(entry.key).toBe('XPHB:Bestial Spirit');
    expect(entry.hpAverage).toBe(20);
    expect(entry.hpFormula).toBe('');
    expect(entry.summon).toMatchObject({ hpPerLevel: 5, baseLevel: 2, acPerLevel: 1, spellAttack: true });
    expect(entry.ac).toBe(13);
    expect(entry.attacks[0]).toMatchObject({ hit: '+0', damage: '1d8 + 4 + summonSpellLevel', damageType: 'piercing' });
    expect(entry.description).toContain('Rend');
  });

  it('слаг для id', () => {
    expect(slugId('Fire Breath')).toBe('fire-breath');
  });

  it('описание внешности строится из имени/статов', () => {
    expect(bestiaryEntryFromRaw(WOLF, known)!.appearance).toContain('fangs');
    expect(bestiaryEntryFromRaw(DRAGON, known)!.appearance).toContain('wings');
    expect(bestiaryEntryFromRaw(SKELETON, known)!.appearance).toContain('bones');
    expect(bestiaryEntryFromRaw(SPIRIT, known)!.appearance.length).toBeGreaterThan(10);
  });
});

describe('бестиарий: защита и выставление', () => {
  it('защиты берутся только каноническими типами', () => {
    expect(parseDamageDefenses(['Poison', 'bludgeoning', { resist: ['cold'], note: 'from nonmagical attacks' }], new Set(['poison', 'bludgeoning']))).toEqual(['poison', 'bludgeoning']);
    const entry = bestiaryEntryFromRaw(SKELETON, known)!;
    expect(entry.immunities).toEqual(['poison']);
    expect(entry.resistances).toEqual([]);
    expect(entry.vulnerabilities).toEqual(['bludgeoning']);
  });

  it('поля токена: HP/AC строками, инициатива от Ловкости, защиты и статблок', () => {
    const entry = bestiaryEntryFromRaw(DRAGON, known)!;
    const fields = bestiaryTokenFields(entry);
    expect(fields).toMatchObject({ name: 'Adult Red Dragon', ac: '19', hpMax: '256', cells: 3, initiativeBonus: '+0', isPlayerToken: false });
    expect(fields.description.length).toBeLessThanOrEqual(200);
    expect(fields.damageDefenses).toEqual([
      { id: 'xmm:adult-red-dragon:immunity:fire', type: 'immunity', damageType: 'fire' },
    ]);
    expect(fields.statblock).toMatchObject({ multiattack: 3, legendary: { max: 3, actions: [] } });
    expect(fields.statblock?.actions?.some((a) => a.name === 'Fire Breath')).toBe(true);
    expect(fields.attacks[0]).toMatchObject({ name: 'Rend', damage: '1d10 + 8 + 2d4fire' });
  });

  it('спавн призыва: HP/AC/атака скейлятся от круга и кастера', () => {
    const entry = bestiaryEntryFromRaw(SPIRIT, known)!;
    const fields = bestiaryTokenFields(entry, { slotLevel: 4, spellAttackBonus: 7 });
    expect(fields.hpMax).toBe('30');
    expect(fields.ac).toBe('15');
    expect(fields.attacks[0]).toMatchObject({ hit: '+7', damage: '1d8 + 4 + 4' });
  });
});
