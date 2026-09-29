import { describe, expect, it } from 'vitest';
import { makeConnCtx } from '../test/ctx';
import { makeRoom } from '../test/fixtures';
import { MAX_DRAW_POINTS, registerDrawHandlers } from './draw';

const stroke = (patch: Record<string, unknown> = {}) => ({
  id: 's1',
  mapId: 'm1',
  color: '#e5484d',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  ...patch,
});

const drawEvents = (events: { event: string; payload: unknown }[]) =>
  events.filter((e) => e.event === 'draw:stroke');

describe('draw:stroke', () => {
  it('валидный штрих раздаётся остальным в комнате', () => {
    const room = makeRoom();
    const player = makeConnCtx(room, { playerId: 'p1' });
    registerDrawHandlers(player.ctx);

    player.invoke('draw:stroke', stroke());

    const sent = drawEvents(player.emitted);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.payload).toMatchObject({ id: 's1', mapId: 'm1', color: '#e5484d' });
  });

  it('битые штрихи отбрасываются: цвет, точки, карта, координаты', () => {
    const room = makeRoom();
    const player = makeConnCtx(room, { playerId: 'p1' });
    registerDrawHandlers(player.ctx);

    player.invoke('draw:stroke', stroke({ color: 'red' }));
    player.invoke('draw:stroke', stroke({ points: [{ x: 0, y: 0 }] }));
    player.invoke('draw:stroke', stroke({ points: Array.from({ length: MAX_DRAW_POINTS + 1 }, (_, i) => ({ x: i, y: 0 })) }));
    player.invoke('draw:stroke', stroke({ mapId: 'nope' }));
    player.invoke('draw:stroke', stroke({ points: [{ x: 0, y: 0 }, { x: Number.NaN, y: 1 }] }));

    expect(drawEvents(player.emitted)).toHaveLength(0);
  });
});
