import { describe, expect, it } from 'vitest';
import { controlsToken, isCharacterToken } from './control';

const token = (over: Partial<{ libraryItemId: string; owner: string }> = {}) => ({
  libraryItemId: 'lib1',
  owner: '',
  ...over,
});

describe('controlsToken', () => {
  it('DM/режим тестов — всегда', () => {
    expect(controlsToken({ isDm: true, selfId: null, token: token() })).toBe(true);
    expect(controlsToken({ isDm: true, selfId: 'p1', token: token({ libraryItemId: 'lib9' }) })).toBe(true);
  });

  it('без игрока соединения — нет', () => {
    expect(controlsToken({ selfId: null, currentCharacterId: 'lib1', token: token() })).toBe(false);
  });

  it('контролёр — по libraryItemId текущего персонажа', () => {
    expect(controlsToken({ selfId: 'p1', currentCharacterId: 'lib1', token: token() })).toBe(true);
    expect(controlsToken({ selfId: 'p1', currentCharacterId: 'lib2', token: token() })).toBe(false);
  });

  it('владелец — по имени персонажа токена', () => {
    const owned = token({ libraryItemId: 'libX', owner: 'Иван' });
    expect(controlsToken({ selfId: 'p1', currentCharacterId: 'lib2', charName: 'Иван', token: owned })).toBe(true);
    expect(controlsToken({ selfId: 'p1', currentCharacterId: 'lib2', charName: 'Пётр', token: owned })).toBe(false);
    expect(controlsToken({ selfId: 'p1', currentCharacterId: 'lib2', charName: '', token: owned })).toBe(false);
  });

  it('чужой токен без владельца — нет', () => {
    expect(controlsToken({ selfId: 'p1', currentCharacterId: 'lib1', token: token({ libraryItemId: 'libX' }) })).toBe(
      false
    );
  });
});

describe('isCharacterToken', () => {
  it('только привязка через контроллера', () => {
    expect(isCharacterToken('lib1', token())).toBe(true);
    expect(isCharacterToken('lib2', token())).toBe(false);
    expect(isCharacterToken(null, token())).toBe(false);
    expect(isCharacterToken(undefined, token())).toBe(false);
  });
});
