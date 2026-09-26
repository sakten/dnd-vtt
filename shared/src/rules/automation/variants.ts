import { SKILLS } from '../../labels';
import { RESISTANCE_TYPES } from './header';

export interface AutomationOptions {
  /** Модификатор заклинательной характеристики кастера (Heroism: временные HP за ход). */
  spellMod?: number;
  /** Круг ячейки (по умолчанию — базовый круг заклинания). */
  castLevel?: number;
  /** Уровень персонажа для скейла кантрипов. */
  characterLevel?: number;
  /** Выбранные инвокации варлока (модификаторы Eldritch Blast). */
  invocations?: string[];
  /** Выбор варианта при касте (Dragon's Breath: тип урона выдоха). */
  variant?: string;
}

/** Вариант заклинания, выбираемый при касте (Dragon's Breath: тип урона; Enhance Ability: характеристика; Eyebite: эффект). */
export interface SpellVariantDef {
  param: 'damageType' | 'ability' | 'effect' | 'skill' | 'command';
  options: string[];
}

export const SPELL_VARIANTS: Record<string, SpellVariantDef> = {
  "XPHB:Dragon's Breath": { param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'poison'] },
  'XPHB:Enhance Ability': { param: 'ability', options: ['str', 'dex', 'int', 'wis', 'cha'] },
  'XPHB:Eyebite': { param: 'effect', options: ['asleep', 'panicked', 'sickened'] },
  'XPHB:Protection from Energy': { param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'thunder'] },
  'XGE:Elemental Bane': { param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'thunder'] },
  'XPHB:Resistance': { param: 'damageType', options: RESISTANCE_TYPES },
  'XPHB:Blindness/Deafness': { param: 'effect', options: ['blinded', 'deafened'] },
  'XGE:Skill Empowerment': { param: 'skill', options: SKILLS.map((s) => s.key) },
  'XPHB:Command': { param: 'command', options: ['approach', 'drop', 'flee', 'grovel', 'halt'] },
  // Bestow Curse: режим проклятия; checks-* — помеха проверкам и спасброскам характеристики.
  'XPHB:Bestow Curse': {
    param: 'effect',
    options: ['checks-str', 'checks-dex', 'checks-con', 'checks-int', 'checks-wis', 'checks-cha', 'attacks', 'dodge', 'necrotic'],
  },
  // True Strike: базовый урон — излучением или обычным типом оружия (+1d6 излучением всегда).
  'XPHB:True Strike': { param: 'damageType', options: ['weapon', 'radiant'] },
  'XPHB:Elemental Weapon': { param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning', 'thunder'] },
  'TCE:Spirit Shroud': { param: 'damageType', options: ['cold', 'necrotic', 'radiant'] },
  // Fire Shield: warm — сопротивление холоду и ответ огнём, chill — наоборот.
  'XPHB:Fire Shield': { param: 'effect', options: ['warm', 'chill'] },
  // Conjure Minor Elementals: тип доп. урона фиксируется при касте.
  'XPHB:Conjure Minor Elementals': { param: 'damageType', options: ['acid', 'cold', 'fire', 'lightning'] },
  // Destructive Wave: вторая часть урона — излучение или некротика (выбор при касте).
  'XPHB:Destructive Wave': { param: 'damageType', options: ['radiant', 'necrotic'] },
  // Wall of Thorns: форма стены шипов (вертикальная/горизонтальная) или круг радиусом 10 фт.
  'XPHB:Wall of Thorns': { param: 'effect', options: ['vertical', 'horizontal', 'ring'] },
  // Стены: форма задаёт `wallArea` (`WALL_DIMS`).
  'XPHB:Wall of Fire': { param: 'effect', options: ['vertical', 'horizontal', 'ring'] },
  'XPHB:Blade Barrier': { param: 'effect', options: ['vertical', 'horizontal', 'ring'] },
  'XGE:Wall of Sand': { param: 'effect', options: ['vertical', 'horizontal'] },
  // Wall of Ice: цепочка панелей по 10 фт (8 направлений) или купол/сфера r10 (секции с HP).
  'XPHB:Wall of Ice': { param: 'effect', options: ['wall', 'ring'] },
  // Wall of Force: цепочка панелей или купол/сфера r10 (прозрачная, неуязвимая).
  'XPHB:Wall of Force': { param: 'effect', options: ['wall', 'ring'] },
  // Wall of Stone: только цепочка панелей (секции с HP, без купола).
  'XPHB:Wall of Stone': { param: 'effect', options: ['wall'] },
};

/** Варианты каста заклинания (undefined — выбора нет). */
export function spellVariantDef(spellKey: string): SpellVariantDef | undefined {
  return SPELL_VARIANTS[spellKey];
}