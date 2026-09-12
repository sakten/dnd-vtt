import type { AbilityKey, ActionCost, ActionDef, ActionTargeting, ClassLevel } from '../types';
import { CLASSES, clampLevel } from './classes';

/**
 * Классовые/подклассовые способности (Ф4). Каталог строится из ресурсов `CLASSES`:
 * каждый ресурс-черта становится действием панели с авто-списанием ресурса.
 * Ресурсы-«топливо» (пулы, питающие несколько черт) и пассивки кнопкой не становятся —
 * для них заданы именованные способности в `NAMED_FEATURES`.
 */

const ZERO_MODS: Record<AbilityKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

const featureId = (key: string) => `class:${key}`;

/** Ресурсы-пулы: тратятся именованными чертами, отдельной кнопкой не показываются. */
const POOL_KEYS = new Set<string>([
  'monk:focus',
  'sorcerer:sorceryPoints',
  'fighter.battleMaster:superiorityDice',
  'fighter.psiWarrior:psionicEnergyDice',
  'rogue.soulknife:psionicEnergyDice',
]);

/** Ресурсы без активируемого в бою применения (отдых/пассивка) — кнопкой не становятся. */
const PASSIVE_KEYS = new Set<string>([
  'wizard:arcaneRecovery',
  'druid.land:naturalRecovery',
  'wizard.scribes:ritualMastery',
  'artificer.alchemist:chemicalMastery',
  'paladin.ancients:elderChampion',
  'paladin.glory:livingLegend',
  'barbarian.zealot:warriorOfTheGods',
]);

interface FeatureMeta {
  name?: string;
  costs?: ActionCost[];
  targeting?: ActionTargeting;
  amount?: number;
}

/** Точные стоимость/таргетинг известных черт. Ключ — полный ключ ресурса. */
const FEATURE_META: Record<string, FeatureMeta> = {
  // Варвар
  'barbarian:rage': { costs: ['bonus'] },
  'barbarian.berserker:intimidatingPresence': { costs: ['bonus'], targeting: { kind: 'creature', range: 30 } },
  'barbarian.zealot:zealousPresence': { costs: ['bonus'] },
  'barbarian.zealot:rageOfTheGods': { costs: ['bonus'] },
  'barbarian.ancestralGuardian:consultTheSpirits': { costs: ['action'] },
  'barbarian.beast:infectiousFury': { targeting: { kind: 'creature' } },
  'barbarian.beast:callTheHunt': { costs: ['bonus'] },
  'barbarian.wildMagic:bolsteringMagic': { costs: ['action'], targeting: { kind: 'creature', range: 30 } },

  // Бард
  'bard:bardicInspiration': { costs: ['bonus'], targeting: { kind: 'creature', range: 60 } },
  'bard.glamour:beguilingMagic': { targeting: { kind: 'creature', range: 60 } },
  'bard.glamour:mantleOfMajesty': { costs: ['bonus'] },
  'bard.glamour:unbreakableMajesty': { costs: ['bonus'] },
  'bard.whispers:wordsOfTerror': { costs: ['action'], targeting: { kind: 'creature', range: 30 } },
  'bard.whispers:shadowLore': { costs: ['action'], targeting: { kind: 'creature', range: 30 } },
  'bard.creation:performanceOfCreation': { costs: ['action'] },
  'bard.creation:animatingPerformance': { costs: ['action'] },
  'bard.eloquence:infectiousInspiration': { targeting: { kind: 'creature', range: 60 } },
  'bard.eloquence:universalSpeech': { costs: ['action'] },

  // Жрец
  'cleric:channelDivinity': { costs: ['action'] },
  'cleric.light:wardingFlare': { costs: ['reaction'], targeting: { kind: 'creature', range: 30 } },
  'cleric.light:coronaOfLight': { costs: ['action'] },
  'cleric.war:warPriest': { costs: ['bonus'], targeting: { kind: 'creature' } },
  'cleric.forge:blessingOfTheForge': {},
  'cleric.grave:sentinelAtDeathsDoor': { costs: ['reaction'], targeting: { kind: 'creature', range: 30 } },
  'cleric.order:embodimentOfTheLaw': { costs: ['bonus'] },
  'cleric.peace:emboldeningBond': { costs: ['action'] },
  'cleric.twilight:stepsOfNight': { costs: ['bonus'] },
  'cleric.twilight:eyesOfNight': { costs: ['action'] },

  // Друид
  'druid:wildShape': { costs: ['bonus'] },
  'druid.moon:moonlightStep': { costs: ['bonus'] },
  'druid.stars:starMap': {},
  'druid.stars:cosmicOmen': { costs: ['reaction'] },
  'druid.dreams:balmOfTheSummerCourt': { costs: ['bonus'], targeting: { kind: 'creature', range: 120 } },
  'druid.dreams:hiddenPaths': { costs: ['bonus'] },
  'druid.dreams:walkerInDreams': { costs: ['action'] },
  'druid.shepherd:spiritTotem': { costs: ['bonus'] },
  'druid.shepherd:faithfulSummons': { costs: ['action'] },
  'druid.spores:fungalInfestation': { costs: ['reaction'], targeting: { kind: 'creature', range: 30 } },
  'druid.wildfire:cauterizingFlames': { costs: ['reaction'], targeting: { kind: 'creature', range: 30 } },
  'druid.wildfire:blazingRevival': {},

  // Воин
  'fighter:secondWind': { costs: ['bonus'] },
  'fighter:actionSurge': { costs: ['free'] },
  'fighter:indomitable': {},
  'fighter.battleMaster:knowYourEnemy': { targeting: { kind: 'creature', range: 30 } },
  'fighter.psiWarrior:psiPoweredLeap': { costs: ['bonus'] },
  'fighter.psiWarrior:bulwarkOfForce': { costs: ['bonus'] },
  'fighter.psiWarrior:telekineticMaster': { costs: ['action'] },
  'fighter.arcaneArcher:arcaneShot': { targeting: { kind: 'creature' } },
  'fighter.cavalier:unwaveringMark': { targeting: { kind: 'creature' } },
  'fighter.cavalier:wardingManeuver': { costs: ['reaction'], targeting: { kind: 'creature', range: 5 } },
  'fighter.samurai:fightingSpirit': { costs: ['bonus'] },
  'fighter.samurai:strengthBeforeDeath': {},
  'fighter.runeKnight:giantsMight': { costs: ['bonus'] },
  'fighter.runeKnight:runicShield': { costs: ['reaction'], targeting: { kind: 'creature', range: 60 } },

  // Монах
  'monk.openHand:wholenessOfBody': { costs: ['bonus'] },
  'monk.mercy:flurryOfHealingAndHarm': { costs: ['bonus'], targeting: { kind: 'creature' } },
  'monk.mercy:handOfUltimateMercy': { costs: ['action'], targeting: { kind: 'creature' } },

  // Паладин
  'paladin:layOnHands': { costs: ['action'], targeting: { kind: 'creature' } },
  'paladin:channelDivinity': { costs: ['action'] },
  'paladin.devotion:holyNimbus': { costs: ['action'] },
  'paladin.glory:gloriousDefense': { costs: ['reaction'] },
  'paladin.ancients:undyingSentinel': { costs: ['reaction'] },
  'paladin.vengeance:avengingAngel': { costs: ['action'] },
  'paladin.conquest:invincibleConqueror': { costs: ['action'] },
  'paladin.watchers:mortalBulwark': { costs: ['bonus'] },

  // Следопыт
  'ranger.feyWanderer:mistyWanderer': { costs: ['bonus'] },
  'ranger.feyWanderer:feyReinforcements': { costs: ['action'] },
  'ranger.gloomStalker:dreadAmbusher': { costs: ['bonus'] },
  'ranger.horizonWalker:detectPortal': { costs: ['action'] },
  'ranger.horizonWalker:etherealStep': { costs: ['bonus'] },
  'ranger.monsterSlayer:slayersPrey': { costs: ['bonus'], targeting: { kind: 'creature', range: 60 } },
  'ranger.monsterSlayer:magicUsersNemesis': { costs: ['reaction'], targeting: { kind: 'creature' } },
  'ranger.swarmkeeper:writhingTide': { targeting: { kind: 'creature' } },
  'ranger.swarmkeeper:swarmingDispersal': {},

  // Плут
  'rogue.arcaneTrickster:spellThief': { costs: ['reaction'], targeting: { kind: 'creature', range: 60 } },
  'rogue.soulknife:psychicVeil': { costs: ['action'] },
  'rogue.inquisitive:unerringEye': { costs: ['action'] },
  'rogue.swashbuckler:masterDuelist': {},
  'rogue.phantom:wailsFromTheGrave': { targeting: { kind: 'creature' } },

  // Чародей
  'sorcerer.draconic:dragonWings': { costs: ['bonus'] },
  'sorcerer.draconic:dragonCompanion': { costs: ['action'] },
  'sorcerer.wildMagic:tamedSurge': { costs: ['action'] },
  'sorcerer.aberrantMind:warpingImplosion': { costs: ['action'] },
  'sorcerer.clockwork:restoreBalance': { costs: ['reaction'] },
  'sorcerer.clockwork:tranceOfOrder': { costs: ['bonus'] },
  'sorcerer.clockwork:clockworkCavalcade': { costs: ['action'] },
  'sorcerer.divineSoul:favoredByTheGods': {},
  'sorcerer.divineSoul:unearthlyRecovery': { costs: ['action'] },
  'sorcerer.shadow:strengthOfTheGrave': {},
  'sorcerer.storm:windSoul': { costs: ['bonus'] },

  // Колдун
  'warlock.archfey:stepsOfTheFey': { costs: ['bonus'] },
  'warlock.archfey:beguilingDefenses': { costs: ['reaction'], targeting: { kind: 'creature', range: 30 } },
  'warlock.celestial:healingLight': { costs: ['bonus'], targeting: { kind: 'creature', range: 60 } },
  'warlock.celestial:searingVengeance': { targeting: { kind: 'creature' } },
  'warlock.fiend:darkOnesOwnLuck': {},
  'warlock.fiend:hurlThroughHell': { targeting: { kind: 'creature' } },
  'warlock.greatOldOne:clairvoyantCombatant': { targeting: { kind: 'creature', range: 30 } },
  'warlock.hexblade:hexbladesCurse': { costs: ['bonus'], targeting: { kind: 'creature', range: 30 } },
  'warlock.hexblade:accursedSpecter': { targeting: { kind: 'creature' } },
  'warlock.fathomless:tentacleOfTheDeeps': { costs: ['bonus'], targeting: { kind: 'creature', range: 60 } },
  'warlock.fathomless:graspingTentacles': { costs: ['action'] },
  'warlock.fathomless:fathomlessPlunge': { costs: ['bonus'] },
  'warlock.genie:elementalGift': { costs: ['action'] },
  'warlock.genie:limitedWish': { costs: ['action'] },

  // Волшебник
  'wizard.abjurer:arcaneWard': { costs: ['reaction'] },
  'wizard.diviner:portent': {},
  'wizard.diviner:thirdEye': { costs: ['bonus'] },
  'wizard.illusionist:illusorySelf': { costs: ['reaction'] },
  'wizard.warMagic:powerSurge': { targeting: { kind: 'creature' } },
  'wizard.bladesinging:bladesong': { costs: ['bonus'] },
  'wizard.scribes:manifestMind': { costs: ['bonus'] },
  'wizard.scribes:manifestMindConjure': { costs: ['action'] },
  'wizard.scribes:oneWithTheWord': {},

  // Изобретатель
  'artificer.alchemist:restorativeReagents': { costs: ['action'], targeting: { kind: 'creature', range: 30 } },
  'artificer.armorer:arcaneArmor': { costs: ['action'] },
  'artificer.armorer:perfectedArmor': {},
  'artificer.artillerist:eldritchCannon': { costs: ['action'] },
  'artificer.battleSmith:arcaneJolt': { targeting: { kind: 'creature' } },
};

interface NamedFeature extends ActionDef {
  className: string;
  subclass?: string;
  levelReq: number;
}

/** Именованные черты, тратящие ресурсы-пулы, а также не привязанные к одному ресурсу. */
const NAMED_FEATURES: NamedFeature[] = [
  { id: featureId('monk:focus/flurryOfBlows'), name: 'Шквал ударов', source: 'class', className: 'monk', levelReq: 2, costs: ['bonus'], targeting: { kind: 'creature' }, resourceKey: 'monk:focus', resourceAmount: 1 },
  { id: featureId('monk:focus/patientDefense'), name: 'Терпеливая оборона', source: 'class', className: 'monk', levelReq: 2, costs: ['bonus'], resourceKey: 'monk:focus', resourceAmount: 1 },
  { id: featureId('monk:focus/stepOfTheWind'), name: 'Шаг ветра', source: 'class', className: 'monk', levelReq: 2, costs: ['bonus'], resourceKey: 'monk:focus', resourceAmount: 1 },
  { id: featureId('sorcerer:sorceryPoints/metamagic'), name: 'Метамагия', source: 'class', className: 'sorcerer', levelReq: 2, costs: ['special'], resourceKey: 'sorcerer:sorceryPoints', resourceAmount: 1 },
  { id: featureId('fighter.battleMaster:superiorityDice/maneuver'), name: 'Манёвр', source: 'subclass', className: 'fighter', subclass: 'battleMaster', levelReq: 3, costs: ['special'], targeting: { kind: 'creature' }, resourceKey: 'fighter.battleMaster:superiorityDice', resourceAmount: 1 },
];

/**
 * Черты, доступные персонажу: из ресурсов его классов/подклассов (уровень учтён)
 * плюс именованные черты пулов. Ключ ресурса — полный (`класс:ресурс` или `класс.подкласс:ресурс`).
 */
export function classFeatures(classes: ClassLevel[]): ActionDef[] {
  const out: ActionDef[] = [];
  const seen = new Set<string>();
  const totalLevel = classes.reduce((acc, c) => acc + clampLevel(c.level), 0);

  for (const entry of classes) {
    const def = CLASSES[entry.className];
    if (!def) continue;
    const level = clampLevel(entry.level);
    const push = (prefix: string, source: 'class' | 'subclass', defs: { key: string; name: string; max: (l: number, m: Record<AbilityKey, number>, t: number) => number }[] | undefined) => {
      for (const r of defs ?? []) {
        const key = `${prefix}:${r.key}`;
        if (POOL_KEYS.has(key) || PASSIVE_KEYS.has(key)) continue;
        if (r.max(level, ZERO_MODS, totalLevel) <= 0) continue;
        const meta = FEATURE_META[key] ?? {};
        const id = featureId(key);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          name: meta.name ?? r.name,
          source,
          costs: meta.costs ?? ['special'],
          targeting: meta.targeting,
          resourceKey: key,
          resourceAmount: meta.amount ?? 1,
        });
      }
    };
    push(def.key, 'class', def.resources);
    if (entry.subclass) push(`${def.key}.${entry.subclass}`, 'subclass', def.subclasses[entry.subclass]?.resources);
  }

  for (const f of NAMED_FEATURES) {
    const entry = classes.find((c) => c.className === f.className);
    if (!entry) continue;
    if (f.subclass && entry.subclass !== f.subclass) continue;
    if (clampLevel(entry.level) < f.levelReq) continue;
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push({
      id: f.id,
      name: f.name,
      source: f.source,
      costs: f.costs,
      targeting: f.targeting,
      resourceKey: f.resourceKey,
      resourceAmount: f.resourceAmount,
      description: f.description,
    });
  }

  return out;
}
