import type { DrawStroke } from 'shared';
import type { MessageKey } from '../../i18n';
import { newId } from '../../lib/id';
import { emitInMap } from '../helpers';
import type { GameState, MapStroke, Slice } from '../types';

type DrawState = Pick<
  GameState,
  'drawMode' | 'strokes' | 'setDrawMode' | 'commitStroke' | 'onDrawStroke' | 'pruneStrokes'
>;

/** Штрих живёт 10 секунд: у всех клиентов по локальным часам. */
export const STROKE_TTL_MS = 10_000;

/** Потолок штрихов в сторе: старейшие вытесняются. */
export const MAX_STROKES = 64;

/** Потолок точек в штрихе (как на сервере). */
export const MAX_STROKE_POINTS = 256;

export const DEFAULT_DRAW_COLOR = '#e5484d';

/** Палитра рисования: значение + i18n-ключ названия. */
export const DRAW_COLORS: { value: string; key: MessageKey }[] = [
  { value: '#e5484d', key: 'ui.draw.color.red' },
  { value: '#f76b15', key: 'ui.draw.color.orange' },
  { value: '#f5d90a', key: 'ui.draw.color.yellow' },
  { value: '#46a758', key: 'ui.draw.color.green' },
  { value: '#00a2c7', key: 'ui.draw.color.cyan' },
  { value: '#3b82f6', key: 'ui.draw.color.blue' },
  { value: '#8e4ec6', key: 'ui.draw.color.purple' },
  { value: '#f2f2f2', key: 'ui.draw.color.white' },
];

export const createDrawSlice: Slice<DrawState> = (set, get) => {
  return {
    drawMode: { active: false, color: DEFAULT_DRAW_COLOR },
    strokes: [],

    setDrawMode: (patch) => set((s) => ({ drawMode: { ...s.drawMode, ...patch } })),

    // Свой штрих: локально сразу (без ожидания эха), остальным — через сервер.
    commitStroke: (points) => {
      const mapId = get().viewMapId;
      if (!mapId || points.length < 2) return;
      const stroke: DrawStroke = {
        id: newId(),
        mapId,
        color: get().drawMode.color,
        points: points.slice(0, MAX_STROKE_POINTS),
      };
      get().onDrawStroke(stroke);
      emitInMap(get, 'draw:stroke', { id: stroke.id, color: stroke.color, points: stroke.points });
    },

    onDrawStroke: (payload) =>
      set((s) => {
        if (s.strokes.some((st) => st.id === payload.id)) return s;
        const now = performance.now();
        const next: MapStroke[] = [
          ...s.strokes.filter((st) => st.expiresAt > now),
          { ...payload, points: payload.points.slice(0, MAX_STROKE_POINTS), expiresAt: now + STROKE_TTL_MS },
        ];
        return { strokes: next.length > MAX_STROKES ? next.slice(next.length - MAX_STROKES) : next };
      }),

    pruneStrokes: () =>
      set((s) => {
        const now = performance.now();
        const next = s.strokes.filter((st) => st.expiresAt > now);
        return next.length === s.strokes.length ? s : { strokes: next };
      }),
  };
};
