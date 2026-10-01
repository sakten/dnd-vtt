import { generatedAutomation, type EffectDuration, type EffectSpec, type SpellDef, type ZoneSpec } from 'shared';
import { blankMeta, blankRecord, blankZone } from './spellConstructor';

/**
 * Таксономия конструктора (Р1): «что накладываем» (payload) × «как попадаем»
 * (resolution) × «куда/как долго» (delivery). Чистое отображение на текущий
 * `AutomationSpec` — без нового формата данных.
 */

export type KitPayload = 'damage' | 'heal' | 'effect' | 'summon' | 'utility' | 'weapon' | 'shape' | 'manual';
export type KitResolution = 'attack' | 'save' | 'auto';
export type KitDelivery = 'creatures' | 'area' | 'zone' | 'aura';

export interface SpellKit {
  payload: KitPayload;
  resolution?: KitResolution;
  delivery?: KitDelivery;
}

export const KIT_PAYLOADS: { id: KitPayload; labelKey: string; hintKey: string }[] = [
  { id: 'damage', labelKey: 'ui.constructor.kit.damage', hintKey: 'ui.constructor.kit.damageHint' },
  { id: 'heal', labelKey: 'ui.constructor.kit.heal', hintKey: 'ui.constructor.kit.healHint' },
  { id: 'effect', labelKey: 'ui.constructor.kit.effect', hintKey: 'ui.constructor.kit.effectHint' },
  { id: 'summon', labelKey: 'ui.constructor.kit.summon', hintKey: 'ui.constructor.kit.summonHint' },
  { id: 'utility', labelKey: 'ui.constructor.kit.utility', hintKey: 'ui.constructor.kit.utilityHint' },
  { id: 'weapon', labelKey: 'ui.constructor.kit.weapon', hintKey: 'ui.constructor.kit.weaponHint' },
  { id: 'shape', labelKey: 'ui.constructor.kit.shape', hintKey: 'ui.constructor.kit.shapeHint' },
  { id: 'manual', labelKey: 'ui.constructor.kit.manual', hintKey: 'ui.constructor.kit.manualHint' },
];

export const KIT_RESOLUTIONS: KitResolution[] = ['attack', 'save', 'auto'];
export const KIT_DELIVERIES: KitDelivery[] = ['creatures', 'area', 'zone', 'aura'];

/** Payload'ы, для которых выбирается ось «как × куда» (остальные — сразу форма). */
export function isGridPayload(payload: KitPayload): boolean {
  return payload === 'damage' || payload === 'heal' || payload === 'effect';
}

/** Совместимые доставки: атака — только по целям; спас/авто — все четыре. */
export function kitDeliveries(resolution: KitResolution): KitDelivery[] {
  return resolution === 'attack' ? ['creatures'] : KIT_DELIVERIES;
}

/** Эффект-носитель для профилей «эффект» (бафф/контроль). */
function carrierEffect(name: string): EffectSpec {
  return { id: 'effect', name, duration: { type: 'permanent' }, to: 'targets', modifiers: [] };
}

/** Запись по выбранному kit'у: мета + стартовая автоматизация. */
export function kitRecord(name: string, kit: SpellKit): SpellDef {
  if (kit.payload === 'summon') return blankRecord('summon', name);
  if (kit.payload === 'utility') return blankRecord('utility', name);
  if (kit.payload === 'manual') {
    return { ...blankMeta(name), automation: { primary: 'manual', manual: { byDesign: true } } };
  }
  if (kit.payload === 'shape') {
    const spell = blankMeta(name);
    spell.save = ['wis'];
    return { ...spell, automation: { primary: 'save', save: { ability: 'wis' }, shape: { kind: 'polymorph' } } };
  }
  if (kit.payload === 'weapon') {
    const spell = blankMeta(name);
    spell.spellAttack = 'melee';
    spell.damage = { dice: ['1d8'], types: ['force'] };
    return {
      ...spell,
      automation: {
        primary: 'attack',
        attack: { rangeType: 'melee' },
        count: { ref: 'spellAttackCount' },
        weaponAttack: { anyWeapon: true, riderDice: '1d6' },
        damage: { dice: { ref: 'spellDamage' }, types: ['force'] },
      },
    };
  }

  const spell = blankMeta(name);
  const resolution = kit.resolution ?? 'save';
  if (kit.payload === 'heal') {
    spell.healing = true;
    if (resolution === 'attack') {
      spell.spellAttack = 'melee';
      spell.damage = { dice: ['3d6'], types: ['necrotic'] };
      return withDelivery({ ...spell, automation: { ...generatedAutomation(spell), lifesteal: true } }, kit);
    }
    if (resolution === 'save') {
      spell.save = ['con'];
      spell.saveHalf = true;
      spell.damage = { dice: ['4d8'], types: [] };
    } else {
      spell.damage = { dice: ['2d8'], types: [] };
    }
    return withDelivery({ ...spell, automation: generatedAutomation(spell) }, kit);
  }
  if (kit.payload === 'effect') {
    const effect = carrierEffect(name);
    if (resolution === 'attack') {
      spell.spellAttack = 'melee';
      spell.damage = { dice: ['1d8'], types: ['force'] };
      return withDelivery(
        {
          ...spell,
          automation: {
            primary: 'attack',
            attack: { rangeType: 'melee' },
            count: { ref: 'spellAttackCount' },
            weaponAttack: {
              anyWeapon: true,
              hitEffect: { name, duration: { type: 'endOfTurn', of: 'target' }, to: 'targets', modifiers: [] },
            },
            damage: { dice: { ref: 'spellDamage' }, types: ['force'] },
          },
        },
        kit
      );
    }
    if (resolution === 'save') {
      spell.save = ['wis'];
      return withDelivery(
        {
          ...spell,
          automation: {
            primary: 'effect',
            save: { ability: 'wis' },
            effects: [{ ...effect, conditions: [] }],
          },
        },
        kit
      );
    }
    return withDelivery({ ...spell, automation: { primary: 'effect', effects: [effect] } }, kit);
  }

  // damage
  if (resolution === 'attack') {
    spell.spellAttack = 'ranged';
    spell.damage = { dice: ['1d10'], types: ['force'] };
  } else if (resolution === 'save') {
    spell.save = ['dex'];
    spell.saveHalf = true;
    spell.damage = { dice: ['3d6'], types: ['fire'] };
  } else {
    spell.damage = { dice: ['2d6'], types: ['force'] };
  }
  return withDelivery({ ...spell, automation: generatedAutomation(spell) }, kit);
}

function withDelivery(spell: SpellDef, kit: SpellKit): SpellDef {
  if (kit.delivery === 'area') {
    return { ...spell, areaSpec: { shape: 'sphere', size: 20 } };
  }
  if (kit.delivery !== 'zone' && kit.delivery !== 'aura') return spell;
  const duration: EffectDuration = { type: 'concentration' };
  const zone: ZoneSpec = {
    ...blankZone(),
    duration,
    ...(kit.delivery === 'aura' ? { anchor: 'source' as const, side: 'hostile' as const, excludeSource: true } : {}),
  };
  return {
    ...spell,
    concentration: true,
    duration: [{ type: 'timed', concentration: true, duration: { type: 'minute', amount: 1 } }],
    automation: { ...spell.automation, zone },
  };
}

/** Есть ли payload указанного вида в слотах зоны (триггеры/аура/onCreate). */
function zonePayloadHas(spell: SpellDef, key: 'damage' | 'heal' | 'effects'): boolean {
  const zone = spell.automation.zone;
  if (!zone) return false;
  const payloads = [...Object.values(zone.triggers ?? {}), zone.aura, zone.onCreate].filter(Boolean);
  return payloads.some((payload) => payload && key in (payload as Record<string, unknown>));
}

function deliveryOf(spell: SpellDef): KitDelivery {
  const zone = spell.automation.zone;
  if (zone) return zone.anchor === 'source' ? 'aura' : 'zone';
  if (spell.automation.area || spell.areaSpec) return 'area';
  return 'creatures';
}

/**
 * Определение kit'а по записи (для мастера/подписи): `null` — нестандартная
 * запись, форма показывает все блоки как раньше.
 */
export function kitOf(spell: SpellDef): SpellKit | null {
  const a = spell.automation;
  if (a.weaponAttack) return { payload: 'weapon' };
  if (a.shape) return { payload: 'shape' };
  if (a.manual) return { payload: 'manual' };
  if (a.summon) return { payload: 'summon' };
  if (a.utility) return { payload: 'utility' };
  if (a.primary !== 'attack' && a.primary !== 'save' && a.primary !== 'auto' && a.primary !== 'effect') return null;
  const resolution: KitResolution = a.primary === 'attack' ? 'attack' : a.save ? 'save' : 'auto';
  const hasHeal = !!a.heal || spell.healing === true || zonePayloadHas(spell, 'heal');
  const hasDamage = !!a.damage || zonePayloadHas(spell, 'damage');
  const hasEffects = !!a.effects?.length || zonePayloadHas(spell, 'effects');
  const payload: KitPayload = hasHeal && !hasDamage ? 'heal' : hasDamage ? 'damage' : hasEffects ? 'effect' : 'manual';
  return { payload, resolution, delivery: deliveryOf(spell) };
}
