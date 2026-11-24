import { beforeEach, describe, expect, it } from 'vitest';
import { defaultDeployment, type LibraryItem } from 'shared';
import { fakeSocket, makeMap, makeScene, makeToken } from '../test/fixtures';
import { useGameStore } from '../store/useGameStore';
import { deploymentPendingOf, inDeploymentArea } from './deployment';

const lib = (id: string, name: string): LibraryItem =>
  ({ ...makeToken(id, { name, isPlayerToken: true }) }) as unknown as LibraryItem;

function setup(options: { enabled?: boolean; ownOnMap?: boolean; ownInLibrary?: boolean; role?: 'dm' | 'player' } = {}) {
  const enemy = makeToken('enemy', { name: 'Гоблин' });
  const own = makeToken('own', { libraryItemId: 'lib1', name: 'Иван' });
  const map = makeMap('m1', options.ownOnMap ? [enemy, own] : [enemy]);
  map.deployment = { ...defaultDeployment(), enabled: options.enabled ?? true };
  useGameStore.setState({
    socket: fakeSocket().socket,
    scene: makeScene([map], 'm1'),
    viewMapId: 'm1',
    selfId: 'p1',
    role: options.role ?? 'player',
    testMode: false,
    library: options.ownInLibrary === false ? [] : [lib('lib1', 'Иван')],
    currentCharacterId: 'lib1',
  });
  return useGameStore.getState();
}

beforeEach(() => {
  useGameStore.setState({ library: [], currentCharacterId: null, role: 'player', testMode: false });
});

describe('deploymentPendingOf', () => {
  it('скрывает карту игроку со своим токеном в библиотеке', () => {
    expect(deploymentPendingOf(setup())).toBe(true);
  });

  it('не скрывает после установки своего токена', () => {
    expect(deploymentPendingOf(setup({ ownOnMap: true }))).toBe(false);
  });

  it('не скрывает без доступного токена и без включённой галки', () => {
    expect(deploymentPendingOf(setup({ ownInLibrary: false }))).toBe(false);
    expect(deploymentPendingOf(setup({ enabled: false }))).toBe(false);
  });

  it('DM всегда видит карту', () => {
    expect(deploymentPendingOf(setup({ role: 'dm' }))).toBe(false);
  });
});

describe('inDeploymentArea', () => {
  const areas = [{ id: 'a1', x: 100, y: 100, w: 100, h: 50 }];

  it('проверяет попадание в границы', () => {
    expect(inDeploymentArea(150, 125, areas)).toBe(true);
    expect(inDeploymentArea(100, 100, areas)).toBe(true);
    expect(inDeploymentArea(99, 125, areas)).toBe(false);
    expect(inDeploymentArea(150, 151, areas)).toBe(false);
  });

  it('без зон попадания нет', () => {
    expect(inDeploymentArea(0, 0, [])).toBe(false);
  });
});
