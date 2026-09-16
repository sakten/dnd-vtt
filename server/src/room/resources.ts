import type { Token } from 'shared';
import type { Room } from '../roomTypes';

/** Зависимости домена ресурсов: сохранение комнаты. */
export interface ResourceDeps {
  saveSoon(room: Room): void;
}

/** Списывает ресурс игрока; false — если ресурса нет или не хватает. */
export function spendResource(m: ResourceDeps, room: Room, playerId: string, key: string, amount = 1): boolean {
  const item = room.resources[playerId]?.resources.find((r) => r.key === key);
  if (!item || item.current < amount) return false;
  item.current -= amount;
  m.saveSoon(room);
  return true;
}

/** Списывает ячейку заклинания круга (обычную, иначе pact). null — нет ячейки. */
export function spendSpellSlot(m: ResourceDeps, room: Room, playerId: string, level: number): 'slot' | 'pact' | null {
  const res = room.resources[playerId];
  if (!res || level < 1) return null;
  const slot = res.spellSlots.find((s) => s.level === level && s.current > 0);
  if (slot) {
    slot.current -= 1;
    m.saveSoon(room);
    return 'slot';
  }
  if (res.pact.level === level && res.pact.current > 0) {
    res.pact.current -= 1;
    m.saveSoon(room);
    return 'pact';
  }
  return null;
}

/** Списывает ячейку заклинания монстра из статблока; без настроенных ячеек — без учёта. */
export function spendTokenSpellSlot(m: ResourceDeps, room: Room, token: Token, level: number): boolean {
  const sc = token.statblock?.spellcasting;
  if (!sc) return false;
  if (!sc.slots?.length) return true;
  const slot = sc.slots.find((s) => s.level === level && s.current > 0);
  if (!slot) return false;
  slot.current -= 1;
  m.saveSoon(room);
  return true;
}

/** Зеркалит HP/AC/скорость персонажа игрока в его токены на всех картах. */
export function syncSheetToTokens(room: Room, playerId: string): { mapId: string; token: Token }[] {
  const libId = room.controllers[playerId];
  if (!libId) return [];
  const sheet = room.sheets[playerId];
  const res = room.resources[playerId];
  if (!sheet && !res) return [];
  const changed: { mapId: string; token: Token }[] = [];
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      if (token.libraryItemId !== libId) continue;
      if (res && res.hp.max > 0) {
        token.hpMax = String(res.hp.max);
        token.hpCurrent = res.hp.current;
        token.hpTemp = res.hp.temp;
      }
      if (sheet) {
        token.ac = sheet.ac;
        token.speed = sheet.speed;
        token.darkvision = sheet.darkvision;
      }
      changed.push({ mapId: map.id, token });
    }
  }
  return changed;
}
