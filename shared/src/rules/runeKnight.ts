export const GIANTS_MIGHT_ACTION = 'class:fighter.runeKnight:giantsMight';

/** Размер от Giant's Might: Large с 3 уровня, Huge с 18-го. */
export function giantsMightCells(fighterLevel: number): number {
  return fighterLevel >= 18 ? 3 : 2;
}