import { describe, expect, it } from 'vitest';
import { makeRoom } from './fixtures';
import { makeConnCtx, takeHandlerErrors } from './ctx';

describe('тест-кит сервера', () => {
  it('собирает ошибки socket-хендлера и очищает буфер', () => {
    const f = makeConnCtx(makeRoom());
    f.ctx.on('dice:roll', () => {
      throw new Error('boom');
    });

    f.invoke('dice:roll', { expression: 'd20' });

    const errors = takeHandlerErrors();
    expect(errors.map((entry) => entry.event)).toEqual(['dice:roll']);
    expect(String(errors[0]?.error)).toContain('boom');
  });
});
