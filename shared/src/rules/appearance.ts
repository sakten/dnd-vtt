import type { BestiaryEntry, MonsterSize } from '../domain/bestiary';
import { creatureArchetype, type CreatureArchetype } from './creatureArt';

/**
 * Короткое описание внешности существа (EN): база для иконки и будущих
 * портретов. Собирается детерминированно из имени/типа/статов — сначала
 * описание, потом рисунок.
 */

const SIZE_WORD: Record<MonsterSize, string> = {
  T: 'tiny',
  S: 'small',
  M: 'medium-sized',
  L: 'large',
  H: 'huge',
  G: 'gargantuan',
};

const NOUN: Record<CreatureArchetype, string> = {
  wolf: 'four-legged wolf-like beast',
  bear: 'massive shaggy bear',
  boar: 'bristly tusked boar',
  feline: 'sleek feline predator',
  rat: 'skulking rodent',
  horse: 'powerful equine',
  deer: 'antlered ungulate',
  ape: 'hulking ape',
  bat: 'membrane-winged bat',
  bird: 'feathered bird',
  owl: 'round-eyed owl',
  snake: 'coiled serpent',
  turtle: 'shelled reptile',
  lizard: 'scaled reptile',
  frog: 'amphibious frog-like creature',
  fish: 'aquatic fish-like creature',
  shark: 'predatory shark',
  octopus: 'many-tentacled cephalopod',
  spider: 'eight-legged arachnid',
  scorpion: 'armored scorpion',
  crab: 'clawed crustacean',
  insect: 'chitinous insect',
  worm: 'segmented worm',
  humanoid: 'humanoid',
  goblin: 'small green-skinned goblinoid',
  orc: 'broad-shouldered orc',
  giant: 'towering giant',
  skeleton: 'skeletal undead',
  zombie: 'rotting undead',
  ghost: 'translucent spirit',
  demon: 'horned fiend',
  angel: 'radiant celestial',
  fairy: 'tiny winged fey',
  dragon: 'scaled dragon',
  elementalFire: 'living flame elemental',
  elementalIce: 'crystalline ice elemental',
  elementalEarth: 'hulking stone elemental',
  elementalAir: 'swirling air elemental',
  golem: 'constructed golem',
  slime: 'translucent oozing slime',
  tree: 'walking tree creature',
  mushroom: 'fungus-covered creature',
  plant: 'thorny plant creature',
  swarm: 'swarm of tiny creatures',
  eye: 'floating eye with tentacles',
};

interface FeatureRule {
  re: RegExp;
  text: string;
}

const NAME_FEATURES: FeatureRule[] = [
  { re: /minotaur|bull\b|cow\b|\box\b|rhino/, text: 'long curved bull horns' },
  { re: /demon|devil|fiend|imp\b|quasit|balor|succubus|incubus|marilith|glabrezu|hezrou|vrock|nalfeshnee/, text: 'curved horns' },
  { re: /dragon|wyvern|wyrm|draconic/, text: 'curved horns and leathery wings' },
  { re: /elk|moose|stag|deer|caribou/, text: 'spreading antlers' },
  { re: /unicorn/, text: 'a single spiral horn' },
  { re: /pegasus|griffin|griffon|sphinx|harpy|pteranodon/, text: 'broad feathered wings' },
  { re: /angel|deva|planetar|solar|celestial|couatl/, text: 'feathered wings and a radiant halo' },
  { re: /bat\b|vampire|imp\b|quasit|swarm of bats/, text: 'leathery bat wings' },
  { re: /fairy|pixie|sprite|sylph|nixie/, text: 'delicate butterfly wings' },
  { re: /bee\b|wasp|hornet|dragonfly|moth|butterfly|insect/, text: 'translucent buzzing wings' },
  { re: /boar|orc|mammoth|elephant|walrus/, text: 'prominent tusks' },
  { re: /lion/, text: 'a thick mane' },
  { re: /tiger/, text: 'striped fur' },
  { re: /wolf|dog\b|hound|jackal|coyote|fox|hyena|worg|werewolf/, text: 'sharp fangs and a bushy tail' },
  { re: /bear|badger|wolverine|otter|beaver/, text: 'heavy claws' },
  { re: /snake|serpent|cobra|viper|python|naga/, text: 'fangs and forked tongue' },
  { re: /shark/, text: 'rows of jagged teeth and fins' },
  { re: /octopus|kraken|squid|nautilus|eye\b|gazer|beholder/, text: 'wriggling tentacles' },
  { re: /turtle|tortoise/, text: 'a heavy shell' },
  { re: /dragon|wyvern|wyrm|lizard|crocodile|basilisk/, text: 'scales' },
  { re: /mage|wizard|sorcer|warlock|archmage|apprentice|diviner|abjurer|evoker|illusionist|necromancer|enchanter|conjurer|witch/, text: 'flowing arcane robes' },
  { re: /priest|cleric|acolyte|druid|cultist|fanatic|zealot|adept|shaman|lich/, text: 'ceremonial robes' },
  { re: /knight|paladin|guard|soldier|veteran|gladiator|champion|warrior|bladesinger/, text: 'polished armor' },
  { re: /king|queen|emperor|empress|noble|lord|lady|chief|boss|warlord/, text: 'a jeweled crown' },
  { re: /pirate|corsair|captain/, text: 'a bright bandana' },
  { re: /goblin/, text: 'ragged leathers' },
  { re: /skeleton|skeletal|bone/, text: 'bare bones' },
  { re: /zombie|ghoul|ghast|corpse|revenant|mummy/, text: 'rotting flesh' },
  { re: /ghost|specter|spectre|wraith|shade|shadow|banshee/, text: 'a ghostly translucent form' },
  { re: /slime|ooze|jelly|cube|pudding|ochre/, text: 'a translucent gelatinous body' },
  { re: /tree|treant|ent\b/, text: 'bark-like hide and leafy branches' },
  { re: /mushroom|fungus|spore|myconid/, text: 'a cap of fungus and drifting spores' },
  { re: /golem|construct|automaton|animated|armor/, text: 'a body of plates and stone' },
];

const WEAPON_FEATURES: FeatureRule[] = [
  { re: /greataxe|handaxe|battleaxe|axe/, text: 'a heavy axe' },
  { re: /greatsword|longsword|scimitar|shortsword|rapier|sword/, text: 'a drawn sword' },
  { re: /maul|warhammer|hammer|mace/, text: 'a crushing mace' },
  { re: /glaive|halberd|pike|spear|lance/, text: 'a long polearm' },
  { re: /longbow|shortbow|crossbow|bow\b/, text: 'a ready bow' },
  { re: /dagger|knife|stiletto/, text: 'a small blade' },
  { re: /staff|quarterstaff|wand/, text: 'a staff' },
  { re: /club|cudgel/, text: 'a heavy club' },
];

function firstMatch(rules: FeatureRule[], text: string): string | undefined {
  for (const rule of rules) {
    if (rule.re.test(text)) return rule.text;
  }
  return undefined;
}

function auraFor(entry: BestiaryEntry): string | undefined {
  const type = entry.immunities[0] ?? entry.resistances[0];
  switch (type) {
    case 'fire':
      return 'wreathed in embers';
    case 'cold':
      return 'rimed with frost';
    case 'lightning':
      return 'crackling with lightning';
    case 'poison':
      return 'dripping venom';
    case 'acid':
      return 'slick with acid';
    case 'necrotic':
      return 'trailing necrotic shadows';
    case 'radiant':
      return 'glowing with radiance';
    default:
      return undefined;
  }
}

/** Короткое описание внешности (EN) — единый источник для иконок и портретов. */
export function buildAppearance(entry: BestiaryEntry): string {
  const name = entry.name.toLowerCase();
  const archetype = creatureArchetype(entry);
  const size = SIZE_WORD[entry.size];
  const noun = NOUN[archetype];

  const features: string[] = [];
  const push = (value: string | undefined) => {
    if (value && !features.includes(value)) features.push(value);
  };

  if (entry.familiar) push('small enough to perch on a shoulder');
  push(firstMatch(NAME_FEATURES, name));
  const weaponName = firstMatch(WEAPON_FEATURES, entry.attacks.map((a) => a.name.toLowerCase()).join(' '));
  if (weaponName) push(`wielding ${weaponName}`);
  else if (/humanoid|goblin|orc|giant/.test(archetype)) push('wielding a crude weapon');
  push(auraFor(entry));
  if (entry.spellcasting) push('traces of arcane power');
  if (entry.multiattack && entry.multiattack >= 3) push('striking with blinding speed');

  const detail = features.length ? ` with ${features.join(', ')}` : '';
  return `A ${size} ${noun}${detail}.`;
}
