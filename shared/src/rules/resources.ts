import { abilityMod, type AbilityKey, type ClassLevel, type PlayerResources, type ResourceItem, type RestType } from '../types';
import {
  CLASSES,
  clampLevel,
  hitDiceMaxes,
  pactMax,
  spellSlotMaxes,
  type ResourceDef,
} from './classes';

interface AutoDef {
  key: string;
  name: string;
  reset: RestType;
  max: number;
}

export function autoResourceDefs(classes: ClassLevel[], mods: Record<AbilityKey, number>): AutoDef[] {
  const out: AutoDef[] = [];
  const totalLevel = classes.reduce((acc, c) => acc + clampLevel(c.level), 0);
  const push = (prefix: string, defs: ResourceDef[] | undefined, level: number) => {
    for (const d of defs ?? []) {
      out.push({ key: `${prefix}:${d.key}`, name: d.name, reset: d.reset(level), max: d.max(level, mods, totalLevel) });
    }
  };
  for (const entry of classes) {
    const def = CLASSES[entry.className];
    if (!def) continue;
    push(def.key, def.resources, entry.level);
    if (entry.subclass) push(`${def.key}.${entry.subclass}`, def.subclasses[entry.subclass]?.resources, entry.level);
  }
  return out;
}

export function sheetMods(abilities: Record<AbilityKey, number>): Record<AbilityKey, number> {
  return {
    str: abilityMod(abilities.str ?? 10),
    dex: abilityMod(abilities.dex ?? 10),
    con: abilityMod(abilities.con ?? 10),
    int: abilityMod(abilities.int ?? 10),
    wis: abilityMod(abilities.wis ?? 10),
    cha: abilityMod(abilities.cha ?? 10),
  };
}

const clampCurrent = (current: number, max: number) => Math.min(max, Math.max(0, Math.round(current || 0)));

export function emptyResources(): PlayerResources {
  return {
    hp: { current: 0, max: 0, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    hitDice: [],
    spellSlots: [],
    pact: { current: 0, max: 0, level: 0 },
    resources: [],
    notes: '',
  };
}

/**
 * Пересчитывает авто-ресурсы, ячейки и pact по классам листа.
 * mode='soft' — сохранить текущие значения (зажав по max); 'full' — сбросить к max.
 * Кастомные ресурсы (auto !== true) и HP не трогаются.
 */
export function syncResources(
  prev: PlayerResources,
  classes: ClassLevel[],
  mods: Record<AbilityKey, number>,
  mode: 'soft' | 'full'
): PlayerResources {
  const defs = autoResourceDefs(classes, mods);
  const prevByKey = new Map(prev.resources.filter((r) => r.auto).map((r) => [r.key ?? r.id, r]));
  const autoResources: ResourceItem[] = defs.map((d) => {
    const before = prevByKey.get(d.key);
    const current = mode === 'full' ? d.max : clampCurrent(before?.current ?? d.max, d.max);
    return { id: before?.id ?? crypto.randomUUID(), key: d.key, name: d.name, current, max: d.max, reset: d.reset, auto: true };
  });
  const custom = prev.resources.filter((r) => !r.auto);

  const maxes = spellSlotMaxes(classes);
  const prevSlot = new Map(prev.spellSlots.map((s) => [s.level, s.current]));
  const spellSlots = maxes.map((max, i) => {
    const level = i + 1;
    const current = mode === 'full' ? max : clampCurrent(prevSlot.get(level) ?? max, max);
    return { level, current, max };
  });

  const pact = pactMax(classes);
  const pactCurrent = mode === 'full' ? pact.count : clampCurrent(prev.pact.current ?? pact.count, pact.count);

  const hdMaxes = hitDiceMaxes(classes);
  const prevHd = new Map((prev.hitDice ?? []).map((h) => [h.die, h.current]));
  const hitDice = hdMaxes.map(({ die, max }) => ({
    die,
    max,
    current: mode === 'full' ? max : clampCurrent(prevHd.get(die) ?? max, max),
  }));

  return {
    hp: prev.hp,
    hitDice,
    spellSlots,
    pact: { current: pactCurrent, max: pact.count, level: pact.level },
    resources: [...autoResources, ...custom],
    notes: prev.notes ?? '',
  };
}

const newId = () => crypto.randomUUID();

const finiteInt = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

/**
 * Приводит присланное игроком состояние ресурсов к корректному виду:
 * максимумы авто-ресурсов, ячеек и pact берутся из правил, значения зажимаются.
 */
export function sanitizeResources(
  input: PlayerResources,
  classes: ClassLevel[],
  mods: Record<AbilityKey, number>,
  hpMaxOverride?: number
): PlayerResources {
  const defs = autoResourceDefs(classes, mods);
  const incomingByKey = new Map(
    (Array.isArray(input.resources) ? input.resources : []).filter((r) => r.auto).map((r) => [r.key, r])
  );
  const autoResources: ResourceItem[] = defs.map((d) => {
    const before = incomingByKey.get(d.key);
    return {
      id: before?.id ?? newId(),
      key: d.key,
      name: d.name,
      current: clampCurrent(before?.current ?? d.max, d.max),
      max: d.max,
      reset: d.reset,
      auto: true,
    };
  });
  const custom: ResourceItem[] = (Array.isArray(input.resources) ? input.resources : [])
    .filter((r) => !r.auto)
    .map((r) => {
      const max = Math.max(0, finiteInt(r.max));
      return {
        id: typeof r.id === 'string' && r.id ? r.id : newId(),
        name: (typeof r.name === 'string' ? r.name : '').slice(0, 40) || 'Ресурс',
        current: clampCurrent(finiteInt(r.current), max),
        max,
        reset: r.reset === 'short' || r.reset === 'never' ? r.reset : 'long',
      };
    });

  const maxes = spellSlotMaxes(classes);
  const incomingSlots = new Map(
    (Array.isArray(input.spellSlots) ? input.spellSlots : []).map((s) => [finiteInt(s.level), finiteInt(s.current)])
  );
  const spellSlots = maxes.map((max, i) => ({
    level: i + 1,
    current: clampCurrent(incomingSlots.get(i + 1) ?? max, max),
    max,
  }));

  const pact = pactMax(classes);
  const hdMaxes = hitDiceMaxes(classes);
  const inputHd = new Map(
    (Array.isArray(input.hitDice) ? input.hitDice : []).map((h) => [finiteInt(h.die), finiteInt(h.current)])
  );
  const hitDice = hdMaxes.map(({ die, max }) => ({
    die,
    max,
    current: clampCurrent(inputHd.get(die) ?? max, max),
  }));
  const hpMax =
    hpMaxOverride !== undefined ? Math.max(0, Math.round(hpMaxOverride)) : Math.max(0, finiteInt(input.hp?.max));
  const hp = {
    max: hpMax,
    current: clampCurrent(finiteInt(input.hp?.current), hpMax),
    temp: Math.max(0, finiteInt(input.hp?.temp)),
    deathSuccesses: Math.min(3, Math.max(0, finiteInt(input.hp?.deathSuccesses))),
    deathFailures: Math.min(3, Math.max(0, finiteInt(input.hp?.deathFailures))),
  };

  return {
    hp,
    hitDice,
    spellSlots,
    pact: { current: clampCurrent(finiteInt(input.pact?.current, pact.count), pact.count), max: pact.count, level: pact.level },
    resources: [...autoResources, ...custom],
    notes: typeof input.notes === 'string' ? input.notes.slice(0, 4000) : '',
  };
}

/** Восстанавливает ресурсы по отдыху: короткий — 'short' + pact, долгий — всё, HP до max. */
export function applyRest(res: PlayerResources, type: 'short' | 'long'): PlayerResources {
  const restore = (r: ResourceItem) => (type === 'long' ? r.reset !== 'never' : r.reset === 'short');
  return {
    hp:
      type === 'long'
        ? { ...res.hp, current: res.hp.max, temp: 0, deathSuccesses: 0, deathFailures: 0 }
        : res.hp,
    hitDice: type === 'long' ? res.hitDice.map((h) => ({ ...h, current: h.max })) : res.hitDice,
    spellSlots: type === 'long' ? res.spellSlots.map((s) => ({ ...s, current: s.max })) : res.spellSlots,
    pact: { ...res.pact, current: res.pact.max },
    resources: res.resources.map((r) => (restore(r) ? { ...r, current: r.max } : r)),
    notes: res.notes ?? '',
  };
}
