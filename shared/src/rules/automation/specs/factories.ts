import type { EffectDuration } from '../../../domain/effects';
import { CONCENTRATION, PERMANENT } from '../header';
import type { ActionSpec, DamageSpec, EffectSpec, PayloadSpec, ValueExpr, WallDimsSpec, ZoneSpec } from '../spec';

export const MAGIC_WEAPON_BONUS: ValueExpr = {
  tiers: [
    { above: 1, value: 1 },
    { above: 3, value: 2 },
    { above: 6, value: 3 },
  ],
};

/**
 * Шаблон стены (R16): общая шапка зоны (габариты `WALL_DIMS`, точка, концентрация),
 * параметры — триггеры/секции/флаги/свет/действия. Литералы габаритов доступны копиям.
 */
export function wallZone(
  params: Omit<ZoneSpec, 'area' | 'origin' | 'duration'> & { dims?: WallDimsSpec; duration?: EffectDuration } = {}
): ZoneSpec {
  const { dims, duration, ...rest } = params;
  return { area: { wall: dims ?? { from: 'spell' } }, origin: 'point', duration: duration ?? CONCENTRATION, ...rest };
}

/** Payload стены: спас DEX и урон (свежие объекты — без алиасов между триггерами). */
export function wallPayload(dice: ValueExpr, type: string): PayloadSpec {
  return { containment: 'anyCell', save: { ability: 'dex', half: true }, damage: { dice, types: [type] } };
}

export const fireDice = (): ValueExpr => ({
  concat: [{ scale: { dice: { ref: 'part', part: 'main', fallback: '5d8' }, by: 'upcast' } }, 'fire'],
});
export const barrierDice = (): ValueExpr => ({ concat: [{ ref: 'part', part: 'main', fallback: '6d10' }, 'force'] });
export const thornSlashDice = (): ValueExpr => ({
  concat: [{ scale: { dice: { ref: 'part', part: 'trigger', fallback: '7d8' }, by: 'upcast' } }, 'slashing'],
});
export const iceAppearDice = (): ValueExpr => ({
  concat: [{ scale: { dice: { ref: 'part', part: 'main', fallback: '10d6' }, by: { dice: '2d6' } } }, 'cold'],
});
export const iceSheetDice = (): ValueExpr => ({
  concat: [{ scale: { dice: { ref: 'part', part: 'trigger', fallback: '5d6' }, by: { dice: '1d6' } } }, 'cold'],
});
export const lightDice = (part: 'main' | 'repeat', index?: number): ValueExpr => ({
  concat: [
    { scale: { dice: { ref: 'part', part, index, fallback: '4d8' }, by: 'upcast' } },
    'radiant',
  ],
});

/** Bestow Curse: режимы проклятия и карта «режим проверки → характеристика». */
export const CHECK_ABILITIES: Record<string, string> = {
  'checks-str': 'str',
  'checks-dex': 'dex',
  'checks-con': 'con',
  'checks-int': 'int',
  'checks-wis': 'wis',
  'checks-cha': 'cha',
};
export const CHECK_ABILITY_KEYS = Object.keys(CHECK_ABILITIES);
export const BESTOW_CURSE_OPTIONS = [...CHECK_ABILITY_KEYS, 'attacks', 'dodge', 'necrotic'];

/** Перемещение зоны действием владельца (Moonbeam 60, Flaming Sphere 30, Faithful Hound 30). */
export const moveZoneAction = (cost: 'action' | 'bonus', feet: number, name = 'Переместить'): ActionSpec => ({
  id: 'move',
  name,
  cost,
  defKey: 'zone:move',
  primary: 'utility',
  utility: { kind: 'moveZone', amount: feet },
  targeting: { kind: 'point', range: feet },
});

/** Web: опутан, пока в паутине; выпутывание — STR (Athletics) против СЛ каста. */
export const webRestrained = (): EffectSpec => ({
  id: 'web',
  name: 'Web',
  duration: PERMANENT,
  to: 'targets',
  modifiers: [],
  conditions: ['restrained'],
  escape: { ability: 'str', skill: 'athletics' },
});

/** Sunbeam: слепота до начала следующего хода источника (каст и каждый луч). */
export const sunbeamBlind = (): EffectSpec => ({
  id: 'blind',
  name: 'Sunbeam',
  duration: { type: 'endOfTurn', of: 'source' },
  to: 'targets',
  modifiers: [],
  conditions: ['blinded'],
});

/** Heat Metal: помеха атакам и проверкам, пока металл раскалён. */
export const heatHolding = (): EffectSpec => ({
  id: 'holding',
  name: 'Heat Metal',
  duration: { type: 'endOfTurn', of: 'source' },
  to: 'targets',
  modifiers: [
    { target: 'attack', mode: 'disadvantage' },
    { target: 'check', mode: 'disadvantage' },
  ],
});

/** Storm Sphere: спас STR и дробящий урон (появление и конец хода), +1к6/круг. */
export const stormTrigger = (): PayloadSpec => ({
  save: { ability: 'str' },
  damage: {
    dice: { scale: { dice: { ref: 'part', part: 'trigger', fallback: '2d6' }, by: 'upcast' } },
    types: ['bludgeoning'],
  },
});

/** Jallarzi: спас CON, излучение + звук, обе части +1к10/круг. */
export const jallarziDamage = (): DamageSpec => ({
  parts: [
    { dice: { scale: { dice: { ref: 'part', part: 'main', index: 0, fallback: '2d10' }, by: 'upcast' } }, type: 'radiant' },
    { dice: { scale: { dice: { ref: 'part', part: 'main', index: 1, fallback: '2d10' }, by: 'upcast' } }, type: 'thunder' },
  ],
});
