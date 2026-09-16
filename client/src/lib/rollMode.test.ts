import { describe, expect, it } from 'vitest';
import { advantagedExpression } from './rollMode';

describe('advantagedExpression', () => {
  it('без галочек оставляет выражение как есть', () => {
    expect(advantagedExpression('d20+5', false, false)).toBe('d20+5');
  });

  it('добавляет преимущество или помеху', () => {
    expect(advantagedExpression('d20+5', true, false)).toBe('d20a+5');
    expect(advantagedExpression('d20+5', false, true)).toBe('d20d+5');
  });

  it('взаимно гасит adv и dis', () => {
    expect(advantagedExpression('d20+5', true, true)).toBe('d20+5');
  });
});
