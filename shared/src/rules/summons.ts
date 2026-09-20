import type { EffectDuration } from '../domain/effects';

/**
 * Привязка заклинаний-призывов к шаблонам каталога бестиария.
 * Скейл HP/AC/урона — из `BestiaryEntry.summon`; длительность берётся
 * у заклинания (концентрация) либо из `duration` (фамильяр — постоянный).
 */
export interface SummonSpellDef {
  /** Базовый круг заклинания (ниже шаблон не используется). */
  baseLevel: number;
  initiative: 'afterCaster' | 'own';
  /** Ключ шаблона каталога (одиночный призыв). */
  template?: string;
  /** Формы выбираются из каталога по флагу `familiar` (Find Familiar). */
  fromFamiliar?: boolean;
  count?: number;
  duration?: EffectDuration;
}

export const SUMMON_SPELLS: Record<string, SummonSpellDef> = {
  'XPHB:Find Familiar': { baseLevel: 1, initiative: 'own', fromFamiliar: true, duration: { type: 'permanent' } },
  'XPHB:Find Steed': { baseLevel: 2, initiative: 'afterCaster', template: 'XPHB:Otherworldly Steed' },
  'XPHB:Summon Beast': { baseLevel: 2, initiative: 'afterCaster', template: 'XPHB:Bestial Spirit' },
  'XPHB:Summon Fey': { baseLevel: 3, initiative: 'afterCaster', template: 'XPHB:Fey Spirit' },
  'XPHB:Summon Undead': { baseLevel: 3, initiative: 'afterCaster', template: 'XPHB:Undead Spirit' },
  'XPHB:Summon Aberration': { baseLevel: 4, initiative: 'afterCaster', template: 'XPHB:Aberrant Spirit' },
  'XPHB:Summon Construct': { baseLevel: 4, initiative: 'afterCaster', template: 'XPHB:Construct Spirit' },
  'XPHB:Summon Elemental': { baseLevel: 4, initiative: 'afterCaster', template: 'XPHB:Elemental Spirit' },
  'XPHB:Giant Insect': { baseLevel: 4, initiative: 'afterCaster', template: 'XPHB:Giant Insect' },
  'XPHB:Summon Celestial': { baseLevel: 5, initiative: 'afterCaster', template: 'XPHB:Celestial Spirit' },
  'XPHB:Summon Dragon': { baseLevel: 5, initiative: 'afterCaster', template: 'XPHB:Draconic Spirit' },
  'XPHB:Summon Fiend': { baseLevel: 6, initiative: 'afterCaster', template: 'XPHB:Fiendish Spirit' },
};

export function summonSpellDef(spellKey: string): SummonSpellDef | undefined {
  return SUMMON_SPELLS[spellKey];
}

/**
 * Особые формы Pact of the Chain (XPHB 2024). Проверка владения чертой —
 * когда в каталог попадут воззвания (сейчас их данных нет); движок формы принимает.
 * Slaad Tadpole в SRD-каталоге отсутствует.
 */
export const PACT_OF_CHAIN_FORMS = [
  'XMM:Imp',
  'XMM:Pseudodragon',
  'XMM:Quasit',
  'XMM:Skeleton',
  'XMM:Sphinx of Wonder',
  'XMM:Sprite',
  'XMM:Venomous Snake',
];
