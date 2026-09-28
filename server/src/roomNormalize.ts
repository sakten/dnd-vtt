import type { CharacterSheet, EffectInstance, Scene } from 'shared';
import { isRecord, normalizeLibraryItem, normalizeScene, normalizeSheet } from 'shared';
import type { PersistedRoom, Room } from './roomTypes';
import { clearCharacterStats } from './room/tokens';
import { zoneAuraSpellKeys } from './spells';

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
 * Сносит аура-эффекты зон, оставшиеся без живой зоны: `zoneId` указывает на
 * исчезнувшую зону или потерян в старых снимках (нормализация не сохраняла
 * поле) — тогда эффект привязывается к живой зоне того же источника, иначе
 * удаляется вместе с состояниями. Без этого Spirit Shroud и подобные ауры
 * навсегда зависают на целях после перезагрузки комнаты.
 */
function dropOrphanZoneEffects(scene: Scene): void {
  const zoneIds = new Set<string>();
  const zoneBySource = new Map<string, string>();
  for (const map of scene.maps) {
    for (const zone of map.zones ?? []) {
      zoneIds.add(zone.id);
      zoneBySource.set(`${zone.sourceId}\u0000${zone.sourceKey}`, zone.id);
    }
  }
  const auraSpells = zoneAuraSpellKeys();
  for (const map of scene.maps) {
    for (const token of map.tokens) {
      const kept: EffectInstance[] = [];
      for (const effect of token.effects) {
        if (effect.zoneId) {
          if (zoneIds.has(effect.zoneId)) kept.push(effect);
          continue;
        }
        // Легаси-снимок: аура-эффект без zoneId.
        if (!effect.concentration && effect.sourceKey && effect.sourceId && auraSpells.has(effect.sourceKey)) {
          const zoneId = zoneBySource.get(`${effect.sourceId}\u0000${effect.sourceKey}`);
          if (!zoneId) continue;
          effect.zoneId = zoneId;
        }
        kept.push(effect);
      }
      if (kept.length === token.effects.length) continue;
      token.effects = kept;
      const alive = new Set(kept.map((e) => e.id));
      token.conditions = token.conditions.filter((c) => !c.effectId || alive.has(c.effectId));
    }
  }
}

/**
 * Приводит прочитанный с диска PersistedRoom к валидному Room: добирает
 * отсутствующие поля дефолтами, нормализует листы и контроллеров.
 * Вход не мутирует — собирает новую комнату (в т.ч. карты и токены).
 */
export function hydrateRoom(p: PersistedRoom): Room {
  const scene = normalizeScene(p.scene as Scene);
  dropOrphanZones(scene);
  dropOrphanZoneEffects(scene);
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
  // Статы персонажей больше не хранятся в токенах (резолвит actorStats): чистим
  // зеркала у токенов, привязанных к игроку — тем же инвариантом, что и при спавне
  // (`clearCharacterStats`; лист может быть ещё не заполнен).
  const characterLibIds = new Set(Object.values(controllers));
  for (const map of scene.maps) {
    for (const token of map.tokens) {
      if (!characterLibIds.has(token.libraryItemId)) continue;
      clearCharacterStats(token);
    }
  }
  const room: Room = {
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
      ? p.players.map((pl) => {
          const chance = Number(pl.rollAnimChance);
          const rawClientId = (pl as unknown as { clientId?: unknown }).clientId;
          const clientId = typeof rawClientId === 'string' ? rawClientId.slice(0, 64) : null;
          return {
            ...pl,
            clientId,
            isConnected: false,
            socketId: null,
            rollAnimChance: Number.isFinite(chance) ? Math.max(0, Math.min(100, Math.round(chance))) : 0,
          };
        })
      : [],
    nextZ: p.nextZ ?? 0,
    resources: isRecord(p.resources) ? p.resources : {},
    controllers,
    testMode: p.testMode === true,
    ...(p.test === true ? { test: true } : {}),
    optionalRules: { surrounded: p.optionalRules?.surrounded === true },
  };
  return room;
}
