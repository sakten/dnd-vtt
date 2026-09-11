import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID, DEFAULT_SPEED, defaultFog, emptyCombatState } from 'shared';
import type { Scene } from 'shared';
import type { PersistedRoom } from './roomTypes';
import { toPersistedRoom } from './roomTypes';
import { hydrateRoom } from './roomNormalize';

function base(overrides: Partial<PersistedRoom> = {}): PersistedRoom {
  return {
    code: 'ABCD1234',
    scene: { maps: [], activeMapId: null, grid: { ...DEFAULT_GRID } },
    library: [],
    sheets: {},
    chat: [],
    players: [],
    nextZ: 0,
    ...overrides,
  } as PersistedRoom;
}

function sceneWithMap(extra: Record<string, unknown> = {}): Scene {
  return {
    maps: [
      {
        id: 'm1',
        name: 'Карта',
        url: '/uploads/map.png',
        width: 100,
        height: 200,
        tokens: [],
        fog: defaultFog(DEFAULT_GRID),
        combat: emptyCombatState(),
        ...extra,
      },
    ] as unknown as Scene['maps'],
    activeMapId: 'm1',
    grid: { ...DEFAULT_GRID },
  };
}

describe('hydrateRoom', () => {
  it('переводит legacy scene.map/tokens в maps', () => {
    const legacyScene = {
      activeMapId: null,
      grid: { ...DEFAULT_GRID },
      map: { url: '/uploads/old.png', width: 50, height: 60 },
      tokens: [{ id: 't1' }, { id: 't2' }],
    } as unknown as Scene;

    const room = hydrateRoom(base({ scene: legacyScene }));

    expect(room.scene.maps).toHaveLength(1);
    expect(room.scene.maps[0].url).toBe('/uploads/old.png');
    expect(room.scene.maps[0].width).toBe(50);
    expect(room.scene.maps[0].height).toBe(60);
    expect(room.scene.maps[0].tokens).toHaveLength(2);
    expect(room.scene.activeMapId).toBe(room.scene.maps[0].id);
  });

  it('legacy map:null даёт пустой список карт', () => {
    const legacyScene = {
      activeMapId: null,
      grid: { ...DEFAULT_GRID },
      map: null,
    } as unknown as Scene;

    const room = hydrateRoom(base({ scene: legacyScene }));

    expect(room.scene.maps).toEqual([]);
    expect(room.scene.activeMapId).toBeNull();
  });

  it('переносит legacy top-level combat в активную карту', () => {
    const entry = { id: 'e1', tokenId: null, name: 'A', imageUrl: '', initiative: 15, bonus: '' };
    const room = hydrateRoom(
      base({
        scene: sceneWithMap(),
        combat: { active: true, entries: [entry] },
      } as Partial<PersistedRoom>)
    );

    expect(room.scene.maps[0].combat.active).toBe(true);
    expect(room.scene.maps[0].combat.entries).toHaveLength(1);
    expect(room.scene.maps[0].combat.entries[0].name).toBe('A');
  });

  it('добирает дефолты карты и токенов', () => {
    const scene = {
      maps: [{ id: 'm1', name: 'X', url: '', width: 0, height: 0, tokens: [{ id: 't1' }] }],
      activeMapId: 'm1',
      grid: { ...DEFAULT_GRID },
    } as unknown as Scene;

    const room = hydrateRoom(base({ scene }));
    const map = room.scene.maps[0];
    const token = map.tokens[0];

    expect(map.combat).toEqual(emptyCombatState());
    expect(map.fog.hidden).toEqual([]);
    expect(token.name).toBe('');
    expect(token.imageUrl).toBe('');
    expect(token.cells).toBe(1);
    expect(token.round).toBe(false);
    expect(token.description).toBe('');
    expect(token.isPlayerToken).toBe(false);
    expect(token.owner).toBe('');
    expect(token.libraryItemId).toBe('');
    expect(token.attacks).toHaveLength(1);
    expect(token.ac).toBe('');
    expect(token.hpMax).toBe('');
    expect(token.hpCurrent).toBe(0);
    expect(token.showStats).toBe(false);
    expect(token.hpTemp).toBe(0);
    expect(token.faction).toBe('neutral');
    expect(token.speed).toBe(DEFAULT_SPEED);
    expect(token.conditions).toEqual([]);
    expect(token.effects).toEqual([]);
    expect(token.statblock).toBeUndefined();
  });

  it('нормализует боевые поля токена (условия, эффекты, статблок)', () => {
    const scene = {
      maps: [
        {
          id: 'm1',
          name: 'X',
          url: '',
          width: 0,
          height: 0,
          tokens: [
            {
              id: 't1',
              hpTemp: -3,
              faction: 'enemy',
              speed: 'abc',
              conditions: [{ key: 'prone', name: 'Сбит с ног', rounds: 2 }, null, 'x'],
              effects: [
                {
                  id: 'ef1',
                  name: 'Bless',
                  duration: { type: 'rounds', rounds: 10 },
                  modifiers: [{ target: 'attack', mode: 'add', value: '1d4' }, { target: 'bogus', mode: 'add', value: 1 }],
                },
                { id: 'ef2', duration: { type: 'weird' } },
              ],
              statblock: { abilities: { str: 15 }, saves: { str: 5 }, actions: [{ name: 'Bite', cost: 'action' }] },
            },
          ],
        },
      ],
      activeMapId: 'm1',
      grid: { ...DEFAULT_GRID },
    } as unknown as Scene;

    const room = hydrateRoom(base({ scene }));
    const token = room.scene.maps[0].tokens[0];

    expect(token.hpTemp).toBe(0);
    expect(token.faction).toBe('enemy');
    expect(token.speed).toBe(DEFAULT_SPEED);
    expect(token.conditions).toEqual([{ key: 'prone', name: 'Сбит с ног', rounds: 2 }]);
    expect(token.effects).toHaveLength(1);
    expect(token.effects[0].modifiers).toHaveLength(1);
    expect(token.effects[0].modifiers[0].value).toBe('1d4');
    expect(token.statblock?.abilities.str).toBe(15);
    expect(token.statblock?.saves?.str).toBe(5);
    expect(token.statblock?.actions?.[0].name).toBe('Bite');
  });

  it('hpCurrent выводится из hpMax, если не задан', () => {
    const scene = {
      maps: [{ id: 'm1', name: 'X', url: '', width: 0, height: 0, tokens: [{ id: 't1', hpMax: '17' }] }],
      activeMapId: 'm1',
      grid: { ...DEFAULT_GRID },
    } as unknown as Scene;

    const room = hydrateRoom(base({ scene }));

    expect(room.scene.maps[0].tokens[0].hpCurrent).toBe(17);
  });

  it('переводит library url в imageUrl и удаляет url', () => {
    const item = { id: 'l1', name: 'Гоблин', url: '/uploads/g.png' } as unknown as PersistedRoom['library'][number];
    const room = hydrateRoom(base({ library: [item] }));

    expect(room.library[0].imageUrl).toBe('/uploads/g.png');
    expect('url' in room.library[0]).toBe(false);
    expect(room.library[0].cells).toBe(1);
    expect(room.library[0].attacks).toHaveLength(1);
  });

  it('имя комнаты: дефолт, trim и обрезка', () => {
    expect(hydrateRoom(base()).name).toBe('Игра ABCD12');
    expect(hydrateRoom(base({ name: '   ' })).name).toBe('Игра ABCD12');
    expect(hydrateRoom(base({ name: '  Моя игра  ' })).name).toBe('Моя игра');
    expect(hydrateRoom(base({ name: 'x'.repeat(80) })).name).toHaveLength(60);
  });

  it('санитайзит контроллеров', () => {
    const room = hydrateRoom(
      base({ controllers: { p1: 'l1', p2: 123, p3: '' } as unknown as Record<string, string> })
    );

    expect(room.controllers).toEqual({ p1: 'l1' });
  });

  it('игроки становятся отключёнными без socketId', () => {
    const room = hydrateRoom(
      base({ players: [{ id: 'p1', name: 'A', role: 'player' }] })
    );

    expect(room.players[0]).toMatchObject({ id: 'p1', name: 'A', role: 'player', isConnected: false, socketId: null });
  });

  it('resources по умолчанию пусты', () => {
    expect(hydrateRoom(base()).resources).toEqual({});
  });

  it('нормализует листы персонажей', () => {
    const room = hydrateRoom(
      base({ sheets: { p1: { name: 'Герой' } as unknown as PersistedRoom['sheets'][string] } })
    );

    expect(room.sheets.p1.name).toBe('Герой');
    expect(room.sheets.p1.abilities.str).toBe(10);
    expect(room.sheets.p1.proficiencyBonus).toBe('2');
  });

  it('round-trip toPersisted → hydrate идемпотентен', () => {
    const fixture = base({
      name: 'Сессия',
      scene: sceneWithMap({ tokens: [{ id: 't1', name: 'A', hpMax: '10' }] }),
      library: [
        { id: 'l1', name: 'Гоблин', imageUrl: '/uploads/g.png' },
      ] as unknown as PersistedRoom['library'],
      players: [{ id: 'p1', name: 'Игрок', role: 'player' }],
      resources: {
        p1: {
          hp: { current: 5, max: 10, temp: 0, deathSuccesses: 0, deathFailures: 0 },
          hitDice: [],
          spellSlots: [],
          pact: { current: 0, max: 0, level: 0 },
          resources: [],
          notes: '',
        },
      },
      controllers: { p1: 'l1' },
    });

    const once = hydrateRoom(structuredClone(fixture));
    const twice = hydrateRoom(structuredClone(toPersistedRoom(once)));

    expect(twice).toEqual(once);
  });
});
