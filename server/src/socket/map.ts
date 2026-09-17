import {
  isRecord,
  MAX_FOG_CELLS,
  MAX_WALL_SEGMENTS,
  normalizeGrid,
  normalizeLightAreas,
  snapToGrid,
  type Wall,
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
      // Сетку можно передать сразу (авто-выравнивание новой карты).
      const grid = payload?.grid !== undefined ? normalizeGrid(payload.grid, room.scene.grid) : undefined;
      manager.addMap(room, { name: name || 'Карта', url, width, height, ...(grid ? { grid } : {}) });
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
          ? fog.hidden
              .filter((k) => typeof k === 'string' && /^-?\d+,-?\d+$/.test(k))
              .slice(0, MAX_FOG_CELLS)
          : [],
      };
      broadcast('fog:update', { mapId, fog: map.fog });
    });


    ctx.on('walls:update', ({ mapId: rawMapId, walls }) => {
      const room = dmRoom();
      const mapId = asString(rawMapId);
      if (!room || !mapId || !Array.isArray(walls)) return;
      const map = room.scene.maps.find((m) => m.id === mapId);
      if (!map) return;
      const kinds = new Set(['wall', 'door', 'window']);
      map.walls = walls
        .filter(isRecord)
        .map((w) => ({
          id: asString(w.id) ?? '',
          kind: asString(w.kind) ?? 'wall',
          open: w.open === true,
          dmOnly: w.dmOnly === true,
          pickDc: Number(w.pickDc),
          x1: Number(w.x1),
          y1: Number(w.y1),
          x2: Number(w.x2),
          y2: Number(w.y2),
        }))
        .filter((w) => w.id && kinds.has(w.kind) && [w.x1, w.y1, w.x2, w.y2].every(Number.isFinite))
        .slice(0, MAX_WALL_SEGMENTS)
        .map((w) => ({
          id: w.id,
          kind: w.kind as Wall['kind'],
          x1: w.x1,
          y1: w.y1,
          x2: w.x2,
          y2: w.y2,
          ...(w.kind === 'door' && w.open ? { open: true } : {}),
          // Дверные настройки — только у дверей.
          ...(w.kind === 'door' && w.dmOnly ? { dmOnly: true } : {}),
          ...(w.kind === 'door' && Number.isFinite(w.pickDc) && w.pickDc > 0
            ? { pickDc: Math.min(40, Math.round(w.pickDc)) }
            : {}),
        }));
      broadcast('walls:update', { mapId, walls: map.walls });
    });

    ctx.on('vision:update', ({ mapId: rawMapId, vision }) => {
      const room = dmRoom();
      const mapId = asString(rawMapId);
      if (!room || !mapId || !isRecord(vision)) return;
      const map = room.scene.maps.find((m) => m.id === mapId);
      if (!map) return;
      map.vision = { los: vision.los === true, darkness: vision.darkness === true };
      broadcast('vision:update', { mapId, vision: map.vision });
    });

    ctx.on('areas:update', ({ mapId: rawMapId, lightAreas }) => {
      const room = dmRoom();
      const mapId = asString(rawMapId);
      if (!room || !mapId || !Array.isArray(lightAreas)) return;
      const map = room.scene.maps.find((m) => m.id === mapId);
      if (!map) return;
      map.lightAreas = normalizeLightAreas(lightAreas);
      broadcast('areas:update', { mapId, lightAreas: map.lightAreas });
    });

    ctx.on('grid:update', ({ mapId: rawMapId, grid }) => {
      const room = dmRoom();
      const mapId = asString(rawMapId);
      if (!room || !mapId || !isRecord(grid)) return;
      const map = room.scene.maps.find((m) => m.id === mapId);
      if (!map) return;
      const next = normalizeGrid(grid, map.grid);
      map.grid = next;
      // Дефолт комнаты — последняя настроенная сетка (с неё начинают новые карты).
      room.scene.grid = next;
      map.fog = { ...map.fog, size: next.size, offsetX: next.offsetX, offsetY: next.offsetY };
      for (const token of map.tokens) {
        token.w = token.cells * next.size;
        token.h = token.cells * next.size;
        if (next.snap) {
          token.x = snapToGrid(token.x, next.offsetX, next.size, token.cells);
          token.y = snapToGrid(token.y, next.offsetY, next.size, token.cells);
        }
      }
      broadcast('grid:update', { mapId, grid: next });
      for (const token of map.tokens) emitToken(room, 'token:update', map.id, token);
    });

}
