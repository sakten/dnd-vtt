import type { StoreGet } from './types';

const DEFAULT_TIMEOUT_MS = 4000;

interface PendingMutation {
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingMutation>();

/**
 * Оптимистичная мутация: локальный патч уже применён, ждём доменное эхо
 * (`settleOptimistic`). Если за `timeoutMs` эхо не пришло — откат и сообщение.
 */
export function beginOptimistic(
  get: StoreGet,
  key: string,
  rollback: () => void,
  message: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): void {
  settleOptimistic(key);
  const timer = setTimeout(() => {
    pending.delete(key);
    rollback();
    get().onChatError(message);
  }, timeoutMs);
  pending.set(key, { timer });
}

/** Подтверждение мутации: серверная версия пришла (эхо события). */
export function settleOptimistic(key: string): void {
  const p = pending.get(key);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(key);
}

/** Подтверждение всех мутаций с данным префиксом ключа. */
export function settleOptimisticPrefix(prefix: string): void {
  for (const key of [...pending.keys()]) {
    if (key.startsWith(prefix)) settleOptimistic(key);
  }
}

/** Сброс ожиданий (переподключение/смена комнаты) без откатов. */
export function clearOptimistic(): void {
  for (const p of pending.values()) clearTimeout(p.timer);
  pending.clear();
}

/** Только для тестов: сколько мутаций ждут подтверждения. */
export function optimisticCount(): number {
  return pending.size;
}
