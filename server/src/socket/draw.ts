import type { DrawStroke } from 'shared';
import type { ConnCtx } from './context';

/** Потолок точек в штрихе: глубина рисования ограничена, мусор отсекается. */
export const MAX_DRAW_POINTS = 256;

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Эфемерное рисование: валидирует штрих и раздаёт остальным в комнате.
 * Ничего не персистится — штрихи гаснут у клиентов сами (10 с).
 */
export function registerDrawHandlers(ctx: ConnCtx) {
  ctx.on('draw:stroke', (payload) => {
    const room = ctx.getRoom();
    if (!room || !payload || typeof payload !== 'object') return;
    const { id, mapId, color, points } = payload;
    if (typeof id !== 'string' || id.length === 0 || id.length > 64) return;
    if (typeof mapId !== 'string' || !ctx.manager.findMap(room, mapId)) return;
    if (typeof color !== 'string' || !COLOR_RE.test(color)) return;
    if (!Array.isArray(points) || points.length < 2 || points.length > MAX_DRAW_POINTS) return;
    const clean: { x: number; y: number }[] = [];
    for (const point of points) {
      const x = point?.x;
      const y = point?.y;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
      clean.push({ x, y });
    }
    const stroke: DrawStroke = { id, mapId, color, points: clean };
    // Автор уже добавил штрих локально — остальным.
    ctx.broadcast('draw:stroke', stroke);
  });
}
