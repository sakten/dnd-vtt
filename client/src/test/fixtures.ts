import {
  DEFAULT_GRID,
  DEFAULT_SPEED,
  defaultFog,
  emptyCombatState,
  type GridSettings,
  type MapInfo,
  type Scene,
  type Token,
} from 'shared';
import type { AppSocket } from '../net/socket';

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
    conditions: [],
    effects: [],
    ...overrides,
  };
}

export function makeMap(id: string, tokens: Token[] = [], grid: GridSettings = DEFAULT_GRID): MapInfo {
  return {
    id,
    name: id,
    url: '',
    width: 500,
    height: 500,
    tokens,
    fog: defaultFog(grid),
    combat: emptyCombatState(),
  };
}

export function makeScene(maps: MapInfo[] = [makeMap('m1'), makeMap('m2')], activeMapId: string | null = 'm1'): Scene {
  return { maps, activeMapId, grid: { ...DEFAULT_GRID } };
}

export interface EmittedEvent {
  event: string;
  payload: unknown;
}

export function fakeSocket(): { socket: AppSocket; emitted: EmittedEvent[] } {
  const emitted: EmittedEvent[] = [];
  const socket = {
    emit: (event: string, payload: unknown) => {
      emitted.push({ event, payload });
    },
  } as unknown as AppSocket;
  return { socket, emitted };
}
