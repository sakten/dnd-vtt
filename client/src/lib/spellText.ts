import { ABILITIES, type Spell } from 'shared';

/** Текстовая сводка механики заклинания (RU) для тултипа и списка. */

const TIME_UNIT_RU: Record<string, string> = {
  action: 'действие',
  bonus: 'бонусное действие',
  reaction: 'реакция',
  minute: 'мин',
  hour: 'ч',
  round: 'раунд',
};

const DURATION_UNIT_RU: Record<string, string> = {
  minute: 'мин',
  hour: 'ч',
  day: 'дн',
  round: 'раунд',
};

const AREA_RU: Record<string, string> = {
  ST: 'одна цель',
  S: 'сфера',
  C: 'конус',
  L: 'линия',
  MT: 'несколько целей',
  W: 'стена',
  N: 'область',
  R: 'радиус',
};

const CONDITION_RU: Record<string, string> = {
  blinded: 'ослеплён',
  charmed: 'очарован',
  deafened: 'оглох',
  frightened: 'испуган',
  grappled: 'схвачен',
  incapacitated: 'недееспособен',
  invisible: 'невидим',
  paralyzed: 'парализован',
  petrified: 'окаменел',
  poisoned: 'отравлен',
  prone: 'сбит с ног',
  restrained: 'обездвижен',
  stunned: 'ошеломлён',
  unconscious: 'без сознания',
  exhaustion: 'истощение',
};

function distanceTypeRu(type: string): string {
  switch (type) {
    case 'self':
      return 'на себя';
    case 'touch':
      return 'касание';
    case 'sight':
      return 'в пределах видимости';
    case 'unlimited':
      return 'без ограничения';
    case 'special':
      return 'особая';
    default:
      return type;
  }
}

function timeText(spell: Spell): string {
  return spell.time
    .map((t) => `${t.number} ${TIME_UNIT_RU[t.unit] ?? t.unit}${t.condition ? ` (${t.condition})` : ''}`)
    .join(', ');
}

function rangeText(spell: Spell): string {
  const d = spell.range.distance;
  if (d) {
    if (!d.amount) return distanceTypeRu(d.type);
    const unit = d.type === 'feet' ? 'фт' : d.type === 'miles' ? 'миль' : distanceTypeRu(d.type);
    return `${d.amount} ${unit}`.trim();
  }
  return distanceTypeRu(spell.range.type);
}

function areaText(spell: Spell, raw: string): string | undefined {
  if (!spell.area?.length) return undefined;
  const shape = spell.area.map((a) => AREA_RU[a] ?? a).join('/');
  const size = raw.match(/\d+[- ]foot(?:[- ]radius)?/i)?.[0]?.replace(/\s+/g, '-');
  return size ? `${shape} (${size})` : shape;
}

function durationText(spell: Spell): string {
  const d = spell.duration[0];
  if (!d) return '—';
  if (d.type === 'instant') return 'мгновенно';
  if (d.type === 'permanent') return 'постоянно';
  if (d.type === 'special') return 'особая';
  if (d.type === 'timed' && d.duration) {
    const unit = DURATION_UNIT_RU[d.duration.type] ?? d.duration.type;
    const base = `${d.duration.amount ?? ''} ${unit}`.trim();
    return d.concentration ? `${base} (концентрация)` : base;
  }
  return d.concentration ? 'концентрация' : d.type;
}

function componentsText(spell: Spell): string {
  return [spell.components.v ? 'В' : '', spell.components.s ? 'С' : '', spell.components.m ? 'М' : '']
    .filter(Boolean)
    .join(', ');
}

function saveText(spell: Spell): string {
  return (spell.save ?? []).map((a) => ABILITIES.find((x) => x.key === a)?.name ?? a).join(', ');
}

function damageText(spell: Spell, raw: string): string | undefined {
  const dice = spell.damage?.dice ?? [];
  const types = spell.damage?.types ?? [];
  if (!dice.length && !types.length) return undefined;
  let text = [dice.join(', '), types.join(', ')].filter(Boolean).join(' ');
  if (spell.save?.length && /half as much/i.test(raw)) text += ' (при успехе — половина)';
  return text;
}

function conditionText(spell: Spell): string {
  return (spell.conditions ?? []).map((c) => CONDITION_RU[c.toLowerCase()] ?? c).join(', ');
}

/** Строки механики: действие/дистанция/область/длительность/атака/спасбросок/урон/состояние/компоненты. */
export function spellMechanics(spell: Spell): string[] {
  const raw = spell.description.join(' ');
  const lines: string[] = [];
  lines.push(`Действие: ${timeText(spell)}`);
  lines.push(`Дистанция: ${rangeText(spell)}`);
  const area = areaText(spell, raw);
  if (area) lines.push(`Область: ${area}`);
  lines.push(`Длительность: ${durationText(spell)}`);
  if (spell.spellAttack) lines.push(`Атака: ${spell.spellAttack === 'ranged' ? 'дальняя' : 'ближняя'} заклинанием`);
  if (spell.save?.length) lines.push(`Спасбросок: ${saveText(spell)}`);
  const damage = damageText(spell, raw);
  if (damage) lines.push(`Урон: ${damage}`);
  if (spell.conditions?.length) lines.push(`Состояние: ${conditionText(spell)}`);
  const comps = componentsText(spell);
  if (comps) lines.push(`Компоненты: ${comps}`);
  return lines;
}

/** Компактная механика одной строкой (для списка). */
export function spellMechanicsShort(spell: Spell): string {
  return spellMechanics(spell).join(' · ');
}
