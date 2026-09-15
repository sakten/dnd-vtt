import { randomUUID } from 'node:crypto';
import type { CharacterSheet, CombatState, MapInfo, Scene, Token } from 'shared';
import {
  DEFAULT_GRID,
  defaultFog,
  emptyCombatState,
  isRecord,
  normalizeCombatState,
  normalizeLibraryItem,
  normalizeScene,
  normalizeSheet,
} from 'shared';
import type { PersistedRoom, Room } from './roomTypes';

/** Legacy-сцена (map/tokens) → одна карта; иначе — обычная нормализация сцены. */
function normalizePersistedScene(raw: Scene): Scene {
  if (Array.isArray(raw.maps)) return normalizeScene(raw, { keepAcHp: true });
  const grid = raw.grid ?? DEFAULT_GRID;
  const legacy = raw as unknown as {
    map: { url: string; width: number; height: number } | null;
    tokens?: Token[];
  };
  const maps: MapInfo[] = legacy.map
    ? [
        {
          id: randomUUID(),
          name: 'Карта 1',
          url: legacy.map.url,
          width: legacy.map.width,
          height: legacy.map.height,
          tokens: legacy.tokens ?? [],
          zones: [],
          fog: defaultFog(grid),
          combat: emptyCombatState(),
        },
      ]
    : [];
  return normalizeScene({ maps, activeMapId: maps[0]?.id ?? null, grid }, { keepAcHp: true });
}

/** Сносит зоны концентрации без живого эффекта-источника (legacy-снимки, сбои). */
function dropOrphanZones(scene: Scene): void {
  const sources = new Set<string>();
  for (const map of scene.maps) {
    for (const token of map.tokens) {
      for (const effect of token.effects) {
        if (effect.concentration && effect.sourceId) sources.add(effect.sourceId);
      }
    }
  }
  for (const map of scene.maps) {
    map.zones = (map.zones ?? []).filter((zone) => !zone.concentration || sources.has(zone.sourceId));
  }
}

/**
 * Приводит прочитанный с диска PersistedRoom к валидному Room: переводит legacy-форматы,
 * добирает отсутствующие поля дефолтами, нормализует листы и контроллеров.
 * Вход не мутирует — собирает новую комнату (в т.ч. карты и токены).
 */
export function hydrateRoom(p: PersistedRoom): Room {
  const scene = normalizePersistedScene(p.scene as Scene);
  dropOrphanZones(scene);
  const legacyCombat = (p as PersistedRoom & { combat?: CombatState }).combat;
  if (isRecord(legacyCombat) && scene.maps.length) {
    const found = scene.maps.findIndex((m) => m.id === scene.activeMapId);
    const index = found >= 0 ? found : 0;
    const map = scene.maps[index]!;
    scene.maps[index] = { ...map, combat: normalizeCombatState(legacyCombat) };
  }
  const controllers: Record<string, string> = {};
  if (isRecord(p.controllers)) {
    for (const [pid, lid] of Object.entries(p.controllers)) {
      if (typeof lid === 'string' && lid) controllers[pid] = lid;
    }
  }
  const sheets: Record<string, CharacterSheet> = {};
  if (isRecord(p.sheets)) {
    for (const [id, sheet] of Object.entries(p.sheets)) {
      sheets[id] = normalizeSheet(sheet);
    }
  }
  return {
    code: p.code,
    name:
      typeof p.name === 'string' && p.name.trim()
        ? p.name.trim().slice(0, 60)
        : `Игра ${p.code.slice(0, 6)}`,
    scene,
    library: Array.isArray(p.library) ? p.library.map((item) => normalizeLibraryItem(item)) : [],
    sheets,
    chat: p.chat ?? [],
    players: Array.isArray(p.players)
      ? p.players.map((pl) => ({ ...pl, isConnected: false, socketId: null }))
      : [],
    nextZ: p.nextZ ?? 0,
    resources: isRecord(p.resources) ? p.resources : {},
    controllers,
    testMode: p.testMode === true,
  };
}
