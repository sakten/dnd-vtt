import type { BestiaryEntry } from '../domain/bestiary';

/**
 * Схематичные силуэты существ (до нормальных портретов): вид сбоку/анфас из
 * простых форм, узнаваемые по имени (волк, дракон, паук, скелет…). В строке
 * архетипа: %F% — основной цвет, %D% — тёмные детали (глаза/пасть),
 * %A% — акцент (свечение, клыки, узоры).
 */

export type CreatureArchetype =
  | 'wolf'
  | 'bear'
  | 'boar'
  | 'feline'
  | 'rat'
  | 'horse'
  | 'deer'
  | 'ape'
  | 'bat'
  | 'bird'
  | 'owl'
  | 'snake'
  | 'turtle'
  | 'lizard'
  | 'frog'
  | 'fish'
  | 'shark'
  | 'octopus'
  | 'spider'
  | 'scorpion'
  | 'crab'
  | 'insect'
  | 'worm'
  | 'humanoid'
  | 'goblin'
  | 'orc'
  | 'giant'
  | 'skeleton'
  | 'zombie'
  | 'ghost'
  | 'demon'
  | 'angel'
  | 'fairy'
  | 'dragon'
  | 'elementalFire'
  | 'elementalIce'
  | 'elementalEarth'
  | 'elementalAir'
  | 'golem'
  | 'slime'
  | 'tree'
  | 'mushroom'
  | 'plant'
  | 'swarm'
  | 'eye';

const LEGS4 =
  '<rect x="28" y="56" width="7" height="20" rx="3"/><rect x="40" y="58" width="7" height="18" rx="3"/><rect x="52" y="58" width="7" height="18" rx="3"/><rect x="62" y="56" width="7" height="20" rx="3"/>';

export const CREATURE_ART: Record<CreatureArchetype, string> = {
  wolf:
    '<path d="M24 46 C24 36 34 32 46 32 C58 32 66 38 66 48 L66 58 L58 58 L56 70 L50 70 L52 58 L40 58 L38 70 L32 70 L34 58 L30 56 C26 54 24 50 24 46 Z"/>' +
    '<path d="M62 42 C64 32 68 26 74 24 L86 30 L86 40 C86 46 80 48 74 46 Z"/>' +
    '<path d="M67 24 L70 13 L76 24 Z"/>' +
    '<path d="M26 42 C16 38 10 30 9 19 C17 29 24 35 32 38 Z"/>' +
    '<circle cx="80" cy="33" r="2.2" fill="%D%"/>',
  bear:
    '<ellipse cx="42" cy="48" rx="24" ry="17"/>' +
    '<circle cx="72" cy="40" r="12"/>' +
    '<circle cx="64" cy="29" r="5"/><circle cx="80" cy="27" r="5"/>' +
    '<circle cx="82" cy="43" r="4" fill="%D%"/>' +
    '<rect x="24" y="58" width="11" height="18" rx="4"/><rect x="40" y="60" width="11" height="16" rx="4"/><rect x="54" y="60" width="11" height="16" rx="4"/>',
  boar:
    '<ellipse cx="42" cy="50" rx="23" ry="14"/>' +
    '<path d="M26 36 L30 25 L34 36 Z M35 36 L39 24 L43 36 Z M44 36 L48 26 L52 36 Z"/>' +
    '<ellipse cx="70" cy="46" rx="10" ry="8"/>' +
    '<path d="M78 43 L91 46 L91 50 L78 50 Z"/>' +
    '<path d="M81 51 L86 58 L79 52 Z" fill="%A%"/>' +
    '<rect x="26" y="56" width="8" height="20" rx="3"/><rect x="40" y="58" width="8" height="18" rx="3"/><rect x="54" y="58" width="8" height="18" rx="3"/>',
  feline:
    '<ellipse cx="42" cy="48" rx="22" ry="12"/>' +
    '<circle cx="70" cy="40" r="9"/>' +
    '<path d="M63 33 L63 22 L70 31 Z"/><path d="M74 30 L79 20 L81 31 Z"/>' +
    '<path d="M20 44 C8 40 2 28 6 15 C10 28 16 36 26 40 Z"/>' +
    LEGS4 +
    '<circle cx="74" cy="38" r="1.8" fill="%D%"/>',
  rat:
    '<ellipse cx="44" cy="54" rx="18" ry="10"/>' +
    '<circle cx="66" cy="48" r="7"/>' +
    '<circle cx="61" cy="39" r="5"/><circle cx="71" cy="37" r="5"/>' +
    '<path d="M28 58 C13 60 5 68 7 77" fill="none" stroke="%F%" stroke-width="3"/>' +
    '<rect x="34" y="60" width="6" height="14" rx="2"/><rect x="48" y="60" width="6" height="14" rx="2"/><rect x="58" y="60" width="6" height="14" rx="2"/>' +
    '<circle cx="69" cy="47" r="1.6" fill="%D%"/>',
  horse:
    '<ellipse cx="42" cy="44" rx="22" ry="12"/>' +
    '<path d="M55 40 L67 17 L78 17 L74 30 L81 33 L77 42 Z"/>' +
    '<path d="M69 17 L69 8 L75 16 Z"/>' +
    '<path d="M20 40 C11 47 9 58 14 69" fill="none" stroke="%F%" stroke-width="4"/>' +
    '<rect x="28" y="52" width="6" height="24" rx="2"/><rect x="40" y="54" width="6" height="22" rx="2"/><rect x="52" y="54" width="6" height="22" rx="2"/><rect x="62" y="52" width="6" height="24" rx="2"/>' +
    '<circle cx="77" cy="26" r="1.8" fill="%D%"/>',
  deer:
    '<ellipse cx="42" cy="46" rx="20" ry="11"/>' +
    '<path d="M55 42 L64 20 L73 20 L70 32 L76 35 L72 43 Z"/>' +
    '<path d="M69 18 C64 10 64 5 66 2 M66 11 L60 6 M66 15 L72 8 M75 18 C80 10 80 5 78 2 M78 11 L84 6 M78 15 L72 8" stroke="%F%" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
    '<path d="M22 42 C14 48 12 58 16 68" fill="none" stroke="%F%" stroke-width="3.5"/>' +
    '<rect x="28" y="54" width="5" height="22" rx="2"/><rect x="39" y="56" width="5" height="20" rx="2"/><rect x="50" y="56" width="5" height="20" rx="2"/><rect x="59" y="54" width="5" height="22" rx="2"/>',
  ape:
    '<circle cx="48" cy="27" r="12"/>' +
    '<circle cx="48" cy="32" r="6" fill="%D%"/>' +
    '<path d="M35 37 C26 42 22 52 22 66 L33 66 C33 54 37 47 42 43 Z"/>' +
    '<path d="M61 37 C70 42 74 52 74 66 L63 66 C63 54 59 47 54 43 Z"/>' +
    '<rect x="40" y="37" width="16" height="26" rx="7"/>' +
    '<rect x="40" y="60" width="7" height="15" rx="3"/><rect x="50" y="60" width="7" height="15" rx="3"/>',
  bat:
    '<ellipse cx="48" cy="52" rx="9" ry="13"/>' +
    '<path d="M60 44 L72 25 L78 24 L75 34 L82 44" fill="none" stroke="%F%" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M36 44 L24 25 L18 24 L21 34 L14 44" fill="none" stroke="%F%" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M40 42 C24 32 8 36 4 48 C10 45 14 47 18 53 C22 49 26 50 30 56 C34 51 38 52 41 58 Z"/>' +
    '<path d="M56 42 C72 32 88 36 92 48 C86 45 82 47 78 53 C74 49 70 50 66 56 C62 51 58 52 55 58 Z"/>' +
    '<path d="M42 40 L39 30 L47 37 Z"/><path d="M54 40 L57 30 L49 37 Z"/>' +
    '<circle cx="44" cy="45" r="1.6" fill="%A%"/><circle cx="52" cy="45" r="1.6" fill="%A%"/>',
  bird:
    '<ellipse cx="44" cy="46" rx="18" ry="12"/>' +
    '<circle cx="65" cy="34" r="8"/>' +
    '<path d="M71 33 L86 36 L71 41 Z" fill="%A%"/>' +
    '<path d="M34 38 C26 28 14 26 6 30 C12 35 16 41 18 48 C24 41 28 39 34 44 Z"/>' +
    '<path d="M28 46 L10 54 L12 60 L30 52 Z"/>' +
    '<rect x="40" y="56" width="4" height="18" rx="2"/><rect x="50" y="56" width="4" height="18" rx="2"/>' +
    '<circle cx="68" cy="32" r="1.8" fill="%D%"/>',
  owl:
    '<ellipse cx="48" cy="48" rx="20" ry="23"/>' +
    '<path d="M32 28 L30 13 L43 24 Z"/><path d="M64 28 L66 13 L53 24 Z"/>' +
    '<circle cx="40" cy="42" r="7" fill="%A%"/><circle cx="56" cy="42" r="7" fill="%A%"/>' +
    '<circle cx="40" cy="42" r="3" fill="%D%"/><circle cx="56" cy="42" r="3" fill="%D%"/>' +
    '<path d="M45 50 L51 50 L48 57 Z" fill="%D%"/>' +
    '<path d="M44 68 L42 76 L46 76 Z M52 68 L54 76 L50 76 Z"/>',
  snake:
    '<path d="M12 72 C30 72 28 50 46 50 C64 50 62 30 78 30" fill="none" stroke="%F%" stroke-width="13" stroke-linecap="round"/>' +
    '<ellipse cx="80" cy="29" rx="9" ry="7"/>' +
    '<path d="M87 30 L93 32 M87 32 L93 34" stroke="%A%" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="82" cy="27" r="1.8" fill="%D%"/>',
  turtle:
    '<path d="M22 62 C22 44 34 34 49 34 C64 34 76 44 76 62 Z"/>' +
    '<path d="M34 50 L44 44 L56 46 M40 60 L48 50 L60 54 M30 58 L40 60" fill="none" stroke="%D%" stroke-width="2"/>' +
    '<circle cx="82" cy="56" r="7"/>' +
    '<circle cx="85" cy="54" r="1.6" fill="%D%"/>' +
    '<rect x="24" y="62" width="9" height="12" rx="3"/><rect x="66" y="62" width="9" height="12" rx="3"/>',
  lizard:
    '<ellipse cx="46" cy="52" rx="19" ry="10"/>' +
    '<path d="M30 48 C18 44 10 36 8 26 C16 36 24 42 34 44 Z"/>' +
    '<path d="M62 44 L78 40 L90 46 L78 52 L62 52 Z"/>' +
    '<path d="M78 46 L90 46" stroke="%A%" stroke-width="2"/>' +
    '<rect x="30" y="58" width="6" height="14" rx="2"/><rect x="56" y="58" width="6" height="14" rx="2"/>' +
    '<circle cx="84" cy="43" r="1.8" fill="%D%"/>',
  frog:
    '<ellipse cx="48" cy="58" rx="20" ry="13"/>' +
    '<circle cx="38" cy="40" r="8"/><circle cx="58" cy="40" r="8"/>' +
    '<circle cx="38" cy="40" r="4" fill="%A%"/><circle cx="58" cy="40" r="4" fill="%A%"/>' +
    '<circle cx="38" cy="40" r="2" fill="%D%"/><circle cx="58" cy="40" r="2" fill="%D%"/>' +
    '<path d="M28 62 C20 64 16 70 18 76 L34 74 Z"/><path d="M68 62 C76 64 80 70 78 76 L62 74 Z"/>',
  fish:
    '<ellipse cx="50" cy="52" rx="24" ry="12"/>' +
    '<path d="M28 52 L10 38 L10 66 Z"/>' +
    '<path d="M46 40 L52 28 L60 40 Z"/><path d="M46 64 L52 76 L60 64 Z"/>' +
    '<circle cx="64" cy="49" r="2.4" fill="%D%"/>' +
    '<path d="M66 55 C70 57 72 55 74 53" fill="none" stroke="%D%" stroke-width="2"/>',
  shark:
    '<path d="M22 56 C30 42 46 38 62 42 C76 45 84 50 88 56 C84 60 76 62 62 62 C46 64 30 62 22 56 Z"/>' +
    '<path d="M40 42 L48 24 L56 44 Z"/>' +
    '<path d="M26 54 L8 40 L12 58 Z"/>' +
    '<path d="M60 50 L60 58 M65 50 L65 58 M70 51 L70 57" stroke="%D%" stroke-width="2"/>' +
    '<circle cx="76" cy="52" r="2" fill="%D%"/>',
  octopus:
    '<path d="M48 20 C60 20 68 30 68 42 C68 50 62 56 48 56 C34 56 28 50 28 42 C28 30 36 20 48 20 Z"/>' +
    '<path d="M34 54 C28 64 30 70 24 76" fill="none" stroke="%F%" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M42 56 C38 66 40 72 36 78" fill="none" stroke="%F%" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M54 56 C58 66 56 72 60 78" fill="none" stroke="%F%" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M62 54 C68 64 66 70 72 76" fill="none" stroke="%F%" stroke-width="6" stroke-linecap="round"/>' +
    '<circle cx="41" cy="38" r="4.5" fill="%A%"/><circle cx="55" cy="38" r="4.5" fill="%A%"/>' +
    '<circle cx="41" cy="38" r="2" fill="%D%"/><circle cx="55" cy="38" r="2" fill="%D%"/>',
  spider:
    '<circle cx="48" cy="44" r="10"/>' +
    '<circle cx="48" cy="60" r="13"/>' +
    '<path d="M40 40 C28 34 20 24 18 12 M40 48 C26 48 16 44 8 36 M40 56 C28 60 20 68 16 78 M44 64 C36 74 34 82 36 90" fill="none" stroke="%F%" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M56 40 C68 34 76 24 78 12 M56 48 C70 48 80 44 88 36 M56 56 C68 60 76 68 80 78 M52 64 C60 74 62 82 60 90" fill="none" stroke="%F%" stroke-width="3.5" stroke-linecap="round"/>' +
    '<circle cx="44" cy="41" r="2" fill="%A%"/><circle cx="52" cy="41" r="2" fill="%A%"/>',
  scorpion:
    '<ellipse cx="44" cy="52" rx="14" ry="8"/>' +
    '<path d="M56 48 C70 44 80 34 78 20 C77 12 70 8 66 12" fill="none" stroke="%F%" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M66 12 L62 4 L72 10 Z" fill="%A%"/>' +
    '<path d="M30 48 C22 42 14 44 10 52 C14 52 16 56 14 60 C20 58 26 56 32 54 Z"/>' +
    '<path d="M30 56 L22 64 M36 58 L30 68 M44 58 L40 68 M50 56 L54 64" stroke="%F%" stroke-width="2.5" stroke-linecap="round"/>',
  crab:
    '<ellipse cx="48" cy="54" rx="20" ry="13"/>' +
    '<path d="M28 46 C18 40 12 42 8 48 C14 48 16 52 14 56 C20 56 26 54 32 40 Z"/>' +
    '<path d="M68 46 C78 40 84 42 88 48 C82 48 80 52 82 56 C76 56 70 54 64 40 Z"/>' +
    '<path d="M32 62 L24 70 M40 64 L34 74 M56 64 L62 74 M64 62 L72 70" stroke="%F%" stroke-width="3" stroke-linecap="round"/>' +
    '<rect x="42" y="36" width="4" height="8" rx="2"/><rect x="52" y="36" width="4" height="8" rx="2"/>' +
    '<circle cx="44" cy="35" r="2.4" fill="%A%"/><circle cx="54" cy="35" r="2.4" fill="%A%"/>',
  insect:
    '<ellipse cx="48" cy="50" rx="10" ry="16"/>' +
    '<ellipse cx="30" cy="44" rx="12" ry="7" transform="rotate(-28 30 44)"/>' +
    '<ellipse cx="66" cy="44" rx="12" ry="7" transform="rotate(28 66 44)"/>' +
    '<path d="M42 32 C36 22 30 18 24 16 M54 32 C60 22 66 18 72 16" fill="none" stroke="%F%" stroke-width="2.5" stroke-linecap="round"/>' +
    '<circle cx="24" cy="15" r="3"/><circle cx="72" cy="15" r="3"/>' +
    '<path d="M38 44 L26 38 M38 52 L24 52 M38 60 L26 66 M58 44 L70 38 M58 52 L72 52 M58 60 L70 66" stroke="%F%" stroke-width="2.5" stroke-linecap="round"/>' +
    '<circle cx="44" cy="32" r="2" fill="%A%"/><circle cx="52" cy="32" r="2" fill="%A%"/>',
  worm:
    '<path d="M14 72 C30 58 34 76 50 62 C66 48 70 66 84 54" fill="none" stroke="%F%" stroke-width="12" stroke-linecap="round" stroke-dasharray="12 5"/>' +
    '<circle cx="86" cy="52" r="2.4" fill="%D%"/>',
  humanoid:
    '<circle cx="48" cy="24" r="10"/>' +
    '<rect x="39" y="36" width="18" height="24" rx="7"/>' +
    '<rect x="26" y="38" width="10" height="26" rx="5" transform="rotate(14 31 51)"/>' +
    '<rect x="60" y="38" width="10" height="26" rx="5" transform="rotate(-14 65 51)"/>' +
    '<rect x="40" y="58" width="8" height="18" rx="3"/><rect x="50" y="58" width="8" height="18" rx="3"/>',
  goblin:
    '<path d="M48 18 C59 18 66 26 66 35 C66 42 62 46 56 48 L40 48 C34 46 30 42 30 35 C30 26 37 18 48 18 Z"/>' +
    '<path d="M32 30 C18 26 10 30 6 38 C16 36 24 38 32 42 Z"/><path d="M64 30 C78 26 86 30 90 38 C80 36 72 38 64 42 Z"/>' +
    '<circle cx="43" cy="33" r="2.2" fill="%D%"/><circle cx="53" cy="33" r="2.2" fill="%D%"/>' +
    '<rect x="36" y="48" width="24" height="20" rx="8"/>' +
    '<rect x="28" y="50" width="8" height="20" rx="4"/><rect x="60" y="50" width="8" height="20" rx="4"/>' +
    '<rect x="38" y="66" width="8" height="12" rx="3"/><rect x="50" y="66" width="8" height="12" rx="3"/>',
  orc:
    '<circle cx="48" cy="24" r="12"/>' +
    '<path d="M40 30 L40 38 L44 30 Z M56 30 L56 38 L52 30 Z" fill="%A%"/>' +
    '<rect x="30" y="36" width="36" height="24" rx="8"/>' +
    '<rect x="20" y="38" width="11" height="26" rx="5"/><rect x="65" y="38" width="11" height="26" rx="5"/>' +
    '<rect x="38" y="58" width="9" height="18" rx="3"/><rect x="49" y="58" width="9" height="18" rx="3"/>' +
    '<circle cx="43" cy="22" r="2.2" fill="%D%"/><circle cx="53" cy="22" r="2.2" fill="%D%"/>',
  giant:
    '<circle cx="44" cy="20" r="11"/>' +
    '<circle cx="40" cy="18" r="1.8" fill="%D%"/><circle cx="48" cy="18" r="1.8" fill="%D%"/>' +
    '<rect x="30" y="32" width="28" height="28" rx="8"/>' +
    '<rect x="18" y="34" width="11" height="30" rx="5"/><rect x="59" y="34" width="11" height="30" rx="5"/>' +
    '<rect x="34" y="58" width="9" height="18" rx="3"/><rect x="45" y="58" width="9" height="18" rx="3"/>' +
    '<rect x="70" y="20" width="7" height="30" rx="3" transform="rotate(24 73 35)"/>' +
    '<ellipse cx="76" cy="16" rx="9" ry="7" transform="rotate(24 76 16)"/>',
  skeleton:
    '<circle cx="48" cy="20" r="9"/>' +
    '<path d="M42 28 L54 28 L52 34 L44 34 Z"/>' +
    '<circle cx="45" cy="18" r="2.2" fill="%D%"/><circle cx="51" cy="18" r="2.2" fill="%D%"/>' +
    '<rect x="46" y="34" width="4" height="22" rx="2"/>' +
    '<path d="M36 38 C40 34 56 34 60 38 M36 44 C40 40 56 40 60 44 M37 50 C41 46 55 46 59 50" fill="none" stroke="%F%" stroke-width="3.5"/>' +
    '<path d="M46 56 L42 62 L46 70 M50 56 L54 62 L50 70" fill="none" stroke="%F%" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M36 38 L26 50 M60 38 L70 50" fill="none" stroke="%F%" stroke-width="3.5" stroke-linecap="round"/>',
  zombie:
    '<circle cx="50" cy="22" r="10"/>' +
    '<circle cx="46" cy="20" r="2" fill="%D%"/><circle cx="54" cy="21" r="2" fill="%D%"/>' +
    '<rect x="40" y="34" width="20" height="24" rx="7" transform="rotate(-8 50 46)"/>' +
    '<rect x="58" y="34" width="9" height="24" rx="4" transform="rotate(-58 62 46)"/>' +
    '<rect x="30" y="36" width="9" height="24" rx="4" transform="rotate(32 34 48)"/>' +
    '<rect x="40" y="56" width="8" height="18" rx="3"/><rect x="51" y="55" width="8" height="18" rx="3"/>',
  ghost:
    '<path d="M48 14 C64 14 74 28 74 46 L74 78 C70 72 66 78 62 72 C58 78 54 72 50 78 C46 72 42 78 38 72 C34 78 30 72 26 78 L26 46 C26 28 32 14 48 14 Z"/>' +
    '<circle cx="42" cy="38" r="4" fill="%D%"/><circle cx="56" cy="38" r="4" fill="%D%"/>' +
    '<path d="M44 52 C46 56 52 56 54 52" fill="none" stroke="%D%" stroke-width="2.5"/>',
  demon:
    '<circle cx="48" cy="24" r="11"/>' +
    '<path d="M40 16 C34 8 28 6 24 8 C30 10 34 14 37 20 Z"/><path d="M56 16 C62 8 68 6 72 8 C66 10 62 14 59 20 Z"/>' +
    '<path d="M40 34 C28 26 16 26 8 34 C16 36 20 40 22 48 C28 40 34 38 40 42 Z"/>' +
    '<path d="M56 34 C68 26 80 26 88 34 C80 36 76 40 74 48 C68 40 62 38 56 42 Z"/>' +
    '<rect x="38" y="34" width="20" height="22" rx="7"/>' +
    '<path d="M52 56 C60 62 62 70 58 76 C56 70 52 66 48 64 Z"/>' +
    '<circle cx="44" cy="22" r="2.2" fill="%A%"/><circle cx="52" cy="22" r="2.2" fill="%A%"/>' +
    '<rect x="40" y="54" width="7" height="16" rx="3"/><rect x="49" y="54" width="7" height="16" rx="3"/>',
  angel:
    '<circle cx="48" cy="10" r="6" fill="none" stroke="%A%" stroke-width="3"/>' +
    '<circle cx="48" cy="26" r="10"/>' +
    '<path d="M38 38 C28 30 18 30 12 36 C18 38 22 42 24 48 C30 42 34 40 38 44 Z"/>' +
    '<path d="M58 38 C68 30 78 30 84 36 C78 38 74 42 72 48 C66 42 62 40 58 44 Z"/>' +
    '<rect x="39" y="36" width="18" height="24" rx="7"/>' +
    '<path d="M30 30 C26 44 26 58 30 70" fill="none" stroke="%A%" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M66 30 C70 44 70 58 66 70" fill="none" stroke="%A%" stroke-width="3" stroke-linecap="round"/>' +
    '<rect x="40" y="58" width="8" height="16" rx="3"/><rect x="49" y="58" width="8" height="16" rx="3"/>',
  fairy:
    '<circle cx="48" cy="30" r="9"/>' +
    '<ellipse cx="30" cy="30" rx="13" ry="9" transform="rotate(-30 30 30)" fill="%A%"/>' +
    '<ellipse cx="66" cy="30" rx="13" ry="9" transform="rotate(30 66 30)" fill="%A%"/>' +
    '<ellipse cx="34" cy="46" rx="10" ry="7" transform="rotate(-20 34 46)" fill="%A%"/>' +
    '<ellipse cx="62" cy="46" rx="10" ry="7" transform="rotate(20 62 46)" fill="%A%"/>' +
    '<rect x="44" y="38" width="8" height="24" rx="4"/>' +
    '<path d="M44 22 C40 14 36 10 32 8 M52 22 C56 14 60 10 64 8" fill="none" stroke="%F%" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="32" cy="7" r="2.4"/><circle cx="64" cy="7" r="2.4"/>',
  dragon:
    '<ellipse cx="38" cy="56" rx="20" ry="12"/>' +
    '<path d="M52 48 C58 32 62 24 72 20 L82 24 L78 32 L84 36 L74 40 C68 44 62 48 56 54 Z"/>' +
    '<path d="M70 20 L66 10 L74 17 Z"/><path d="M78 24 L80 12 L84 20 Z"/>' +
    '<path d="M30 44 C18 30 6 26 2 30 C10 34 14 42 16 52 C22 44 26 42 32 46 Z"/>' +
    '<path d="M22 56 C10 58 4 66 6 76 C12 70 18 68 24 68 Z"/>' +
    '<circle cx="76" cy="28" r="2.2" fill="%D%"/>' +
    '<rect x="26" y="62" width="8" height="14" rx="3"/><rect x="44" y="62" width="8" height="14" rx="3"/>',
  elementalFire:
    '<path d="M48 8 C60 28 74 36 74 54 C74 68 63 78 48 78 C33 78 22 68 22 54 C22 42 30 32 38 22 C39 32 43 38 48 42 C52 32 50 18 48 8 Z"/>' +
    '<path d="M48 40 C54 46 58 52 58 58 C58 66 53 70 48 70 C43 70 38 66 38 58 C38 52 42 46 48 40 Z" fill="%D%"/>' +
    '<circle cx="43" cy="56" r="2" fill="%A%"/><circle cx="53" cy="56" r="2" fill="%A%"/>',
  elementalIce:
    '<path d="M48 6 L60 34 L48 46 L36 34 Z"/><path d="M22 34 L38 40 L34 66 L18 58 Z"/><path d="M74 34 L78 58 L62 66 L58 40 Z"/>' +
    '<circle cx="43" cy="28" r="2.2" fill="%D%"/><circle cx="53" cy="28" r="2.2" fill="%D%"/>',
  elementalEarth:
    '<path d="M26 48 L34 26 L54 24 L68 40 L64 62 L40 68 L28 60 Z"/>' +
    '<path d="M20 44 L10 56 L18 68 L28 60 Z"/><path d="M76 44 L86 56 L78 68 L66 60 Z"/>' +
    '<circle cx="42" cy="42" r="2.4" fill="%A%"/><circle cx="54" cy="42" r="2.4" fill="%A%"/>',
  elementalAir:
    '<path d="M18 62 C34 62 32 44 48 44 C62 44 60 28 74 28 C84 28 88 34 88 40" fill="none" stroke="%F%" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M14 74 C32 74 30 58 46 58 C58 58 56 46 68 46" fill="none" stroke="%A%" stroke-width="4" stroke-linecap="round"/>' +
    '<circle cx="76" cy="18" r="3" fill="%A%"/><circle cx="60" cy="12" r="2" fill="%A%"/>',
  golem:
    '<rect x="36" y="14" width="24" height="20" rx="4"/>' +
    '<rect x="30" y="36" width="36" height="26" rx="4"/>' +
    '<rect x="16" y="38" width="12" height="28" rx="4"/><rect x="68" y="38" width="12" height="28" rx="4"/>' +
    '<rect x="34" y="62" width="11" height="16" rx="3"/><rect x="51" y="62" width="11" height="16" rx="3"/>' +
    '<circle cx="43" cy="23" r="2.6" fill="%A%"/><circle cx="53" cy="23" r="2.6" fill="%A%"/>',
  slime:
    '<path d="M12 58 C12 38 28 26 48 26 C68 26 84 38 84 58 C84 70 74 78 62 78 L58 86 L52 78 L46 86 L42 78 L34 78 C20 78 12 70 12 58 Z"/>' +
    '<circle cx="38" cy="54" r="4.5" fill="%D%"/><circle cx="58" cy="54" r="4.5" fill="%D%"/>' +
    '<circle cx="30" cy="42" r="2.4" fill="%A%"/><circle cx="64" cy="40" r="2" fill="%A%"/>',
  tree:
    '<path d="M42 50 L42 78 L54 78 L54 50 Z"/>' +
    '<ellipse cx="48" cy="32" rx="24" ry="18"/>' +
    '<ellipse cx="30" cy="40" rx="12" ry="10"/><ellipse cx="66" cy="40" rx="12" ry="10"/>' +
    '<circle cx="42" cy="30" r="2.6" fill="%A%"/><circle cx="54" cy="30" r="2.6" fill="%A%"/>' +
    '<path d="M42 50 L26 62 M54 50 L70 62" stroke="%F%" stroke-width="5" stroke-linecap="round"/>',
  mushroom:
    '<path d="M42 48 C42 42 54 42 54 48 L54 76 C54 80 42 80 42 76 Z"/>' +
    '<path d="M18 48 C18 28 32 16 48 16 C64 16 78 28 78 48 Z"/>' +
    '<circle cx="34" cy="34" r="5" fill="%A%"/><circle cx="54" cy="28" r="6" fill="%A%"/><circle cx="64" cy="40" r="4" fill="%A%"/>' +
    '<circle cx="45" cy="60" r="2" fill="%D%"/><circle cx="51" cy="66" r="2" fill="%D%"/>',
  plant:
    '<path d="M46 80 L46 40 L50 40 L50 80 Z"/>' +
    '<path d="M48 52 C34 52 22 44 18 30 C34 30 46 38 48 52 Z"/>' +
    '<path d="M48 40 C62 40 74 32 78 18 C62 18 50 26 48 40 Z"/>' +
    '<circle cx="48" cy="20" r="8" fill="%A%"/>' +
    '<circle cx="48" cy="20" r="3.4" fill="%D%"/>',
  swarm:
    '<circle cx="26" cy="30" r="4"/><circle cx="48" cy="20" r="4.5"/><circle cx="70" cy="30" r="4"/><circle cx="36" cy="50" r="5"/><circle cx="60" cy="50" r="5"/><circle cx="24" cy="68" r="4"/><circle cx="48" cy="62" r="5"/><circle cx="72" cy="68" r="4"/>' +
    '<path d="M22 24 C18 18 20 14 26 14 M52 14 C48 8 50 4 56 4 M74 24 C78 18 76 14 70 14" fill="none" stroke="%A%" stroke-width="2" stroke-linecap="round"/>',
  eye:
    '<ellipse cx="48" cy="40" rx="30" ry="20"/>' +
    '<circle cx="48" cy="40" r="10" fill="%A%"/>' +
    '<circle cx="48" cy="40" r="4.5" fill="%D%"/>' +
    '<path d="M30 56 C26 64 30 70 26 78 M42 58 C40 68 44 74 42 82 M54 58 C56 68 52 74 54 82 M66 56 C70 64 66 70 70 78" fill="none" stroke="%F%" stroke-width="3.5" stroke-linecap="round"/>',
};

/** Правила «имя существа → архетип» (по порядку, первое совпадение). */
const RULES: { re: RegExp; art: CreatureArchetype }[] = [
  { re: /dragon|wyvern|wyrm|drake|draconic|hydra|tarrasque|dinosaur|t-rex|triceratops|plesiosaur|pteranodon/, art: 'dragon' },
  { re: /wolf|dog\b|hound|jackal|coyote|fox|hyena|mastiff|worg|cerberus/, art: 'wolf' },
  { re: /bear|badger|wolverine|otter|beaver|hedgehog/, art: 'bear' },
  { re: /boar|pig|hog|warthog/, art: 'boar' },
  { re: /lion|tiger|panther|leopard|jaguar|cheetah|puma|cougar|lynx|sabertooth|saber-toothed|cat\b/, art: 'feline' },
  { re: /\brat\b|\brats\b|mouse|squirrel|weasel|marten|ferret|mole|shrew/, art: 'rat' },
  { re: /horse|stallion|mare|pony|pegasus|unicorn|centaur|nightmare|steed/, art: 'horse' },
  { re: /deer|elk|moose|stag|antelope|caribou|goat|ram|sheep|ox\b|yak|buffalo|bison|cow\b|bull\b/, art: 'deer' },
  { re: /mammoth|elephant/, art: 'bear' },
  { re: /\bape\b|gorilla|monkey|baboon|orangutan|chimp/, art: 'ape' },
  { re: /bat\b|bat,|vampire bat|swarm of bats/, art: 'bat' },
  { re: /owl/, art: 'owl' },
  { re: /hawk|eagle|falcon|raven|crow|vulture|condor|robin|sparrow|swan|duck|goose|stork|heron|crane|pelican|harpy|griffin|griffon|phoenix|roc\b/, art: 'bird' },
  { re: /snake|serpent|cobra|viper|python|adder|boa\b|constrictor|naga/, art: 'snake' },
  { re: /turtle|tortoise|dragon turtle/, art: 'turtle' },
  { re: /crocodile|alligator|croc|lizard|basilisk|salamander|newt|drake|komodo/, art: 'lizard' },
  { re: /frog|toad|bullywug|slaad/, art: 'frog' },
  { re: /shark/, art: 'shark' },
  { re: /fish|piranha|sahuagin|merfolk|mermaid|triton|koalinth|locathah|kua-toa|kuo-toa|angler|\beel\b|\bray\b|carp|salmon|trout/, art: 'fish' },
  { re: /octopus|squid|kraken|nautilus/, art: 'octopus' },
  { re: /spider|tarantula|arachnid|ettercap|drider/, art: 'spider' },
  { re: /scorpion/, art: 'scorpion' },
  { re: /crab|crayfish|shrimp|lobster/, art: 'crab' },
  { re: /beetle|insect|mantis|\bant\b|bee\b|wasp|hornet|fly\b|mosquito|moth|butterfly|dragonfly|cockroach|locust|cricket\b|flea|tick\b|centipede|scarab|swarm of insects|swarm of beetles|swarm of locusts/, art: 'insect' },
  { re: /worm|larva|maggot|leech|slug|snail|nematode|purple worm|swarm of worms/, art: 'worm' },
  { re: /skeleton|skeletal|bone|boneclaw|poltergeist|wight|spawn of|skeletons|ossuary/, art: 'skeleton' },
  { re: /zombie|ghoul|ghast|corpse|revenant|husk|dretch|mohrg/, art: 'zombie' },
  // Шаблоны призывов и «духи» с уточнением в имени — до общих правил по словам.
  { re: /beast of the sea|beast of the water/, art: 'fish' },
  { re: /bestial|beast of the|beast of/, art: 'wolf' },
  { re: /aberrant/, art: 'eye' },
  { re: /construct|animated object/, art: 'golem' },
  { re: /^elemental|elemental spirit|elemental\b/, art: 'elementalFire' },
  { re: /\bfey\b|fey spirit/, art: 'fairy' },
  { re: /fiendish|fiend spirit/, art: 'demon' },
  { re: /celestial/, art: 'angel' },
  { re: /undead/, art: 'skeleton' },
  { re: /ghost|specter|spectre|wraith|shadow|shade|spirit|banshee|poltergeist|will-o|wisp|allip|wraith/, art: 'ghost' },
  { re: /mummy/, art: 'zombie' },
  { re: /vampire|vampiric/, art: 'bat' },
  { re: /lich|necromancer/, art: 'skeleton' },
  { re: /demon|devil|fiend|imp\b|quasit|balor|succubus|incubus|glabrezu|marilith|nalfeshnee|hezrou|vrock|shadow demon|yugoloth|night hag|hag\b|on\\b?i|daemon/, art: 'demon' },
  { re: /angel|deva|planetar|solar|celestial|unicorn|kirin|couatl/, art: 'angel' },
  { re: /fairy|pixie|sprite|dryad|nymph|sylph|sprite|grig|nixie|blink dog|displacer|yeth/, art: 'fairy' },
  { re: /goblin/, art: 'goblin' },
  { re: /orc/, art: 'orc' },
  { re: /troll|ogre|ettin|cyclops|fomorian|giant|gigant|half-ogre|ogre mage/, art: 'giant' },
  { re: /golem|construct|automaton|animated|armor|armour|shield guardian|clockwork|modron|inevitable|scarecrow|helmed horror|guardian/, art: 'golem' },
  { re: /slime|ooze|jelly|cube|pudding|ochre|mimic/, art: 'slime' },
  { re: /treant|tree|ent\b|awakened tree|shambling mound|wood woad|myconid|fungus|mushroom|spore|shrieker|violet fungus|gas spore/, art: 'mushroom' },
  { re: /plant|vine|flower|thorn|blight|vegepygmy|shambling/, art: 'plant' },
  { re: /swarm/, art: 'swarm' },
  { re: /beholder|gazer|eye\b|occuluth|spectator|aberrat|mind flayer|illithid|tentacle|flumph|gibbering|otyugh|neogi|grick|choker|grell/, art: 'eye' },
  { re: /elemental/, art: 'elementalFire' },
  { re: /fire|flame|magma|lava|efreet|efreeti|azer|firenewt|salander|hell hound|hellhound|cinder/, art: 'elementalFire' },
  { re: /ice|frost|snow|winter|glacier|remorhaz/, art: 'elementalIce' },
  { re: /earth|stone|rock|sand|dirt|gargoyle/, art: 'elementalEarth' },
  { re: /air|wind|storm|cloud|djinn|djinni|invisible stalker|sylph|mist/, art: 'elementalAir' },
  { re: /goblin|kobold|gnome|halfling|imp\b/, art: 'goblin' },
  { re: /dwarf|elf|human|soldier|guard|knight|warrior|mage|wizard|priest|cultist|thug|bandit|noble|merchant|druid|monk|rogue|assassin|gladiator|veteran|acolyte|adept|scout|spy|archer|bladesinger|warlock|sorcer|warlord|champion|apprentice|archmage|berserker|tribal|commoner|drow|duergar|gith|yuan|eladrin|shadar|satyr|firbolg|goliath|tiefling|aasimar|genasi|tabaxi|kenku|loxodon|lizardfolk|tortle|aarakocra|gnoll|bugbear|hobgoblin|loxo|minotaur|githyanki|githzerai|revenant|thri-kreen|grung|changeling|warforged|kalashtar|shifter|shifte|moon druid/, art: 'humanoid' },
];

const TYPE_FALLBACK: Record<string, CreatureArchetype> = {
  beast: 'wolf',
  dragon: 'dragon',
  undead: 'skeleton',
  fiend: 'demon',
  celestial: 'angel',
  fey: 'fairy',
  construct: 'golem',
  elemental: 'elementalFire',
  giant: 'giant',
  humanoid: 'humanoid',
  monstrosity: 'feline',
  ooze: 'slime',
  plant: 'plant',
  aberration: 'eye',
  swarm: 'swarm',
};

export function creatureArchetype(entry: BestiaryEntry): CreatureArchetype {
  const name = entry.name.toLowerCase();
  for (const rule of RULES) {
    if (rule.re.test(name)) return rule.art;
  }
  return TYPE_FALLBACK[entry.type.split('/')[0]!.trim().toLowerCase()] ?? 'eye';
}

/* ── Аксессуары по описанию внешности: голова/торс/рука ─────────────────── */

type AnchorKind = 'head' | 'torso' | 'hand' | 'offhand';

const HEAD_ANCHOR: Partial<Record<CreatureArchetype, [number, number]>> = {
  humanoid: [48, 15],
  goblin: [48, 11],
  orc: [48, 12],
  giant: [44, 9],
  skeleton: [48, 11],
  zombie: [50, 12],
  demon: [48, 13],
  angel: [48, 17],
  fairy: [48, 21],
  horse: [71, 10],
  wolf: [72, 18],
  bear: [72, 22],
  feline: [70, 25],
  deer: [69, 12],
  rat: [66, 32],
  boar: [70, 31],
  bird: [65, 26],
  owl: [48, 25],
  dragon: [72, 12],
  ape: [48, 11],
  insect: [48, 30],
  spider: [48, 34],
  ghost: [48, 22],
  slime: [48, 34],
  eye: [48, 22],
  turtle: [82, 49],
};

const TORSO_ANCHOR: Partial<Record<CreatureArchetype, [number, number]>> = {
  humanoid: [48, 48],
  goblin: [48, 50],
  orc: [48, 46],
  giant: [44, 46],
  skeleton: [48, 42],
  zombie: [50, 46],
  demon: [48, 46],
  angel: [48, 44],
  fairy: [48, 44],
  horse: [42, 42],
  wolf: [44, 42],
  bear: [42, 40],
  feline: [42, 42],
  deer: [42, 40],
  rat: [44, 50],
  boar: [42, 42],
  bird: [44, 44],
  owl: [48, 48],
  dragon: [38, 52],
  ape: [48, 48],
  spider: [48, 58],
  ghost: [48, 48],
  insect: [48, 50],
  snake: [46, 50],
  lizard: [46, 52],
  turtle: [48, 52],
};

const HAND_ANCHOR: Partial<Record<CreatureArchetype, [number, number]>> = {
  humanoid: [70, 50],
  goblin: [70, 54],
  orc: [72, 48],
  giant: [74, 46],
  skeleton: [70, 46],
  zombie: [72, 44],
  demon: [70, 48],
  angel: [70, 46],
  fairy: [64, 46],
  ape: [70, 56],
};

const ACCESSORY = {
  horns:
    '<path d="M-10 3 C-18 -4 -20 -12 -16 -19 C-10 -12 -4 -6 1 -2 Z"/><path d="M10 3 C18 -4 20 -12 16 -19 C10 -12 4 -6 -1 -2 Z" fill="%F%"/>',
  antlers:
    '<path d="M-5 2 C-11 -6 -13 -14 -11 -21 M-11 -11 L-19 -15 M-11 -5 L-19 -5 M5 2 C11 -6 13 -14 11 -21 M11 -11 L19 -15 M11 -5 L19 -5" stroke="%F%" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
  halo: '<ellipse cx="0" cy="-3" rx="10" ry="3.2" fill="none" stroke="%A%" stroke-width="2.5"/>',
  crown:
    '<path d="M-11 3 L-11 -5 L-4 -1 L0 -8 L4 -1 L11 -5 L11 3 Z"/><circle cx="0" cy="-1" r="1.6" fill="%A%"/>',
  bandana:
    '<path d="M-12 3 C-12 -6 12 -6 12 3 L9 3 C7 -2 -7 -2 -9 3 Z"/><path d="M11 -1 L17 3 L11 4 Z" fill="%A%"/>',
  helm: '<path d="M-11 4 C-11 -8 11 -8 11 4 L11 8 L-11 8 Z"/><rect x="-2" y="-3" width="4" height="11" fill="%D%"/>',
  wings:
    '<path d="M-8 -8 C-26 -20 -42 -16 -48 -4 C-38 -6 -32 -2 -28 6 C-30 -4 -24 -8 -18 -8 C-20 -14 -16 -18 -10 -18 Z"/><path d="M8 -8 C26 -20 42 -16 48 -4 C38 -6 32 -2 28 6 C30 -4 24 -8 18 -8 C20 -14 16 -18 10 -18 Z"/>',
  robe: '<path d="M-17 -14 C-23 4 -23 18 -19 24 L19 24 C23 18 23 4 17 -14 Z"/>',
  tail: '<path d="M-6 6 C-24 10 -34 22 -32 34 C-26 22 -16 14 -4 12 Z"/>',
  sword:
    '<path d="M-2 -25 L2 -25 L2 3 L-2 3 Z"/><rect x="-8" y="3" width="16" height="3" rx="1"/><rect x="-2" y="6" width="4" height="8"/><path d="M0 -25 L2 -29 L-2 -29 Z" fill="%A%"/>',
  axe: '<rect x="-2" y="-16" width="4" height="30" rx="1"/><path d="M2 -18 C12 -16 14 -4 8 2 L2 -1 Z"/>',
  club: '<rect x="-3" y="-16" width="6" height="28" rx="3"/><ellipse cx="0" cy="-19" rx="8" ry="10"/>',
  bow: '<path d="M4 -16 C16 -8 16 8 4 16" fill="none" stroke="%F%" stroke-width="3.5"/><path d="M4 -16 L4 16" stroke="%A%" stroke-width="1.4"/>',
  staff: '<rect x="-2" y="-16" width="4" height="34" rx="2"/><circle cx="0" cy="-20" r="5.5" fill="%A%"/>',
  shield:
    '<path d="M0 -13 L13 -9 L13 4 C13 12 7 16 0 19 C-7 16 -13 12 -13 4 L-13 -9 Z"/><path d="M0 -7 L0 12 M-7 1 L7 1" stroke="%D%" stroke-width="2" fill="none"/>',
} as const;

const FEATURE_RULES: { re: RegExp; kind: AnchorKind; art: string; one?: boolean }[] = [
  { re: /horns?\b/, kind: 'head', art: ACCESSORY.horns, one: true },
  { re: /antlers/, kind: 'head', art: ACCESSORY.antlers, one: true },
  { re: /halo/, kind: 'head', art: ACCESSORY.halo, one: true },
  { re: /crown/, kind: 'head', art: ACCESSORY.crown, one: true },
  { re: /bandana/, kind: 'head', art: ACCESSORY.bandana, one: true },
  { re: /armor/, kind: 'head', art: ACCESSORY.helm, one: true },
  { re: /wings/, kind: 'torso', art: ACCESSORY.wings },
  { re: /robes/, kind: 'torso', art: ACCESSORY.robe },
  { re: /bushy tail|tail\b|tentacles/, kind: 'torso', art: ACCESSORY.tail },
  { re: /wielding a heavy axe|crescent.*axe/, kind: 'hand', art: ACCESSORY.axe, one: true },
  { re: /wielding a (drawn sword|small blade|crude weapon)/, kind: 'hand', art: ACCESSORY.sword, one: true },
  { re: /wielding a crushing mace|wielding a heavy club/, kind: 'hand', art: ACCESSORY.club, one: true },
  { re: /wielding a ready bow/, kind: 'hand', art: ACCESSORY.bow, one: true },
  { re: /wielding a staff/, kind: 'hand', art: ACCESSORY.staff, one: true },
];

const ANCHORS: Record<AnchorKind, Partial<Record<CreatureArchetype, [number, number]>>> = {
  head: HEAD_ANCHOR,
  torso: TORSO_ANCHOR,
  hand: HAND_ANCHOR,
  offhand: TORSO_ANCHOR,
};

/** Слои аксессуаров по описанию внешности: за силуэтом и перед ним. */
export function creatureFeatures(
  entry: BestiaryEntry,
  fill: string,
  dark: string,
  accent: string
): { behind: string; front: string } {
  const archetype = creatureArchetype(entry);
  const text = entry.appearance.toLowerCase();
  const used = new Set<string>();
  const behind: string[] = [];
  const front: string[] = [];
  const paint = (art: string) => art.replace(/%F%/g, fill).replace(/%D%/g, dark).replace(/%A%/g, accent);

  for (const rule of FEATURE_RULES) {
    if (rule.one && used.has(rule.kind)) continue;
    if (!rule.re.test(text)) continue;
    const anchor = ANCHORS[rule.kind][archetype];
    if (!anchor) continue;
    used.add(rule.kind);
    const piece = `<g transform="translate(${anchor[0]} ${anchor[1]})">${paint(rule.art)}</g>`;
    (rule.kind === 'torso' ? behind : front).push(piece);
  }

  if (/polished armor/.test(text)) {
    const [x, y] = TORSO_ANCHOR[archetype] ?? [48, 46];
    front.push(`<g transform="translate(${x} ${y})">${paint(ACCESSORY.shield)}</g>`);
  }

  return { behind: behind.join(''), front: front.join('') };
}

/** Детерминированный сдвиг оттенка, чтобы иконки одного облика различались. */
export function creatureTint(entry: BestiaryEntry, accent: string): string {
  let h = 2166136261;
  for (let i = 0; i < entry.key.length; i++) {
    h ^= entry.key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const shift = ((h >>> 0) % 1000000) / 1000000;
  const target = shift > 0.5 ? '#ffffff' : '#05070a';
  return mixColor(accent, target, 0.04 + shift * 0.14);
}

function mixColor(hex: string, other: string, t: number): string {
  const parse = (value: string) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(other);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  return `#${channel(r1!, r2!)}${channel(g1!, g2!)}${channel(b1!, b2!)}`;
}

/** Схематичный силуэт существа с подставленными цветами. */
export function creatureArt(entry: BestiaryEntry, fill: string, dark: string, accent: string): string {
  return CREATURE_ART[creatureArchetype(entry)].replace(/%F%/g, fill).replace(/%D%/g, dark).replace(/%A%/g, accent);
}
