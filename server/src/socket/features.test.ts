import { describe, expect, it } from 'vitest';
import { makeRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { syncFeatureEffectsForItem } from './features';

const updatedIds = (emitted: { event: string; payload: unknown }[]): string[] =>
  emitted
    .filter((e) => e.event === 'token:update')
    .map((e) => (e.payload as { token: { id: string } }).token.id);

describe('syncFeatureEffectsForItem', () => {
  it('синхронизирует скрытые эффекты черт у всех токенов предмета и рассылает их', () => {
    const t1 = makeToken('t1', { libraryItemId: 'lib1' });
    const t2 = makeToken('t2', { libraryItemId: 'lib1' });
    const room = makeRoom();
    room.scene.maps[0]!.tokens = [t1, t2];
    const f = makeConnCtx(room, { dm: true });

    syncFeatureEffectsForItem(f.ctx, room, 'lib1', [{ className: 'barbarian', level: 1 }]);
    for (const t of [t1, t2]) {
      expect(t.effects.some((e) => e.sourceKey?.startsWith('feature:barbarian:unarmoredDefense'))).toBe(true);
      expect(updatedIds(f.emitted)).toContain(t.id);
    }

    // Пустые классы: эффекты черт снимаются, токены снова рассылаются.
    const before = f.emitted.length;
    syncFeatureEffectsForItem(f.ctx, room, 'lib1', []);
    for (const t of [t1, t2]) {
      expect(t.effects.some((e) => e.sourceKey?.startsWith('feature:'))).toBe(false);
    }
    expect(f.emitted.length).toBeGreaterThan(before);
  });
});
