import { afterEach, vi } from 'vitest';
import { takeHandlerErrors } from './ctx';

afterEach(() => {
  vi.restoreAllMocks();

  const errors = takeHandlerErrors();
  if (!errors.length) return;

  const details = errors
    .map(({ event, error }) =>
      `${event}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
    )
    .join('\n');
  throw new Error(`Необработанные ошибки socket-хендлеров:\n${details}`);
});
