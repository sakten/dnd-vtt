import type { ZoneInstance } from '../domain/automation';
import type { GridSettings, Wall } from '../domain/scene';
import type { Token } from '../domain/token';
import { tokenFullyInArea, tokensInArea } from './areas';
import type { Spell } from './spells';

/**
 * Зоны «молчания» (Silence, Jallarzi's Storm of Radiance): под ними нельзя
 * накладывать заклинания с вербальным компонентом. Silence — только целиком
 * внутри (`containment: 'fullyWithin'`), Jallarzi — при любой клетке в области.
 */
export function silencedByZones(
  spell: Pick<Spell, 'components'>,
  caster: Token,
  zones: ZoneInstance[] | undefined,
  grid: GridSettings,
  walls: Wall[] = []
): boolean {
  if (!spell.components.v || !zones?.length) return false;
  return zones.some((zone) => {
    if (!zone.flags?.silence || !zone.origin) return false;
    const direction = zone.direction ?? null;
    if (zone.containment === 'fullyWithin') {
      return tokenFullyInArea(caster, zone.area, zone.origin, direction, grid, 'euclidean', walls);
    }
    return tokensInArea([caster], zone.area, zone.origin, direction, grid, 'euclidean', walls).length > 0;
  });
}
