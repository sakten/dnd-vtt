import { describe, expect, it } from 'vitest';
import spellsRaw from '../data/spells.json';
import { automationForSpell } from './automation';
import type { Spell } from './spells';

/**
 * Поведенческий замок спеков (R16): проверяет не равенство билдерам, а правильность
 * механики на реальных данных `spells.json` через боевой путь `automationForSpell`
 * (derive → resolveSpec → compileSpec). Ожидания — RAW, а не текущий код.
 */
const SPELLS = (spellsRaw as unknown as { spells: Spell[] }).spells;
const find = (key: string): Spell => {
  const spell = SPELLS.find((s) => s.key === key);
  if (!spell) throw new Error(`нет заклинания ${key}`);
  return spell;
};

describe('поведение спеков (RAW, реальные данные)', () => {
  it('Command: halt — скорость 0 и запрет действий; grovel — ещё и prone; approach — без обоих', () => {
    const spell = find('XPHB:Command');
    const halt = automationForSpell(spell, { variant: 'halt' });
    const haltEffect = halt.effects?.[0];
    expect(halt.save).toEqual({ ability: 'wis' });
    expect(halt.excludeCreatureTypes).toEqual(['undead']);
    expect(haltEffect?.targets).toBe(1);
    expect(haltEffect?.duration).toEqual({ type: 'endOfTurn', of: 'target' });
    expect(haltEffect?.restrictions).toEqual({ noActions: true, noBonus: true });
    expect(haltEffect?.modifiers).toEqual([{ target: 'speed', mode: 'multiply', value: 0 }]);
    expect(haltEffect?.conditions).toBeUndefined();

    const grovel = automationForSpell(spell, { variant: 'grovel' }).effects?.[0];
    expect(grovel?.conditions).toEqual(['prone']);
    expect(grovel?.modifiers).toHaveLength(1);

    const approach = automationForSpell(spell, { variant: 'approach' }).effects?.[0];
    expect(approach?.modifiers).toEqual([]);
    expect(approach?.conditions).toBeUndefined();
  });

  it("Dragon's Breath: действие-выдох — спас DEX, область из данных, тип из выбора", () => {
    const spell = find("XPHB:Dragon's Breath");
    const def = automationForSpell(spell, { castLevel: 2, variant: 'cold' });
    const action = def.effects?.[0]?.actions?.[0];
    expect(def.effects?.[0]?.variant).toBe('cold');
    expect(action).toMatchObject({ cost: 'action' });
    expect(action?.def?.resolution).toBe('save');
    expect(action?.def?.save).toEqual({ ability: 'dex', half: true });
    expect(action?.def?.area).toEqual({ shape: 'cone', size: 15 });
    expect(action?.def?.targeting).toEqual({ kind: 'area', area: { shape: 'cone', size: 15 }, range: 15 });
    expect(action?.def?.damage?.types).toEqual(['cold']);
    expect(action?.def?.damage?.dice).toMatch(/^\d+d\d+$/);
  });

  it('Fire Shield: warm — сопротивление холоду и ответ огнём; chill — наоборот', () => {
    const spell = find('XPHB:Fire Shield');
    const warm = automationForSpell(spell, { variant: 'warm' }).effects?.[0];
    expect(warm?.modifiers).toEqual([
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'cold' } },
    ]);
    expect(warm?.retaliate).toEqual({ damageType: 'fire', dice: '2d8' });

    const chill = automationForSpell(spell, { variant: 'chill' }).effects?.[0];
    expect(chill?.modifiers).toEqual([
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'fire' } },
    ]);
    expect(chill?.retaliate).toEqual({ damageType: 'cold', dice: '2d8' });
  });

  it('Protection from Energy: сопротивление выбранному типу, концентрация', () => {
    const spell = find('XPHB:Protection from Energy');
    const def = automationForSpell(spell, { variant: 'thunder' });
    expect(def.concentration).toBe(true);
    expect(def.effects?.[0]?.variant).toBe('thunder');
    expect(def.effects?.[0]?.modifiers).toEqual([
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'thunder' } },
    ]);
  });

  it('Spirit Shroud: аура 10 фт — −10 скорости и шаг типа с апкастом каждые 2 круга', () => {
    const spell = find('TCE:Spirit Shroud');
    const base = automationForSpell(spell, { castLevel: 3, variant: 'necrotic' });
    expect(base.zone?.area).toEqual({ shape: 'sphere', size: 10 });
    expect(base.zone?.origin).toBe('self');
    expect(base.zone?.anchor).toBe('source');
    expect(base.zone?.side).toBe('hostile');
    const aura = base.zone?.aura?.effects?.[0];
    expect(aura?.modifiers).toEqual([{ target: 'speed', mode: 'add', value: -10 }]);
    expect(aura?.takesExtraDamage).toEqual({ dice: '1d8', damageType: 'necrotic' });

    // Апкаст: выше 3 круга каждые два уровня +1к8 (5 → 2d8, 7 → 3d8).
    expect(
      automationForSpell(spell, { castLevel: 5, variant: 'radiant' }).zone?.aura?.effects?.[0]?.takesExtraDamage
    ).toEqual({ dice: '2d8', damageType: 'radiant' });
    expect(automationForSpell(spell, { castLevel: 7 }).zone?.aura?.effects?.[0]?.takesExtraDamage?.dice).toBe('3d8');
    // Без выбора — первый тип варианта.
    expect(automationForSpell(spell, { castLevel: 3 }).zone?.aura?.effects?.[0]?.variant).toBe('cold');
  });

  it('Spirit Guardians: выбор урона (излучение/некротика) во всех частях', () => {
    const spell = find('XPHB:Spirit Guardians');
    // Без выбора — излучение (добрый/нейтральный кастер).
    expect(automationForSpell(spell).damage?.types).toEqual(['radiant']);
    const necrotic = automationForSpell(spell, { variant: 'necrotic' });
    expect(necrotic.damage?.types).toEqual(['necrotic']);
    expect(necrotic.zone?.triggers?.enter?.damage?.types).toEqual(['necrotic']);
    expect(necrotic.zone?.triggers?.startOfTurn?.damage?.types).toEqual(['necrotic']);
  });

  it('Destructive Wave: составной урон (гром + тип выбора), prone при провале', () => {
    const spell = find('XPHB:Destructive Wave');
    const radiant = automationForSpell(spell, { variant: 'radiant' });
    expect(radiant.save).toEqual({ ability: 'con', half: true });
    expect(radiant.damage).toEqual({ dice: '5d6thunder + 5d6radiant', types: ['thunder', 'radiant'] });
    expect(radiant.effects?.[0]?.conditions).toEqual(['prone']);
    expect(automationForSpell(spell, { variant: 'necrotic' }).damage).toEqual({
      dice: '5d6thunder + 5d6necrotic',
      types: ['thunder', 'necrotic'],
    });
    // Без выбора — тип по умолчанию (излучение).
    expect(automationForSpell(spell).damage?.types).toEqual(['thunder', 'radiant']);
  });

  it('Wall of Fire: полоса 60×10 / кольцо r10, 5d8 огнём (+1d8/круг), мгла и триггеры', () => {
    const spell = find('XPHB:Wall of Fire');
    const vertical = automationForSpell(spell, { variant: 'vertical' });
    expect(vertical.zone?.area).toEqual({ shape: 'line', size: 60, width: 10 });
    expect(vertical.zone?.origin).toBe('point');
    expect(vertical.zone?.enterOncePerTurn).toBe(true);
    expect(vertical.damage).toEqual({ dice: '5d8fire', types: ['fire'] });
    expect(vertical.zone?.triggers?.enter?.save).toEqual({ ability: 'dex', half: true });
    expect(vertical.zone?.triggers?.enter?.damage).toEqual({ dice: '5d8fire', types: ['fire'] });
    expect(vertical.zone?.triggers?.endOfTurn?.damage).toEqual({ dice: '5d8fire', types: ['fire'] });
    expect(vertical.zone?.flags).toEqual({ obscured: 'heavy' });
    // Кольцо: внешний радиус 10, свободная середина 5; апкаст +1d8/круг.
    expect(automationForSpell(spell, { variant: 'ring' }).zone?.area).toEqual({ shape: 'ring', size: 10, inner: 5 });
    expect(automationForSpell(spell, { castLevel: 6, variant: 'vertical' }).damage?.dice).toBe('7d8fire');
  });

  it('Wall of Sand: слепота и ×3 движение в мгле, вариант — подпись при выборе', () => {
    const spell = find('XGE:Wall of Sand');
    const horizontal = automationForSpell(spell, { variant: 'horizontal' });
    expect(horizontal.zone?.area).toEqual({ shape: 'line', size: 30, width: 10 });
    expect(horizontal.zone?.flags).toEqual({ obscured: 'heavy', movementCost: 3 });
    expect(horizontal.zone?.aura?.effects?.[0]?.conditions).toEqual(['blinded']);
    expect(horizontal.zone?.aura?.effects?.[0]?.variant).toBe('horizontal');
    expect(automationForSpell(spell).zone?.aura?.effects?.[0]?.variant).toBeUndefined();
  });

  it('Wall of Ice: секции с HP, лист холода и литеральные шаги апкаста (+2к6/+1к6)', () => {
    const spell = find('XPHB:Wall of Ice');
    const def = automationForSpell(spell, { variant: 'wall' });
    expect(def.zone?.wall?.hp).toBe(30);
    expect(def.zone?.wall?.ac).toBe(12);
    expect(def.zone?.wall?.immunities).toEqual(['cold', 'poison', 'psychic']);
    expect(def.zone?.wall?.vulnerabilities).toEqual(['fire']);
    expect(def.zone?.wall?.breach?.save).toEqual({ ability: 'con', half: true });
    expect(def.damage).toEqual({ dice: '10d6cold', types: ['cold'] });
    expect(def.zone?.wall?.breach?.damage).toEqual({ dice: '5d6cold', types: ['cold'] });
    const up = automationForSpell(spell, { castLevel: 8, variant: 'wall' });
    expect(up.damage?.dice).toBe('14d6cold');
    expect(up.zone?.wall?.breach?.damage?.dice).toBe('7d6cold');
    expect(automationForSpell(spell, { variant: 'ring' }).zone?.area).toEqual({ shape: 'ring', size: 10, inner: 9 });
  });

  it('Wall of Light: полоса 60×5, свет 120, урон конца хода и луч с сокращением', () => {
    const spell = find('XGE:Wall of Light');
    const def = automationForSpell(spell, { variant: 'vertical' });
    expect(def.zone?.area).toEqual({ shape: 'line', size: 60, width: 5 });
    expect(def.zone?.light).toEqual({ bright: 120, dim: 120 });
    expect(def.zone?.flags).toEqual({ blocksLineOfSight: true });
    expect(def.effects?.[0]?.conditions).toEqual(['blinded']);
    expect(def.effects?.[0]?.duration).toEqual({ type: 'untilSave', ability: 'con', dc: 0, timing: 'end' });
    expect(def.zone?.triggers?.endOfTurn?.damage).toEqual({ dice: '4d8radiant', types: ['radiant'] });
    const beam = def.zone?.actions?.[0];
    expect(beam?.shrinkFeet).toBe(10);
    expect(beam?.def?.name).toBe('Луч света');
    expect(beam?.def?.count).toBe(1);
    expect(beam?.def?.attack).toEqual({ rangeType: 'ranged' });
    expect(beam?.def?.targeting).toEqual({ kind: 'creature', range: 60, from: 'origin' });
    expect(beam?.def?.damage).toEqual({ dice: '4d8radiant', types: ['radiant'] });
    // Апкаст +1d8 всем частям: появление, конец хода, луч.
    const up = automationForSpell(spell, { castLevel: 7, variant: 'vertical' });
    expect(up.damage?.dice).toBe('6d8radiant');
    expect(up.zone?.triggers?.endOfTurn?.damage?.dice).toBe('6d8radiant');
    expect(up.zone?.actions?.[0]?.def?.damage?.dice).toBe('6d8radiant');
  });

  it('Eyebite: три действия на выбор, метка спасшимся, сон снимается уроном', () => {
    const spell = find('XPHB:Eyebite');
    const def = automationForSpell(spell, { variant: 'sickened' });
    expect(def.save).toEqual({ ability: 'wis' });
    expect(def.targeting).toEqual({ kind: 'creature', range: 60 });
    const carrier = def.effects?.[0];
    expect(carrier?.to).toBe('self');
    expect(carrier?.actions?.map((a) => a.id)).toEqual(['eyebite:asleep', 'eyebite:panicked', 'eyebite:sickened']);
    const asleep = carrier?.actions?.[0]?.def;
    expect(asleep?.save).toEqual({ ability: 'wis' });
    expect(asleep?.effects?.[0]?.conditions).toEqual(['unconscious']);
    expect(asleep?.effects?.[0]?.wakeOnDamage).toBe(true);
    const mark = def.effects?.[1];
    expect(mark?.conditions).toEqual(['poisoned']);
    expect(mark?.markSaved).toBe(true);
    expect(mark?.wakeOnDamage).toBeUndefined();
    const asleepDef = automationForSpell(spell, { variant: 'asleep' });
    expect(asleepDef.effects?.[1]?.conditions).toEqual(['unconscious']);
    expect(asleepDef.effects?.[1]?.wakeOnDamage).toBe(true);
  });

  it('Bestow Curse: режимы и длительность по кругу (10 раундов / 100 / постоянно)', () => {
    const spell = find('XPHB:Bestow Curse');
    const base = automationForSpell(spell, { castLevel: 3, variant: 'checks-dex' });
    expect(base.concentration).toBe(true);
    expect(base.maxRounds).toBe(10);
    expect(base.effects?.[0]?.duration).toEqual({ type: 'concentration' });
    expect(base.effects?.[0]?.modifiers).toEqual([
      { target: 'check', mode: 'disadvantage', filter: { ability: 'dex' } },
      { target: 'save', mode: 'disadvantage', filter: { ability: 'dex' } },
    ]);
    const lvl4 = automationForSpell(spell, { castLevel: 4, variant: 'attacks' });
    expect(lvl4.maxRounds).toBe(100);
    expect(lvl4.effects?.[0]?.modifiers).toEqual([
      { target: 'attack', mode: 'disadvantage', filter: { direction: 'against' } },
    ]);
    const lvl5 = automationForSpell(spell, { castLevel: 5, variant: 'dodge' });
    expect(lvl5.concentration).toBeUndefined();
    expect(lvl5.maxRounds).toBeNull();
    expect(lvl5.effects?.[0]?.duration).toEqual({ type: 'permanent' });
    expect(lvl5.effects?.[0]?.turnDodge).toEqual({ ability: 'wis' });
    expect(automationForSpell(spell, { castLevel: 3, variant: 'necrotic' }).effects?.[0]?.takesExtraDamage).toEqual({
      dice: '1d8',
      damageType: 'necrotic',
    });
    // Без выбора — проверки Силы.
    expect(automationForSpell(spell, { castLevel: 3 }).effects?.[0]?.modifiers?.[0]).toEqual({
      target: 'check',
      mode: 'disadvantage',
      filter: { ability: 'str' },
    });
  });

  it('Armor of Agathys: врем. HP и ответный холод растут на +5 за круг', () => {
    const spell = find('XPHB:Armor of Agathys');
    const base = automationForSpell(spell, { castLevel: 1 }).effects?.[0];
    expect(base?.tempHp).toBe(5);
    expect(base?.retaliate).toEqual({ damageType: 'cold', amount: 5 });
    const up = automationForSpell(spell, { castLevel: 3 }).effects?.[0];
    expect(up?.tempHp).toBe(15);
    expect(up?.retaliate).toEqual({ damageType: 'cold', amount: 15 });
  });

  it('Invisibility: цели по кругу, обрыв атакой/кастом; Greater — без обрыва', () => {
    const spell = find('XPHB:Invisibility');
    const base = automationForSpell(spell, { castLevel: 2 });
    expect(base.concentration).toBe(true);
    expect(base.effects?.[0]?.targets).toBe(1);
    expect(base.effects?.[0]?.conditions).toEqual(['invisible']);
    expect(base.effects?.[0]?.breakOn).toEqual(['attack', 'spell']);
    expect(automationForSpell(spell, { castLevel: 4 }).effects?.[0]?.targets).toBe(3);
    const greater = automationForSpell(find('XPHB:Greater Invisibility'));
    expect(greater.effects?.[0]?.targets).toBe(1);
    expect(greater.effects?.[0]?.breakOn).toBeUndefined();
  });

  it('Death Ward и Shadow of Moil: страховка от смерти и ответная тьма', () => {
    const ward = automationForSpell(find('XPHB:Death Ward')).effects?.[0];
    expect(ward?.deathWard).toBe(true);
    expect(ward?.to).toBe('targets');
    const moil = automationForSpell(find('XGE:Shadow of Moil')).effects?.[0];
    expect(moil?.retaliate).toEqual({ damageType: 'necrotic', dice: '2d8' });
    expect(moil?.modifiers).toEqual([
      { target: 'attack', mode: 'disadvantage', filter: { direction: 'against' } },
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'radiant' } },
    ]);
  });

  it('Misty Step / Dimension Door: телепорт 30 и 500 (пассажир, сквозь стены, урон провала)', () => {
    const misty = automationForSpell(find('XPHB:Misty Step'));
    expect(misty.utility).toEqual({ kind: 'teleport', amount: 30 });
    expect(misty.targeting).toEqual({ kind: 'point', range: 30 });
    const dd = automationForSpell(find('XPHB:Dimension Door'));
    expect(dd.utility).toMatchObject({
      kind: 'teleport',
      amount: 500,
      passenger: { feet: 5, destFeet: 5 },
      ignoreSight: true,
    });
    expect(dd.utility?.blockedDamage).toEqual({ dice: '4d6', types: ['force'] });
    expect(dd.targeting).toEqual({ kind: 'point', range: 500 });
  });

  it('Thunder Step: 90 фт, вспышка 3d10 (+1d10/круг) в покинутой точке', () => {
    const spell = find('XGE:Thunder Step');
    const base = automationForSpell(spell, { castLevel: 3 });
    expect(base.utility).toMatchObject({ kind: 'teleport', amount: 90, passenger: { maxSize: true } });
    expect(base.utility?.fromBurst?.save).toEqual({ ability: 'con', half: true });
    expect(base.utility?.fromBurst?.damage).toEqual({ dice: '3d10', types: ['thunder'] });
    expect(automationForSpell(spell, { castLevel: 5 }).utility?.fromBurst?.damage?.dice).toBe('5d10');
  });

  it('Steel Wind Strike: 5 атак, апкаста нет, телепорт 5 фт после', () => {
    const spell = find('XPHB:Steel Wind Strike');
    const def = automationForSpell(spell, { castLevel: 7 });
    expect(def.targets).toBe(5);
    expect(def.count).toBe(5);
    expect(def.damage).toEqual({ dice: '6d10', types: ['force'] });
    expect(def.teleportAfter).toEqual({ feet: 5 });
  });

  it('Far Step: телепорт 60 при касте и бонусным действием под концентрацией', () => {
    const def = automationForSpell(find('XGE:Far Step'));
    expect(def.concentration).toBe(true);
    expect(def.utility).toEqual({ kind: 'teleport', amount: 60 });
    const action = def.effects?.[0]?.actions?.[0];
    expect(action).toMatchObject({ id: 'farStep', name: 'Прыжок', cost: 'bonus' });
    expect(action?.def?.utility).toEqual({ kind: 'teleport', amount: 60 });
    expect(action?.def?.targeting).toEqual({ kind: 'point', range: 60 });
  });

  it('Chain Lightning: первая цель + 3 скачка (+1/круг), 10d8 электричеством', () => {
    const spell = find('XPHB:Chain Lightning');
    const base = automationForSpell(spell, { castLevel: 6 });
    expect(base.save).toEqual({ ability: 'dex', half: true });
    expect(base.damage).toEqual({ dice: '10d8', types: ['lightning'] });
    expect(base.chain).toEqual({ jumps: 3, feet: 30 });
    expect(automationForSpell(spell, { castLevel: 8 }).chain?.jumps).toBe(5);
  });

  it('Ice Knife: атака 1d10 колющим, взрыв 2d6 холодом (+1d6/круг) и по основной цели', () => {
    const spell = find('XPHB:Ice Knife');
    const base = automationForSpell(spell, { castLevel: 1 });
    expect(base.attack).toEqual({ rangeType: 'ranged' });
    expect(base.damage).toEqual({ dice: '1d10piercing', types: ['piercing'] });
    expect(base.burst).toEqual({
      rangeFeet: 5,
      damageType: 'cold',
      dice: '2d6cold',
      save: { ability: 'dex', half: false },
      includePrimary: true,
    });
    expect(automationForSpell(spell, { castLevel: 3 }).burst?.dice).toBe('4d6cold');
  });

  it('Light/Continual Flame: источник света 20/20 на цель, без концентрации', () => {
    for (const key of ['XPHB:Light', 'XPHB:Continual Flame']) {
      const def = automationForSpell(find(key));
      expect(def.resolution).toBe('effect');
      expect(def.concentration).toBeUndefined();
      const effect = def.effects?.[0];
      expect(effect?.to).toBe('targets');
      expect(effect?.duration).toEqual({ type: 'permanent' });
      expect(effect?.light).toEqual({ bright: 20, dim: 20 });
    }
  });

  it('Darkvision: тёмное зрение 150 фт на 8 часов (4800 раундов) на цель', () => {
    const def = automationForSpell(find('XPHB:Darkvision'));
    const effect = def.effects?.[0];
    expect(effect?.duration).toEqual({ type: 'rounds', rounds: 4800 });
    expect(effect?.senses).toEqual([{ type: 'darkvision', range: 150 }]);
  });

  it('See Invisibility: носитель видит невидимых (без концентрации)', () => {
    const def = automationForSpell(find('XPHB:See Invisibility'));
    const effect = def.effects?.[0];
    expect(effect?.to).toBe('self');
    expect(effect?.duration).toEqual({ type: 'permanent' });
    expect(effect?.seesInvisible).toBe(true);
  });

  it('Pass without Trace: аура 30 фт от кастера, +10 к Скрытности, концентрация', () => {
    const def = automationForSpell(find('XPHB:Pass without Trace'));
    expect(def.concentration).toBe(true);
    expect(def.zone).toMatchObject({
      origin: 'self',
      anchor: 'source',
      area: { shape: 'sphere', size: 30 },
      duration: { type: 'concentration' },
    });
    expect(def.zone?.aura?.effects?.[0]?.modifiers).toEqual([
      { target: 'check', mode: 'add', value: 10, filter: { skill: 'stealth' } },
    ]);
  });

  it('Silence: зона только целиком внутри, немагическая тишина и глухота в ауре', () => {
    const def = automationForSpell(find('XPHB:Silence'));
    expect(def.zone).toMatchObject({
      area: { shape: 'sphere', size: 20 },
      containment: 'fullyWithin',
      flags: { silence: true },
    });
    const aura = def.zone?.aura?.effects?.[0];
    expect(aura?.conditions).toEqual(['deafened']);
    expect(aura?.modifiers).toEqual([
      { target: 'damage', mode: 'immunity', value: 0, filter: { damageType: 'thunder' } },
    ]);
  });

  it('Darkness/Fog Cloud: флаги зон — магическая тьма и сильное заслонение', () => {
    const darkness = automationForSpell(find('XPHB:Darkness'));
    expect(darkness.zone).toMatchObject({
      area: { shape: 'sphere', size: 15 },
      flags: { blocksLight: true },
    });
    expect(darkness.concentration).toBe(true);

    const fog = automationForSpell(find('XPHB:Fog Cloud'));
    expect(fog.zone).toMatchObject({
      area: { shape: 'sphere', size: 20 },
      flags: { obscured: 'heavy' },
    });
  });

  it('Батч Б4: auto-зоны (Stinking Cloud, Sleet Storm, Hunger of Hadar, Cloudkill)', () => {
    const stinking = automationForSpell(find('XPHB:Stinking Cloud')).zone;
    expect(stinking?.flags).toEqual({ obscured: 'heavy' });
    const poisoned = stinking?.triggers?.startOfTurn?.effects?.[0];
    expect(poisoned?.conditions).toEqual(['poisoned']);
    expect(poisoned?.restrictions).toEqual({ noActions: true, noBonus: true });

    const sleet = automationForSpell(find('XPHB:Sleet Storm')).zone;
    expect(sleet?.area).toEqual({ shape: 'cylinder', size: 20 });
    expect(sleet?.flags).toEqual({ difficultTerrain: true, obscured: 'heavy' });
    expect(sleet?.triggers?.enter?.effects?.[0]?.conditions).toEqual(['prone']);

    const hunger = automationForSpell(find('XPHB:Hunger of Hadar')).zone;
    expect(hunger?.aura?.effects?.[0]?.conditions).toEqual(['blinded']);
    expect(hunger?.triggers?.startOfTurn?.containment).toBe('anyCell');
    expect(hunger?.triggers?.endOfTurn?.damage?.types).toEqual(['acid']);
    expect(hunger?.flags).toEqual({ difficultTerrain: true, blocksLight: true });

    const cloudkill = automationForSpell(find('XPHB:Cloudkill'));
    expect(cloudkill.zone?.movable).toBe(true);
    expect(cloudkill.zone?.triggers?.enter?.damage?.dice).toBe('5d8');
    const upcast = automationForSpell(find('XPHB:Cloudkill'), { castLevel: 6 });
    expect(upcast.zone?.triggers?.startOfTurn?.damage?.dice).toBe('5d8 + 1d8');
  });

  it('Батч Б3: Grease и аурные зоны (Circle of Power, Aura of Life/Purity)', () => {
    const grease = automationForSpell(find('XPHB:Grease'));
    expect(grease.zone?.area).toEqual({ shape: 'cube', size: 10 });
    expect(grease.zone?.duration).toEqual({ type: 'rounds', rounds: 10 });
    expect(grease.zone?.flags).toEqual({ difficultTerrain: true });
    expect(grease.zone?.triggers?.enter?.effects?.[0]?.conditions).toEqual(['prone']);
    expect(grease.zone?.triggers?.endOfTurn?.save).toEqual({ ability: 'dex' });

    const power = automationForSpell(find('XPHB:Circle of Power')).zone;
    expect(power?.side).toBe('ally');
    expect(power?.aura?.effects?.[0]?.modifiers).toEqual([
      { target: 'save', mode: 'advantage', filter: { magical: true } },
    ]);
    expect(power?.aura?.effects?.[0]?.saveNoDamage).toBe(true);

    const life = automationForSpell(find('XPHB:Aura of Life')).zone;
    expect(life?.triggers?.startOfTurn).toEqual({ healTo: 1 });
    expect(life?.aura?.effects?.[0]?.modifiers).toEqual([
      { target: 'damage', mode: 'resistance', value: 0, filter: { damageType: 'necrotic' } },
    ]);

    const purity = automationForSpell(find('XPHB:Aura of Purity')).zone;
    expect(purity?.aura?.effects?.[0]?.conditionImmunities).toEqual(['poisoned']);
  });

  it('Батч Б2: Revivify/Spare the Dying/Dispel Magic — утилиты с таргетингом', () => {
    const revive = automationForSpell(find('XPHB:Revivify'));
    expect(revive.resolution).toBe('utility');
    expect(revive.utility).toEqual({ kind: 'revive' });
    expect(revive.targeting).toEqual({ kind: 'creature', range: 5 });

    const spare = automationForSpell(find('XPHB:Spare the Dying'));
    expect(spare.utility).toEqual({ kind: 'stabilize' });
    expect(spare.targeting).toEqual({ kind: 'creature', range: 15 });

    const dispel = automationForSpell(find('XPHB:Dispel Magic'));
    expect(dispel.utility).toEqual({ kind: 'dispel' });
    expect(dispel.targeting).toEqual({ kind: 'creature', range: 120 });
  });

  it('Батч Б1 каталога: Banishment, Hypnotic Pattern, Sanctuary, Warding Bond', () => {
    const banish = automationForSpell(find('XPHB:Banishment')).effects?.[0];
    expect(banish?.banish).toBe(true);
    expect(banish?.duration).toEqual({ type: 'rounds', rounds: 10 });
    expect(banish?.conditions).toEqual(['incapacitated']);

    const hypnotic = automationForSpell(find('XPHB:Hypnotic Pattern')).effects?.[0];
    expect(hypnotic?.conditions).toEqual(['charmed', 'incapacitated']);
    expect(hypnotic?.modifiers).toEqual([{ target: 'speed', mode: 'multiply', value: 0 }]);
    expect(hypnotic?.wakeOnDamage).toBe(true);

    const sanctuary = automationForSpell(find('XPHB:Sanctuary'));
    expect(sanctuary.targeting).toEqual({ kind: 'creature', range: 30 });
    expect(sanctuary.effects?.[0]?.sanctuary).toBe(true);
    expect(sanctuary.effects?.[0]?.breakOn).toEqual(['attack', 'spell', 'damage']);

    const bond = automationForSpell(find('XPHB:Warding Bond')).effects?.[0];
    expect(bond?.damageLink).toBe(true);
    expect(bond?.modifiers.slice(0, 2)).toEqual([
      { target: 'ac', mode: 'add', value: 1 },
      { target: 'save', mode: 'add', value: 1 },
    ]);
    expect(bond?.modifiers.filter((m) => m.mode === 'resistance')).toHaveLength(16);
  });

  it('Батч A2 каталога: Haste, Hold Person, Slow, Divine Favor', () => {
    const haste = automationForSpell(find('XPHB:Haste'));
    expect(haste.concentration).toBe(true);
    expect(haste.effects?.[0]?.modifiers).toEqual([
      { target: 'ac', mode: 'add', value: 2 },
      { target: 'speed', mode: 'multiply', value: 2 },
      { target: 'extraActions', mode: 'add', value: 1 },
    ]);

    const hold = automationForSpell(find('XPHB:Hold Person'));
    expect(hold.save).toEqual({ ability: 'wis' });
    expect(hold.effects?.[0]?.conditions).toEqual(['paralyzed']);
    expect(hold.effects?.[0]?.duration).toEqual({ type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' });

    const slow = automationForSpell(find('XPHB:Slow'));
    expect(slow.effects?.[0]?.targets).toBe(6);
    expect(slow.effects?.[0]?.restrictions).toEqual({
      noReactions: true,
      actionOrBonusOnly: true,
      oneAttackOnly: true,
      spellFailureChance: 25,
    });

    const favor = automationForSpell(find('XPHB:Divine Favor')).effects?.[0];
    expect(favor?.to).toBe('self');
    expect(favor?.modifiers).toEqual([
      { target: 'damage', mode: 'add', value: '1d4radiant', filter: { weapon: true, unarmed: false } },
    ]);
  });

  it('Батч A каталога: Shield, Mage Armor, Barkskin, Longstrider, Blur', () => {
    const shield = automationForSpell(find('XPHB:Shield')).effects?.[0];
    expect(shield?.to).toBe('self');
    expect(shield?.duration).toEqual({ type: 'endOfTurn', of: 'source' });
    expect(shield?.modifiers).toEqual([{ target: 'ac', mode: 'add', value: 5 }]);

    const mageArmor = automationForSpell(find('XPHB:Mage Armor')).effects?.[0];
    expect(mageArmor?.duration).toEqual({ type: 'permanent' });
    expect(mageArmor?.modifiers).toEqual([{ target: 'ac', mode: 'set', value: '13+dex' }]);

    const barkskin = automationForSpell(find('XPHB:Barkskin')).effects?.[0];
    expect(barkskin?.modifiers).toEqual([{ target: 'ac', mode: 'set', value: 17 }]);

    const longstrider = automationForSpell(find('XPHB:Longstrider')).effects?.[0];
    expect(longstrider?.modifiers).toEqual([{ target: 'speed', mode: 'add', value: 10 }]);

    const blur = automationForSpell(find('XPHB:Blur'));
    expect(blur.concentration).toBe(true);
    expect(blur.maxRounds).toBe(10);
    expect(blur.effects?.[0]?.modifiers).toEqual([{ target: 'attack', mode: 'disadvantage' }]);
  });
});
