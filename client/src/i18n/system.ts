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
  return t(`system.${system.code}` as MessageKey, params);
}
