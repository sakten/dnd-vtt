import type { DeploymentArea, MapInfo } from 'shared';
import { activeMapOf } from '../store/selectors';
import type { GameState } from '../store/types';
import { canAddLibraryItemWith, canControlTokenWith, characterNameOf, isDmWith } from './control';

export function deploymentPendingForMap(s: GameState, map: MapInfo): boolean {
  if (isDmWith(s)) return false;
  if (!map.deployment?.enabled) return false;
  const charName = characterNameOf(s, s.currentCharacterId);
  if (map.tokens.some((t) => canControlTokenWith(s, t, charName))) return false;
  return s.library.some((item) => canAddLibraryItemWith(s, item));
}

export function deploymentPendingOf(s: GameState): boolean {
  const map = activeMapOf(s);
  return map ? deploymentPendingForMap(s, map) : false;
}

export function inDeploymentArea(x: number, y: number, areas: DeploymentArea[]): boolean {
  return areas.some((a) => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h);
}