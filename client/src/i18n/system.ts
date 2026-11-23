import type { SystemText } from 'shared';
import { t, type MessageKey } from './index';
import { errorText } from './errors';
import { conditionLabel, damageLabel } from './domain';

/** Текст системного сообщения: структурная метка (`code`+`params`) либо прежняя строка. */
export function systemText(message: { system?: SystemText; text?: string }): string {
  const system = message.system;
  if (!system) return message.text ?? '';
  const params: Record<string, string | number> = { ...system.params };
  if (params.error !== undefined) {
    params.error = errorText({ code: String(params.error), params });
  }
  if (params.condition !== undefined) {
    const fallback = params.label !== undefined ? String(params.label) : undefined;
    params.condition = conditionLabel(String(params.condition), fallback);
  }
  if (params.type !== undefined) params.type = damageLabel(String(params.type));
  // Списки типов урона (Знай врага) — через запятую в params, локализуем каждый.
  for (const key of ['immunities', 'resistances', 'vulnerabilities'] as const) {
    if (params[key] === undefined) continue;
    const list = String(params[key])
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => damageLabel(item));
    params[key] = list.length ? list.join(', ') : '—';
  }
  return t(`system.${system.code}` as MessageKey, params);
}
