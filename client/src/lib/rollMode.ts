import { withAdvantage } from 'shared';

/** Выражение с преимуществом/помехой: adv и dis взаимно гасятся, иначе добавляется a/d. */
export function advantagedExpression(expression: string, adv: boolean, dis: boolean): string {
  return withAdvantage(expression, adv === dis ? null : adv ? 'a' : 'd');
}
