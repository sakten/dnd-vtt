import type { SpellDef } from './materialize';
import type { ChoiceSpec, ValueExpr } from './spec';

/** Ссылка «выбор при касте» среди типов урона. */
interface ChoiceRef {
  ref: 'choice';
  choice?: string;
  optional?: boolean;
  fallback?: ValueExpr;
}

const isChoiceRef = (value: ValueExpr): value is ChoiceRef =>
  typeof value === 'object' && value !== null && 'ref' in value && value.ref === 'choice';

/**
 * Нормализация связи «выбор типа урона при касте ↔ типы урона»: если в
 * `choices` есть `damageType`, литеральные типы заменяются ссылкой
 * `{ref:'choice', choice, fallback}`; если выбор убрали — ссылка
 * раскрывается обратно в fallback-литерал. Вызывается при импорте/сохранении
 * кастома (сервер) и при правке выборов в конструкторе.
 */
export function syncChoiceDamage(record: SpellDef): SpellDef {
  const automation = { ...record.automation };
  const damage = automation.damage;
  if (!damage || !('dice' in damage)) return record;
  const choice: ChoiceSpec | undefined = automation.choices?.find((entry) => entry.param === 'damageType');
  const types = damage.types ?? [];
  const bound = types.find(isChoiceRef);
  if (choice && !bound) {
    const fallback = types.find((type): type is string => typeof type === 'string') ?? choice.options[0] ?? 'fire';
    automation.damage = { ...damage, types: [{ ref: 'choice', choice: choice.id, fallback }] };
    return { ...record, automation };
  }
  if (!choice && bound) {
    const literals = types.filter((type): type is string => typeof type === 'string');
    automation.damage = { ...damage, types: literals.length ? literals : [bound.fallback ?? 'fire'] };
    return { ...record, automation };
  }
  return record;
}
