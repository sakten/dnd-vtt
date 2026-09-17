import type { ErrorPayload } from 'shared';
import { t, type MessageKey } from './index';
import { resourceLabel } from './domain';

/** Текст серверной ошибки: `{ code, params }` (старые строки — как есть). */
export function errorText(payload: ErrorPayload | string): string {
  if (typeof payload === 'string') return payload;
  if (payload.code === 'noResource' && payload.params?.key) {
    return t('error.noResource', {
      name: resourceLabel(String(payload.params.key), String(payload.params.name ?? '')),
    });
  }
  return t(`error.${payload.code}` as MessageKey, payload.params);
}
