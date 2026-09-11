import {
  snapToGrid,
} from 'shared';
import type { ConnCtx } from './context';

export function registerMapHandlers(ctx: ConnCtx) {
  const { socket, manager, dmRoom, broadcast, broadcastAll, broadcastMaps, emitToken } = ctx;

    socket.on('map:add', (payload) => {
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

    socket.on('map:remove', (id) => {
      const room = dmRoom();
      if (!room) return;
      manager.removeMap(room, id);
      broadcastMaps(room);
    });

    socket.on('map:rename', ({ id, name }) => {
      const room = dmRoom();
      if (!room) return;
      manager.renameMap(room, id, name.trim().slice(0, 60));
      broadcastMaps(room);
    });

    socket.on('map:bring', (id) => {
      const room = dmRoom();
      if (!room) return;
      if (!room.scene.maps.some((m) => m.id === id)) return;
      room.scene.activeMapId = id;
      manager.saveSoon(room);
      broadcastAll('map:bring', { activeMapId: id });
    });

    socket.on('fog:update', ({ mapId, fog }) => {
      const room = dmRoom();
      if (!room) return;
      const map = room.scene.maps.find((m) => m.id === mapId);
      if (!map) return;
      if (typeof fog?.size !== 'number' || fog.size < 5 || fog.size > 1000) return;
      map.fog = {
        size: fog.size,
        offsetX: typeof fog.offsetX === 'number' ? fog.offsetX : 0,
        offsetY: typeof fog.offsetY === 'number' ? fog.offsetY : 0,
        hidden: Array.isArray(fog.hidden) ? fog.hidden.slice(0, 50000) : [],
      };
      manager.saveSoon(room);
      broadcastAll('fog:update', { mapId, fog: map.fog });
    });


    socket.on('grid:update', (grid) => {
      const room = dmRoom();
      if (!room) return;
      room.scene.grid = grid;
      for (const map of room.scene.maps) {
        for (const token of map.tokens) {
          token.w = token.cells * grid.size;
          token.h = token.cells * grid.size;
          if (grid.snap) {
            token.x = snapToGrid(token.x, grid.offsetX, grid.size, token.cells);
            token.y = snapToGrid(token.y, grid.offsetY, grid.size, token.cells);
          }
        }
      }
      manager.saveSoon(room);
      broadcast('grid:update', grid);
      for (const map of room.scene.maps) {
        for (const token of map.tokens) emitToken(room, 'token:update', map.id, token);
      }
    });

}
