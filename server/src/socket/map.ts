import {
  snapToGrid,
} from 'shared';
import type { ConnCtx } from './context';

export function registerMapHandlers(ctx: ConnCtx) {
  const { manager, dmRoom, broadcast, broadcastAll, broadcastMaps, emitToken } = ctx;

    ctx.on('map:add', (payload) => {
      const room = dmRoom();
      if (!room) return;
      const name = typeof payload?.name === 'string' ? payload.name.trim().slice(0, 60) : '';
      const url = typeof payload?.url === 'string' ? payload.url : '';
      const width = Number(payload?.width);
      const height = Number(payload?.height);
      if (!url || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      manager.addMap(room, { name: name || 'Карта', url, width, height });
      broadcastMaps(room);
    });

    ctx.on('map:remove', (id) => {
      const room = dmRoom();
      if (!room) return;
      manager.removeMap(room, id);
      broadcastMaps(room);
    });

    ctx.on('map:rename', ({ id, name }) => {
      const room = dmRoom();
      if (!room) return;
      manager.renameMap(room, id, name.trim().slice(0, 60));
      broadcastMaps(room);
    });

    ctx.on('map:bring', (id) => {
      const room = dmRoom();
      if (!room) return;
      if (!room.scene.maps.some((m) => m.id === id)) return;
      room.scene.activeMapId = id;
      manager.saveSoon(room);
      broadcastAll('map:bring', { activeMapId: id });
    });

    ctx.on('fog:update', ({ mapId, fog }) => {
      const room = dmRoom();
      if (!room) return;
      const map = room.scene.maps.find((m) => m.id === mapId);
      if (!map) return;
      if (!fog || typeof fog !== 'object') return;
      const size = Number(fog.size);
      const offsetX = Number(fog.offsetX);
      const offsetY = Number(fog.offsetY);
      if (!Number.isFinite(size) || size < 5 || size > 1000) return;
      if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return;
      map.fog = {
        size,
        offsetX,
        offsetY,
        hidden: Array.isArray(fog.hidden)
          ? fog.hidden.filter((k) => typeof k === 'string' && /^-?\d+,-?\d+$/.test(k)).slice(0, 50000)
          : [],
      };
      manager.saveSoon(room);
      broadcastAll('fog:update', { mapId, fog: map.fog });
    });


    ctx.on('grid:update', (grid) => {
      const room = dmRoom();
      if (!room || !grid || typeof grid !== 'object') return;
      const size = Number(grid.size);
      const offsetX = Number(grid.offsetX);
      const offsetY = Number(grid.offsetY);
      if (!Number.isFinite(size) || size < 5 || size > 1000) return;
      if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return;
      const opacity = Number(grid.opacity);
      const next = {
        ...grid,
        size,
        offsetX,
        offsetY,
        opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 0.35,
      };
      room.scene.grid = next;
      for (const map of room.scene.maps) {
        for (const token of map.tokens) {
          token.w = token.cells * next.size;
          token.h = token.cells * next.size;
          if (next.snap) {
            token.x = snapToGrid(token.x, next.offsetX, next.size, token.cells);
            token.y = snapToGrid(token.y, next.offsetY, next.size, token.cells);
          }
        }
      }
      manager.saveSoon(room);
      broadcast('grid:update', next);
      for (const map of room.scene.maps) {
        for (const token of map.tokens) emitToken(room, 'token:update', map.id, token);
      }
    });

}
