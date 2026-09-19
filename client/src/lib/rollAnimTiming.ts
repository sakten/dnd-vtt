import type { DiceRollFace } from '../components/ThreeD20';

/** Длительность анимации d20: с преимуществом/помехой дольше (пауза, пульс, растворение). */
export function rollAnimMs(dice: DiceRollFace[]): number {
  return dice.some((d) => !d.kept) ? 2600 : 1700;
}
