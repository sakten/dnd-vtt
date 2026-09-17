import type { GridSettings, MapInfo, Token } from 'shared';
import { useGameStore } from './useGameStore';
import { activeGridOf, activeMapOf, characterTokenOf, tokenById } from './selectors';

/** Хук: активная карта. */
export function useActiveMap(): MapInfo | null {
  return useGameStore(activeMapOf);
}

/** Хук: сетка активной карты (или дефолт комнаты без карты). */
export function useActiveGrid(): GridSettings {
  return useGameStore(activeGridOf);
}

/** Хук: токен по id на активной карте. */
export function useMapToken(id: string | null): Token | null {
  return useGameStore((s) => tokenById(activeMapOf(s), id));
}

/** Хук: токен персонажа игрока на активной карте. */
export function useCharacterToken(): Token | null {
  return useGameStore((s) => characterTokenOf(activeMapOf(s), s.currentCharacterId));
}
