import { describe, expect, it } from 'vitest';
import { asBool, asString, asTrimmedString } from './decode';

describe('декодеры socket-payload', () => {
  it('asString: только строки, с лимитом', () => {
    expect(asString('abc')).toBe('abc');
    expect(asString(42)).toBeUndefined();
    expect(asString(null)).toBeUndefined();
    expect(asString('abcdef', 3)).toBe('abc');
  });

  it('asTrimmedString: trim, пустая строка и лимит', () => {
    expect(asTrimmedString('  abc  ')).toBe('abc');
    expect(asTrimmedString('   ')).toBe('');
    expect(asTrimmedString(undefined)).toBeUndefined();
    expect(asTrimmedString('abcdef', 3)).toBe('abc');
  });

  it('asBool: строгий boolean без приведения', () => {
    expect(asBool(true)).toBe(true);
    expect(asBool(false)).toBe(false);
    expect(asBool('true')).toBeUndefined();
    expect(asBool(1)).toBeUndefined();
  });
});
