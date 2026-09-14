import {
  isRecord,
  snapToGrid,
} from 'shared';
import type { ConnCtx } from './context';
import { asString, asTrimmedString } from './decode';

export function registerMapHandlers(ctx: ConnCtx) {
  const { manager, dmRoom, broadcast, broadcastAll, broadcastMaps, emitToken } = ctx;

    ctx.on('map:add', (payload) => {
      const room = dmRoom();
      if (!room) return;
      const name = asTrimmedString(payload?.name, 60) ?? '';
      const url = asString(payload?.url) ?? '';
      const width = Number(payload?.width);
      const height = Number(payload?.height);
      if (!url || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      manager.addMap(room, { name: name || 'Карта', url, width, height });
      broadcastMaps(room);
    });

    ctx.on('map:remove', (id) => {
      const room = dmRoom();
      const mapId = asString(id);
      if (!room || !mapId) return;
      manager.removeMap(room, mapId);
      broadcastMaps(room);
    });

    ctx.on('map:rename', ({ id, name }) => {
      const room = dmRoom();
      const mapId = asString(id);
      const mapName = asTrimmedString(name, 60);
      if (!room || !mapId || !mapName) return;
      manager.renameMap(room, mapId, mapName);
      broadcastMaps(room);
    });

    ctx.on('map:bring', (id) => {
      const room = dmRoom();
      const mapId = asString(id);
      if (!room || !mapId) return;
      if (!room.scene.maps.some((m) => m.id === mapId)) return;
      room.scene.activeMapId = mapId;
      broadcastAll('map:bring', { activeMapId: mapId });
    });

    ctx.on('fog:update', ({ mapId: rawMapId, fog }) => {
      const room = dmRoom();
      const mapId = asString(rawMapId);
      if (!room || !mapId) return;
      const map = room.scene.maps.find((m) => m.id === mapId);
      if (!map) return;
      if (!isRecord(fog)) return;
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
      broadcast('fog:update', { mapId, fog: map.fog });
    });


    ctx.on('grid:update', (grid) => {
      const room = dmRoom();
      if (!room || !isRecord(grid)) return;
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
      broadcast('grid:update', next);
      for (const map of room.scene.maps) {
        for (const token of map.tokens) emitToken(room, 'token:update', map.id, token);
      }
    });

}
