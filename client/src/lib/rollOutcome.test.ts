import { describe, expect, it } from 'vitest';
import { rollOutcome } from './rollOutcome';

describe('rollOutcome', () => {
  it('атака: попадание — успех, промах — провал', () => {
    expect(rollOutcome({ rollKind: 'attack', labelParams: { hit: 'hit' } })).toBe('success');
    expect(rollOutcome({ rollKind: 'attack', labelParams: { hit: 'miss' } })).toBe('fail');
  });

  it('спасбросок и проверка по исходу', () => {
    expect(rollOutcome({ rollKind: 'save', labelParams: { saveOutcome: 'success' } })).toBe('success');
    expect(rollOutcome({ rollKind: 'save', labelParams: { saveOutcome: 'fail' } })).toBe('fail');
    expect(rollOutcome({ rollKind: 'check', labelParams: { checkOutcome: 'success' } })).toBe('success');
    expect(rollOutcome({ rollKind: 'check', labelParams: { checkOutcome: 'fail' } })).toBe('fail');
  });

  it('без исхода и в прочих бросках — null', () => {
    expect(rollOutcome({ rollKind: 'check', labelParams: {} })).toBeNull();
    expect(rollOutcome({ rollKind: 'damage', labelParams: { hit: 'hit' } })).toBeNull();
    expect(rollOutcome({ rollKind: 'death', labelParams: { outcome: 'success' } })).toBeNull();
    expect(rollOutcome({ rollKind: 'plain', labelParams: {} })).toBeNull();
    expect(rollOutcome({})).toBeNull();
  });
});
