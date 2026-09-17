import {
  DEFAULT_GRID,
  DEFAULT_SPEED,
  defaultFog,
  emptyCombatState,
  emptyTurnState,
  type PlayerResources,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';

/** Токен с дефолтами для тестов (клетка 50 фт: w/h = 50). */
export function makeToken(id: string, overrides: Partial<Token> = {}): Token {
  return {
    id,
    libraryItemId: '',
    name: id,
    description: '',
    imageUrl: '',
    cells: 1,
    round: false,
    initiativeBonus: '',
    isPlayerToken: false,
    owner: '',
    attacks: [],
    ac: '',
    hpMax: '',
    showStats: false,
    canInteract: false,
    x: 0,
    y: 0,
    w: 50,
    h: 50,
    scale: 1,
    rotation: 0,
    z: 0,
    visible: true,
    ownerId: '',
    lockedBy: null,
    hpCurrent: 0,
    hpTemp: 0,
    faction: 'neutral',
    speed: DEFAULT_SPEED,
    senses: [],
    conditions: [],
    effects: [],
    damageDefenses: [],
    ...overrides,
  };
}

function baseRoom(tokens: Token[], controllers: Record<string, string>, combat = emptyCombatState()): Room {
  return {
    code: 'TEST',
    name: 'T',
    scene: {
      maps: [
        {
          id: 'm1',
          name: 'M',
          url: '',
          width: 0,
          height: 0,
          tokens,
          zones: [],          walls: [],
          vision: { los: false, darkness: false },
          lightAreas: [],
          fog: defaultFog(DEFAULT_GRID),
          grid: { ...DEFAULT_GRID },
          combat,
        },
      ],
      activeMapId: 'm1',
      grid: { ...DEFAULT_GRID },
    },
    library: [],
    sheets: {},
    chat: [],
    players: [],
    nextZ: 0,
    resources: {},
    controllers,
    testMode: false,
  };
}

/** Комната без боя; любые поля можно переопределить. */
export function makeRoom(overrides: Partial<Room> = {}): Room {
  return { ...baseRoom([], {}), ...overrides };
}

/** Комната с активным боем (инициатива e1/t1) — для тестов хендлеров. */
export function makeCombatRoom(tokens: Token[], controllers: Record<string, string> = {}): Room {
  const combat = {
    ...emptyCombatState(),
    active: true,
    round: 1,
    currentIndex: 0,
    entries: [{ id: 'e1', tokenId: 't1', name: 'A', imageUrl: '', initiative: 10, bonus: '' }],
    turns: { e1: { ...emptyTurnState(30), movementUsed: 0 } },
  };
  return baseRoom(tokens, controllers, combat);
}

/** Ресурсы игрока с дефолтами. */
export function makeResources(overrides: Partial<PlayerResources> = {}): PlayerResources {
  return {
    hp: { current: 0, max: 0, temp: 0, deathSuccesses: 0, deathFailures: 0 },
    hitDice: [],
    spellSlots: [],
    pact: { current: 0, max: 0, level: 0 },
    resources: [],
    notes: '',
    ...overrides,
  };
}
