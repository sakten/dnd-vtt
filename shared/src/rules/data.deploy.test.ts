import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import spellsRaw from '../data/spells.json';
import spellcastingRaw from '../data/spellcasting.json';
import subclassRaw from '../data/subclassSpells.json';
import featuresRaw from '../data/features.json';
import weaponsRaw from '../data/weapons.json';
import featsRaw from '../data/feats.json';
import bestiaryRaw from '../data/bestiary.json';
import invocationsRaw from '../data/invocations.json';
import type { BestiaryEntry } from '../domain/bestiary';
import type { InvocationsData } from '../domain/invocation';
import { parseDiceExpression } from '../dice';
import { ATTACK_RIDERS } from './attackRiders';
import { CLASSES } from './classes';
import { CONDITION_KEYS } from './conditions';
import { AUTOMATION_SPELLS } from './automation';
import { INVOCATION_MECHANICS } from './invocations';
import { ABSORB_SPELL_TYPES, REACTION_SPELL_TRIGGERS } from './reactions';
import { spellAttackCount, spellDamageExpression } from './spellCast';
import type { Spell } from './spells';

/**
 * Deploy-«замок» на замороженный снимок данных (перегенерации нет): запускается
 * только `npm run test:deploy`. Любая осознанная правка `data/*.json` требует
 * обновить hash ниже — иначе тест падает и сигналит, какой файл изменился.
 */
const HASHES = {
  spells: '81a0ce0c9833d470',
  spellcasting: '142392258946ec63',
  subclassSpells: '0538db9846fc0bec',
  features: 'd78e880ad9f8c0c4',
  weapons: '7910a91430bd729f',
  feats: 'f8d310ec0a56a339',
  bestiary: '6827a0264048d489',
  invocations: '7efff7e520cc92ad',
};

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

const SPELLS = (spellsRaw as unknown as { count: number; spells: Spell[] }).spells;
const CASTING = spellcastingRaw as unknown as Record<
  string,
  {
    ability: string | null;
    casterProgression: string;
    cantrips: number[] | null;
    prepared: number[] | null;
    change: string | null;
  }
>;
const GRANTS = subclassRaw as unknown as {
  classes: Record<string, { key: string; level: number }[]>;
  subclasses: Record<string, { granted: { key: string; level: number }[]; pool: { key: string; level: number }[] }>;
};

/** Источники записей: заклинания — 5e24 + переизданные XGE/TCE, фичи — XPHB/EFA/RHW и подклассы XGE/TCE. */
const SOURCES = new Set(['XPHB', 'XGE', 'TCE', 'EFA', 'RHW']);
const SCHOOLS = new Set([
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
]);
const ABILITIES = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
const DAMAGE_KEYS = new Set([
  'bludgeoning',
  'piercing',
  'slashing',
  'magicalBludgeoning',
  'magicalPiercing',
  'magicalSlashing',
  'fire',
  'cold',
  'acid',
  'poison',
  'lightning',
  'thunder',
  'force',
  'necrotic',
  'radiant',
  'psychic',
]);
const AREA_SHAPES = new Set(['sphere', 'cone', 'cube', 'line', 'cylinder']);

/** Состояния с авто-эффектами в `conditions.ts` (charmed/deafened — только чипы). */
const MECHANICAL_CONDITIONS = new Set([
  'blinded',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
]);

describe('снимок данных', () => {
  it('hash файлов не менялся', () => {
    expect({
      spells: hash(spellsRaw),
      spellcasting: hash(spellcastingRaw),
      subclassSpells: hash(subclassRaw),
      features: hash(featuresRaw),
      weapons: hash(weaponsRaw),
      feats: hash(featsRaw),
      bestiary: hash(bestiaryRaw),
      invocations: hash(invocationsRaw),
    }).toEqual(HASHES);
  });

  it('invocations.json: контракт записей', () => {
    const data = invocationsRaw as unknown as InvocationsData;
    expect(data.invocations.length).toBe(data.count);
    expect(data.limits).toHaveLength(20);
    expect(data.limits[0]).toBe(1);
    expect(data.limits[19]).toBe(10);
    const keys = new Set(data.invocations.map((i) => i.key));
    const bad: string[] = [];
    for (const inv of data.invocations) {
      if (!inv.key.startsWith('XPHB:')) bad.push(`${inv.key}: источник`);
      if (!inv.name || inv.level < 1 || inv.level > 20) bad.push(`${inv.key}: уровень ${inv.level}`);
      if (!inv.description) bad.push(`${inv.key}: пустое описание`);
      if (inv.prereq?.pact && !['blade', 'chain', 'tome'].includes(inv.prereq.pact)) bad.push(`${inv.key}: пакт`);
      if (inv.prereq?.requires && !keys.has(inv.prereq.requires)) bad.push(`${inv.key}: requires ${inv.prereq.requires}`);
    }
    expect(bad).toEqual([]);
    // Известная движку механика ссылается только на существующие инвокации.
    expect(Object.keys(INVOCATION_MECHANICS).filter((key) => !keys.has(key))).toEqual([]);
  });

  it('feats.json: контракт записей', () => {
    const data = featsRaw as unknown as {
      count: number;
      feats: {
        key: string;
        name: string;
        category: string;
        levelReq?: number;
        abilityChoose?: string[];
        spellLists?: { name: string; className: string }[];
        description: string;
      }[];
    };
    expect(data.feats.length).toBe(data.count);
    const cats = new Set(['origin', 'general', 'fightingStyle']);
    const bad: string[] = [];
    const seen = new Set<string>();
    for (const f of data.feats) {
      if (!f.key.startsWith('XPHB:')) bad.push(`${f.key}: источник`);
      if (seen.has(f.key)) bad.push(`${f.key}: дубль`);
      seen.add(f.key);
      if (!f.name || !f.description) bad.push(`${f.key}: имя/описание`);
      if (!cats.has(f.category)) bad.push(`${f.key}: категория ${f.category}`);
      if (f.levelReq !== undefined && !(f.levelReq >= 1 && f.levelReq <= 20)) bad.push(`${f.key}: уровень`);
      if (f.spellLists?.some((l) => !l.className || !l.name)) bad.push(`${f.key}: списки заклинаний`);
    }
    expect(bad).toEqual([]);
    expect(data.feats.filter((f) => f.category === 'epicBoon')).toEqual([]);
    const magic = data.feats.find((f) => f.key === 'XPHB:magicInitiate');
    expect(magic?.abilityChoose).toEqual(['int', 'wis', 'cha']);
    expect(magic?.spellLists?.map((l) => l.className)).toEqual(['cleric', 'druid', 'wizard']);
  });

  it('наездники атак: выражения урона парсятся', () => {
    const bad: string[] = [];
    for (const rider of ATTACK_RIDERS) {
      if (!rider.dice) continue;
      try {
        parseDiceExpression(rider.dice);
      } catch {
        bad.push(`${rider.id}: ${rider.dice}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('weapons.json: контракт записей', () => {
    const data = weaponsRaw as unknown as {
      count: number;
      weapons: {
        key: string;
        name: string;
        category: string;
        rangeType: string;
        damage: string;
        damageType: string;
        rangeNormal: number;
        rangeLong: number;
        properties: string[];
        mastery: string[];
        unarmed?: boolean;
      }[];
    };
    expect(data.weapons.length).toBe(data.count);
    const bad: string[] = [];
    for (const w of data.weapons) {
      if (!w.key || !w.name) bad.push(`${w.key}: имя/ключ`);
      if (w.category !== 'simple' && w.category !== 'martial') bad.push(`${w.key}: категория ${w.category}`);
      if (w.rangeType !== 'melee' && w.rangeType !== 'ranged') bad.push(`${w.key}: дальность ${w.rangeType}`);
      if (!/^\d+(d\d+)?$/.test(w.damage)) bad.push(`${w.key}: кость ${w.damage}`);
      if (!w.damageType) bad.push(`${w.key}: тип урона`);
      if (!(w.rangeNormal > 0)) bad.push(`${w.key}: дистанция ${w.rangeNormal}`);
      if (!Array.isArray(w.properties) || !Array.isArray(w.mastery)) bad.push(`${w.key}: свойства`);
    }
    expect(bad).toEqual([]);
    expect(data.weapons.filter((w) => w.unarmed)).toHaveLength(1);
  });

  it('features.json: контракт записей', () => {
    const data = featuresRaw as unknown as {
      count: number;
      features: { key: string; name: string; className: string; subclass?: string; level: number; source: string; description: string }[];
    };
    expect(data.features.length).toBe(data.count);
    const bad: string[] = [];
    for (const f of data.features) {
      const [scope, name] = f.key.split(':');
      if (!scope || !name || !/^[a-z]+(\.[a-zA-Z]+)?$/.test(scope)) bad.push(`${f.key}: формат ключа`);
      if (!(f.className in CLASSES)) bad.push(`${f.key}: класс ${f.className}`);
      if (!Number.isInteger(f.level) || f.level < 1 || f.level > 20) bad.push(`${f.key}: уровень ${f.level}`);
      if (!SOURCES.has(f.source)) bad.push(`${f.key}: источник ${f.source}`);
      if (!f.description) bad.push(`${f.key}: описание`);
    }
    expect(bad).toEqual([]);
  });

  it('spells.json: контракт записей', () => {
    const bad: string[] = [];
    for (const s of SPELLS) {
      if (!s.key.startsWith(`${s.source}:`)) bad.push(`${s.key}: формат ключа`);
      if (!SOURCES.has(s.source)) bad.push(`${s.key}: источник ${s.source}`);
      if (!Number.isInteger(s.level) || s.level < 0 || s.level > 6) bad.push(`${s.key}: круг ${s.level}`);
      if (!SCHOOLS.has(s.school)) bad.push(`${s.key}: школа ${s.school}`);
      if (s.automation !== 'full' && s.automation !== 'manual') bad.push(`${s.key}: automation ${s.automation}`);
      for (const die of s.damage?.dice ?? []) {
        if (!/^(?:\d*d\d+|\d+)(?:\s*[+;]\s*(?:\d*d\d+|\d+))*$/i.test(die)) bad.push(`${s.key}: кость ${die}`);
      }
      for (const type of s.damage?.types ?? []) {
        if (!type) bad.push(`${s.key}: пустой тип урона`);
      }
      for (const ability of s.save ?? []) {
        if (!ABILITIES.has(ability)) bad.push(`${s.key}: спасбросок ${ability}`);
      }
      if (s.spellAttack && s.spellAttack !== 'melee' && s.spellAttack !== 'ranged') {
        bad.push(`${s.key}: spellAttack ${s.spellAttack}`);
      }
      if (s.areaSpec && (!AREA_SHAPES.has(s.areaSpec.shape) || !(s.areaSpec.size > 0))) {
        bad.push(`${s.key}: areaSpec ${JSON.stringify(s.areaSpec)}`);
      }
      for (const condition of s.conditions ?? []) {
        if (!CONDITION_KEYS.includes(condition)) bad.push(`${s.key}: состояние ${condition}`);
      }
      for (const className of s.classes) {
        if (!(className in CLASSES)) bad.push(`${s.key}: класс ${className}`);
      }
      if (!s.description.length || s.description.some((p) => !p)) bad.push(`${s.key}: описание`);
      // Лицензия: текст правил `higherLevel` — только у SRD; галка `srd` для фильтра.
      if (!s.srd && s.higherLevel) bad.push(`${s.key}: не-SRD хранит higherLevel`);
      if (s.upcast && s.upcast.above === undefined && !s.upcast.tiers?.length) {
        bad.push(`${s.key}: upcast без above/tiers`);
      }
      for (const tier of s.cantrip ?? []) {
        const okDice = typeof tier.dice === 'string' && /^\d*d\d+$/i.test(tier.dice);
        const okCount = Number.isInteger(tier.count) && (tier.count ?? 0) > 1;
        if (!Number.isInteger(tier.level) || (!okDice && !okCount)) {
          bad.push(`${s.key}: cantrip ${JSON.stringify(tier)}`);
        }
      }
    }
    expect(bad).toEqual([]);
    expect(new Set(SPELLS.map((s) => s.key)).size).toBe(SPELLS.length);
    expect(new Set(SPELLS.map((s) => s.name)).size).toBe(SPELLS.length);
  });

  it('каталоги кода ссылаются на существующие заклинания', () => {
    const keys = new Set(SPELLS.map((s) => s.key));
    const catalogKeys = [
      ...Object.keys(AUTOMATION_SPELLS),
      ...Object.keys(REACTION_SPELL_TRIGGERS),
      ...Object.keys(ABSORB_SPELL_TYPES),
    ];
    expect(catalogKeys.filter((key) => !keys.has(key))).toEqual([]);

    const badCatalog: string[] = [];
    for (const [key, def] of Object.entries(AUTOMATION_SPELLS)) {
      if (def.key !== key) badCatalog.push(`${key}: ключ def ${def.key}`);
      if (!def.name) badCatalog.push(`${key}: пустое имя`);
      if (def.resolution === 'effect' && !def.effects?.length && !def.zone) {
        badCatalog.push(`${key}: effect без эффектов и зоны`);
      }
      if (def.resolution === 'manual' && (def.damage || def.effects?.length)) {
        badCatalog.push(`${key}: manual с механикой`);
      }
    }
    expect(badCatalog).toEqual([]);

    const bad: string[] = [];
    const checkGrants = (label: string, list: { key: string; level: number }[]) => {
      for (const grant of list) {
        if (!keys.has(grant.key)) bad.push(`${label}: нет заклинания ${grant.key}`);
        if (!Number.isInteger(grant.level) || grant.level < 0 || grant.level > 6) {
          bad.push(`${label}: круг ${grant.level}`);
        }
      }
      const seen = new Set<string>();
      for (const grant of list) {
        if (seen.has(grant.key)) bad.push(`${label}: дубль ${grant.key}`);
        seen.add(grant.key);
      }
    };
    for (const [className, list] of Object.entries(GRANTS.classes)) checkGrants(className, list);
    for (const [subclass, data] of Object.entries(GRANTS.subclasses)) {
      if (!subclass.includes('.')) bad.push(`${subclass}: формат ключа подкласса`);
      checkGrants(`${subclass}.granted`, data.granted);
      checkGrants(`${subclass}.pool`, data.pool);
    }
    expect(bad).toEqual([]);
  });

  it('состояния каталога механически действуют (без «чипов»)', () => {
    const bad: string[] = [];
    for (const [key, def] of Object.entries(AUTOMATION_SPELLS)) {
      for (const effect of def.effects ?? []) {
        const conditions = effect.conditions ?? [];
        if (conditions.length && !conditions.some((c) => MECHANICAL_CONDITIONS.has(c))) {
          bad.push(`${key}: ${conditions.join(', ')}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('условия каталога автоматизации — валидные ключи', () => {
    const bad: string[] = [];
    for (const [key, def] of Object.entries(AUTOMATION_SPELLS)) {
      for (const effect of def.effects ?? []) {
        for (const condition of effect.conditions ?? []) {
          if (!CONDITION_KEYS.includes(condition)) bad.push(`${key}: ${condition}`);
        }
        if (effect.escalate && !CONDITION_KEYS.includes(effect.escalate.condition)) {
          bad.push(`${key}: escalate ${effect.escalate.condition}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('spellcasting.json: контракт классов', () => {
    const bad: string[] = [];
    for (const [className, info] of Object.entries(CASTING)) {
      if (!(className in CLASSES)) bad.push(`${className}: неизвестный класс`);
      if (info.ability !== null && !ABILITIES.has(info.ability)) bad.push(`${className}: характеристика ${info.ability}`);
      const tables: [string, number[] | null][] = [
        ['cantrips', info.cantrips],
        ['prepared', info.prepared],
      ];
      for (const [name, table] of tables) {
        if (table === null) continue;
        if (table.length !== 20) bad.push(`${className}.${name}: длина ${table.length}`);
        for (let i = 1; i < table.length; i++) {
          if (table[i]! < table[i - 1]!) bad.push(`${className}.${name}: убывает на уровне ${i + 1}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('bestiary.json: контракт записей', () => {
    const data = bestiaryRaw as unknown as { count: number; entries: BestiaryEntry[] };
    expect(data.entries.length).toBe(data.count);
    expect(data.count).toBeGreaterThanOrEqual(330);
    const bad: string[] = [];
    const seen = new Set<string>();
    const sources = new Set(['XMM', 'XPHB']);
    for (const entry of data.entries) {
      const key = entry.key;
      if (!sources.has(entry.source)) bad.push(`${key}: источник`);
      if (seen.has(key)) bad.push(`${key}: дубль`);
      seen.add(key);
      if (!entry.name || !entry.type || !entry.cr) bad.push(`${key}: мета`);
      if (!(entry.ac > 0 && entry.ac <= 30)) bad.push(`${key}: AC ${entry.ac}`);
      if (!(entry.hpAverage > 0 && entry.hpAverage <= 1000)) bad.push(`${key}: HP ${entry.hpAverage}`);
      if (!(entry.cells >= 1 && entry.cells <= 4)) bad.push(`${key}: клетки ${entry.cells}`);
      if (!(entry.speed > 0 && entry.speed <= 200)) bad.push(`${key}: скорость ${entry.speed}`);
      for (const attack of entry.attacks) {
        if (!attack.name || !attack.hit || !attack.damage) bad.push(`${key}: атака ${attack.name}`);
      }
      for (const list of [entry.immunities, entry.resistances, entry.vulnerabilities]) {
        for (const damageType of list) {
          if (!DAMAGE_KEYS.has(damageType)) bad.push(`${key}: защита ${damageType}`);
        }
      }
      for (const conditionKey of entry.conditionImmunities) {
        if (!CONDITION_KEYS.includes(conditionKey)) bad.push(`${key}: иммунитет к состоянию ${conditionKey}`);
      }
      const ids = new Set(entry.actions.map((a) => a.id));
      if (ids.size !== entry.actions.length) bad.push(`${key}: id действий`);
      for (const action of entry.actions) {
        if (!action.id.startsWith(`${entry.source.toLowerCase()}:`) || action.source !== 'monster') {
          bad.push(`${key}: действие ${action.id}`);
        }
        if (action.ability?.save && !(action.ability.dc && action.ability.dc >= 1)) bad.push(`${key}: СЛ ${action.name}`);
        if (action.ability?.attack && !action.ability.attack.rangeType) bad.push(`${key}: атака способности`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('парсеры проходят весь снимок без сбоев', () => {    const bad: string[] = [];
    for (const s of SPELLS) {
      const baseCast = Math.max(1, s.level);
      if (s.damage?.dice?.length && !spellDamageExpression(s, baseCast, 1)) {
        bad.push(`${s.key}: нет базового выражения урона`);
      }
      for (const characterLvl of [1, 5, 11, 17]) {
        const expression = spellDamageExpression(s, baseCast, characterLvl);
        if (expression !== null && !expression.trim()) bad.push(`${s.key}: пустое выражение (ур. ${characterLvl})`);
        const count = spellAttackCount(s, baseCast, characterLvl);
        if (!Number.isInteger(count) || count < 1 || count > 10) {
          bad.push(`${s.key}: атак ${count} (ур. ${characterLvl})`);
        }
      }
      if (s.level < 6) {
        const upcast = spellDamageExpression(s, s.level + 1, 20);
        if (upcast !== null && !upcast.trim()) bad.push(`${s.key}: пустой апкаст`);
      }
    }
    expect(bad).toEqual([]);
  });
});
