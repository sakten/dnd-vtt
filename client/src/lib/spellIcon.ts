import type { Spell } from 'shared';

/** Визуал заклинания: глиф, акцент (эффект) и цвет рамки (школа). */

const SCHOOL_FRAME: Record<string, string> = {
  Abjuration: '#6ea8ff',
  Conjuration: '#e0a83e',
  Divination: '#4fd0c0',
  Enchantment: '#e07ad1',
  Evocation: '#ff7a59',
  Illusion: '#a98bff',
  Necromancy: '#9a6fd0',
  Transmutation: '#7fd18a',
};

const DAMAGE_ACCENT: Record<string, string> = {
  fire: '#ff6b35',
  cold: '#5db9ff',
  lightning: '#ffd166',
  acid: '#a3e635',
  poison: '#7ec850',
  necrotic: '#b06bff',
  radiant: '#ffd76b',
  psychic: '#ff7ac6',
  force: '#b18cff',
  thunder: '#8fb8ff',
  bludgeoning: '#b7a98a',
  piercing: '#b7a98a',
  slashing: '#b7a98a',
  healing: '#4ecb71',
};

/** Ключевые слова имени → глиф (в порядке приоритета). */
const KEYWORDS: [RegExp, string][] = [
  [/fireball|explosion|erupt|detonate|burst|implosion/, 'burst'],
  [/burning hands|cone of cold|cone|breath|roar/, 'cone'],
  [/scorching ray|ray|beam|disintegrate|searing/, 'ray'],
  [/fire|flame|burn|ignit|inferno|heat|ember|hellish/, 'fire'],
  [/cold|frost|ice|freezing|snow|blizzard|sleet/, 'cold'],
  [/lightning|shock|electr|chain light/, 'lightning'],
  [/acid|corros/, 'acid'],
  [/poison|venom|toxic|cloudkill|stinking/, 'poison'],
  [/necrotic|blight|wither|decay|animate dead|wraith|vampir/, 'necrotic'],
  [/radiant|holy|sacred|sunbeam|daylight|guiding bolt|searing smite|flame strike|moonbeam/, 'radiant'],
  [/psychic|mind|psionic|telekin|telepath|aberrant|maddening/, 'psychic'],
  [/force|magic missile|eldritch|arcane|mordenkainen|bigby|spiritual weapon/, 'force'],
  [/thunder|sonic|shatter|thunderwave|earthquake/, 'thunder'],
  [/cure|heal|mending|regain|restor|balm|regen|recovery|goodberry/, 'heal'],
  [/revivify|revive|raise dead|resurrect|reincarnate|resurrection/, 'revival'],
  [/bless|aid|heroism|enhance|guidance|inspiration|mantle|nimbus|valor/, 'buff'],
  [/bane|curse|hex|doom|blight|harm|woe|misfortune/, 'curse'],
  [/shield|ward|protect|armor|abjur|sanctuary|guard|aegis/, 'ward'],
  [/charm|dominat|suggestion|command|glamour|enthrall|faerie/, 'charm'],
  [/fear|frighten|dread|phantasmal|horr/, 'fear'],
  [/illusion|minor illusion|silent image|major image|mirror image|disguise|blur|hallucin/, 'illusion'],
  [/misty step|teleport|dimension door|plane shift|portal|ethereal|blink|far step|scry/, 'teleport'],
  [/summon|conjure|find familiar|find steed|animate|servant|unseen|spirit|familiar|companion/, 'summon'],
  [/detect|identify|see invisibility|true sight|truesight|clairvoyance|arcane eye|locate|augury|divination|portent|foresight/, 'divination'],
  [/hold |dominate|compel|geas|control|bind|command|entangle|snare|restrain/, 'control'],
  [/wall|prismatic/, 'wall'],
  [/aura|spirit guardians|guardian|halo|spirit/, 'aura'],
  [/touch|hand|grasp|claw|fist|grasping/, 'hand'],
  [/ritual|glyph|symbol|circle|magic circle|warding/, 'ritual'],
  [/dispel|counter|antimagic|remove|abjur/, 'counter'],
  [/banish|banishment|dismissal|planar/, 'banish'],
  [/polymorph|shapechange|wild shape|beast shape|alter self/, 'polymorph'],
  [/fly|flight|levitate|wing|feather|aerial/, 'flight'],
  [/invisib|invisible|hidden|hide|vanish/, 'invisibility'],
  [/create|creation|fabricate|conjure|make|forge|mend/, 'create'],
  [/light|lantern|dancing lights|glow|spark|luminous/, 'light'],
  [/dark|darkness|shadow|night|eclipse|gloom/, 'darkness'],
  [/silence|silenced|mute|stillness/, 'silence'],
  [/message|sending|speak|tongue|word|telepath|communication|language/, 'communication'],
  [/jump|expeditious|haste|speed|dash|stride|step|stride/, 'movement'],
  [/plant|thorn|entangle|druid|nature|leaf|growth|spike|vine|tree/, 'nature'],
  [/weather|storm|cloud|fog|wind|gust|rain|fog cloud|call lightning/, 'weather'],
  [/time|slow|haste|chrono|temporal|hourglass|age/, 'time'],
  [/luck|fate|portent|augury|fortune|omen|dice/, 'fate'],
  [/revival|revivify|resurrect/, 'revival'],
  [/gravity|gravit|reverse|fall|levitate/, 'gravity'],
  [/enlarge|reduce|size|giant|shrink/, 'size'],
  [/sleep|slumber|dream|drowse|catnap/, 'sleep'],
  [/trap|snare|glyph|spike|alarm/, 'trap'],
  [/beast|animal|paw|wild|swarm|insect/, 'beast'],
];

const SCHOOL_FALLBACK: Record<string, string> = {
  Abjuration: 'ward',
  Conjuration: 'summon',
  Divination: 'divination',
  Enchantment: 'charm',
  Evocation: 'burst',
  Illusion: 'illusion',
  Necromancy: 'necrotic',
  Transmutation: 'polymorph',
};

export interface SpellVisual {
  glyph: string;
  accent: string;
  frame: string;
}

export function spellVisual(spell: Spell): SpellVisual {
  const name = spell.name.toLowerCase();
  let glyph: string | undefined;
  for (const [re, id] of KEYWORDS) {
    if (re.test(name)) {
      glyph = id;
      break;
    }
  }

  const accent =
    (spell.damage?.types ?? []).map((t) => DAMAGE_ACCENT[t.toLowerCase()]).find(Boolean) ??
    (name.match(/cure|heal|restor|regain/) ? DAMAGE_ACCENT.healing : undefined) ??
    SCHOOL_FRAME[spell.school] ??
    '#9aa4b2';

  if (!glyph) {
    const dmg = (spell.damage?.types ?? [])[0]?.toLowerCase();
    glyph = dmg ? dmg : SCHOOL_FALLBACK[spell.school] ?? 'rune';
  }

  return { glyph, accent, frame: SCHOOL_FRAME[spell.school] ?? '#5a6472' };
}
