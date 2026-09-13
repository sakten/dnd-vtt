import { randomUUID } from 'node:crypto';
import type { CharacterSheet, CombatState, LibraryItem, MapInfo, Scene, Token } from 'shared';
import {
  DEFAULT_SPEED,
  defaultFog,
  emptyCombatState,
  normalizeAttacks,
  normalizeCombatState,
  normalizeConditions,
  normalizeDamageDefenses,
  normalizeEffects,
  normalizeSheet,
  normalizeStatblock,
  statNumber,
} from 'shared';
import type { PersistedRoom, Room } from './roomTypes';

/**
 * Приводит прочитанный с диска PersistedRoom к валидному Room:
 * переводит legacy-форматы, добирает отсутствующие поля дефолтами,
 * нормализует листы и контроллеров. Мутирует переданный объект.
 */
export function hydrateRoom(p: PersistedRoom): Room {
  const scene = p.scene as Scene;
  if (!Array.isArray(scene.maps)) {
    const legacy = scene as unknown as {
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
            fog: defaultFog(scene.grid),
            combat: emptyCombatState(),
          },
        ]
      : [];
    scene.maps = maps;
    scene.activeMapId = maps[0]?.id ?? null;
  }
  for (const map of scene.maps) {
    if (!Array.isArray(map.tokens)) map.tokens = [];
    if (!map.fog || typeof map.fog !== 'object') {
      map.fog = defaultFog(scene.grid);
    }
    if (!Array.isArray(map.fog.hidden)) map.fog.hidden = [];
    map.combat = normalizeCombatState(map.combat);
    for (const token of map.tokens) {
      if (typeof token.name !== 'string') token.name = '';
      if (typeof token.imageUrl !== 'string') token.imageUrl = '';
      if (typeof token.cells !== 'number') token.cells = 1;
      if (typeof token.round !== 'boolean') token.round = false;
      if (typeof token.description !== 'string') token.description = '';
      if (typeof token.initiativeBonus !== 'string') token.initiativeBonus = '';
      if (typeof token.isPlayerToken !== 'boolean') token.isPlayerToken = false;
      if (typeof token.owner !== 'string') token.owner = '';
      if (typeof token.libraryItemId !== 'string') token.libraryItemId = '';
      token.attacks = normalizeAttacks((token as { attacks?: unknown }).attacks);
      token.damageDefenses = normalizeDamageDefenses((token as { damageDefenses?: unknown }).damageDefenses);
      if (typeof token.ac !== 'string') token.ac = '';
      if (typeof token.hpMax !== 'string') token.hpMax = '';
      if (typeof token.hpCurrent !== 'number' || !Number.isFinite(token.hpCurrent)) {
        token.hpCurrent = statNumber(token.hpMax);
      }
      if (typeof token.showStats !== 'boolean') token.showStats = false;
      token.hpTemp = Number.isFinite(token.hpTemp) ? Math.max(0, Math.round(token.hpTemp)) : 0;
      if (token.faction !== 'ally' && token.faction !== 'enemy' && token.faction !== 'neutral') {
        token.faction = 'neutral';
      }
      token.speed = Number.isFinite(token.speed) ? Math.max(0, Math.round(token.speed)) : DEFAULT_SPEED;
      token.conditions = normalizeConditions(token.conditions);
      token.effects = normalizeEffects(token.effects);
      const statblock = normalizeStatblock(token.statblock);
      if (statblock) token.statblock = statblock;
      else delete token.statblock;
    }
  }
  const legacyCombat = (p as PersistedRoom & { combat?: CombatState }).combat;
  const legacyMap = scene.maps.find((m) => m.id === scene.activeMapId) ?? scene.maps[0];
  if (legacyCombat && typeof legacyCombat === 'object' && legacyMap) {
    legacyMap.combat = normalizeCombatState(legacyCombat);
  }
  for (const item of p.library ?? []) {
    const legacy = item as LibraryItem & { url?: string };
    if (typeof legacy.imageUrl !== 'string') {
      legacy.imageUrl = typeof legacy.url === 'string' ? legacy.url : '';
    }
    delete legacy.url;
    if (typeof item.name !== 'string') item.name = '';
    if (typeof item.cells !== 'number') item.cells = 1;
    if (typeof item.round !== 'boolean') item.round = false;
    if (typeof item.description !== 'string') item.description = '';
    if (typeof item.initiativeBonus !== 'string') item.initiativeBonus = '';
    if (typeof item.isPlayerToken !== 'boolean') item.isPlayerToken = false;
    if (typeof item.owner !== 'string') item.owner = '';
    item.attacks = normalizeAttacks((item as { attacks?: unknown }).attacks);
    item.damageDefenses = normalizeDamageDefenses((item as { damageDefenses?: unknown }).damageDefenses);
    if (typeof item.ac !== 'string') item.ac = '';
    if (typeof item.hpMax !== 'string') item.hpMax = '';
    if (typeof item.showStats !== 'boolean') item.showStats = false;
  }
  const controllers: Record<string, string> = {};
  if (p.controllers && typeof p.controllers === 'object') {
    for (const [pid, lid] of Object.entries(p.controllers)) {
      if (typeof lid === 'string' && lid) controllers[pid] = lid;
    }
  }
  const sheets: Record<string, CharacterSheet> = {};
  if (p.sheets && typeof p.sheets === 'object') {
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
    library: Array.isArray(p.library) ? p.library : [],
    sheets,
    chat: p.chat ?? [],
    players: Array.isArray(p.players)
      ? p.players.map((pl) => ({ ...pl, isConnected: false, socketId: null }))
      : [],
    nextZ: p.nextZ ?? 0,
    resources: p.resources && typeof p.resources === 'object' ? p.resources : {},
    controllers,
  };
}
