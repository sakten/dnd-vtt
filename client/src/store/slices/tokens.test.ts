import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GRID, emptyCombatState, emptyTurnState } from 'shared';
import { fakeSocket, makeMap, makeToken, type EmittedEvent } from '../../test/fixtures';
import { useGameStore } from '../useGameStore';

function setupState() {
  const { socket, emitted } = fakeSocket();
  const combat = {
    ...emptyCombatState(),
    active: true,
    round: 1,
    currentIndex: 0,
    entries: [{ id: 'e1', tokenId: 't1', name: 'A', imageUrl: '', initiative: 10, bonus: '' }],
    turns: { e1: { ...emptyTurnState(30), movementUsed: 0 } },
  };
  const map = { ...makeMap('m1', [makeToken('t1')]), combat };
  useGameStore.setState({
    socket,
    viewMapId: 'm1',
    scene: { maps: [map], activeMapId: 'm1', grid: { ...DEFAULT_GRID } },
    draggingTokenId: null,
    selectedTokenId: null,
    interaction: null,
    hoverTokenId: null,
    tokenMenuId: null,
    movingTokens: {},
    dragGhost: null,
    dragPath: null,
  });
  return emitted;
}

const deactivateCombat = () => {
  const s = useGameStore.getState();
  useGameStore.setState({
    scene: { ...s.scene, maps: s.scene.maps.map((m) => ({ ...m, combat: { ...m.combat, active: false } })) },
  });
};

const turn = () => useGameStore.getState().scene.maps[0]!.combat.turns.e1!;
const token = () => useGameStore.getState().scene.maps[0]!.tokens[0]!;
const hasEvent = (emitted: EmittedEvent[], event: string) => emitted.some((e) => e.event === event);

let emitted: EmittedEvent[] = [];
beforeEach(() => {
  emitted = setupState();
});

describe('tokens slice: передвижение', () => {
  it('moveToken двигает токен локально, без рассылки и без учёта', () => {
    useGameStore.getState().moveToken('t1', 100, 0);

    expect(token().x).toBe(100);
    expect(turn().movementUsed).toBe(0);
    expect(hasEvent(emitted, 'token:move')).toBe(false);
  });

  it('moveTokenAlongPath: анимация, событие с путём и учёт движения', () => {
    const path = {
      cells: [
        { cx: 0, cy: 0 },
        { cx: 1, cy: 1 },
        { cx: 2, cy: 1 },
      ],
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 50 },
      ],
      feet: 15,
      diagonals: 1,
    };
    useGameStore.getState().moveTokenAlongPath('t1', path);

    expect(token().x).toBe(100);
    expect(token().y).toBe(50);
    expect(useGameStore.getState().movingTokens.t1?.points.length).toBe(3);
    expect(turn().movementUsed).toBe(15);
    expect(turn().diagonalsUsed).toBe(1);
    expect(emitted).toContainEqual({
      event: 'token:move',
      payload: { mapId: 'm1', id: 't1', x: 100, y: 50, path: path.points },
    });
    expect(emitted).toContainEqual({
      event: 'combat:setMovement',
      payload: { mapId: 'm1', tokenId: 't1', used: 15, diagonals: 1, path: path.points },
    });
    expect(emitted).toContainEqual({ event: 'token:lock', payload: { mapId: 'm1', id: 't1', lock: false } });
  });

  it('вижн-зоны: moveTokenAlongPath не шлёт setMovement вне боя', () => {
    deactivateCombat();
    useGameStore.getState().moveTokenAlongPath('t1', {
      cells: [{ cx: 0, cy: 0 }, { cx: 1, cy: 0 }],
      points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
      feet: 5,
      diagonals: 0,
    });
    expect(token().x).toBe(50);
    expect(hasEvent(emitted, 'combat:setMovement')).toBe(false);
  });

  it('moveTokenAlongPath с одной точкой синхронизирует позицию без анимации', () => {
    useGameStore.getState().moveTokenAlongPath('t1', {
      cells: [{ cx: 0, cy: 0 }],
      points: [{ x: 0, y: 0 }],
      feet: 0,
      diagonals: 0,
    });
    expect(useGameStore.getState().movingTokens.t1).toBeUndefined();
    expect(hasEvent(emitted, 'token:move')).toBe(true);
  });

  it('onTokenMove игнорирует эхо, пока токен уже анимируется', () => {
    useGameStore.setState({ movingTokens: { t1: { points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], duration: 150 } } });
    useGameStore.getState().onTokenMove({ mapId: 'm1', id: 't1', path: [{ x: 0, y: 0 }, { x: 200, y: 0 }] });
    expect(useGameStore.getState().movingTokens.t1?.points[1]).toEqual({ x: 50, y: 0 });

    useGameStore.getState().onTokenMove({ mapId: 'm1', id: 't2', path: [{ x: 0, y: 0 }, { x: 200, y: 0 }] });
    expect(useGameStore.getState().movingTokens.t2?.duration).toBe(150);
  });
});

describe('tokens slice: обновления', () => {
  it('onTokenUpdate игнорируется при активном drag', () => {
    useGameStore.setState({ draggingTokenId: 't1' });
    useGameStore.getState().onTokenUpdate({ mapId: 'm1', token: makeToken('t1', { x: 999 }) });
    expect(token().x).toBe(0);

    useGameStore.setState({ draggingTokenId: null });
    useGameStore.getState().onTokenUpdate({ mapId: 'm1', token: makeToken('t1', { x: 999 }) });
    expect(token().x).toBe(999);
  });

  it('onTokenAdd добавляет токен, onTokenRemove удаляет и чистит ссылки', () => {
    useGameStore.getState().onTokenAdd({ mapId: 'm1', token: makeToken('t2') });
    expect(useGameStore.getState().scene.maps[0]!.tokens.map((t) => t.id)).toEqual(['t1', 't2']);

    useGameStore.setState({
      selectedTokenId: 't1',
      interaction: { mode: 'target', target: { kind: 'action', tokenId: 't1', actionId: 'attack', slot: 'action', label: 'Атака' } },
      hoverTokenId: 't1',
      draggingTokenId: 't1',
      tokenMenuId: 't1',
    });
    useGameStore.getState().onTokenRemove({ mapId: 'm1', id: 't1' });

    const st = useGameStore.getState();
    expect(st.scene.maps[0]!.tokens.map((t) => t.id)).toEqual(['t2']);
    expect(st.selectedTokenId).toBeNull();
    expect(st.interaction).toBeNull();
    expect(st.hoverTokenId).toBeNull();
    expect(st.draggingTokenId).toBeNull();
    expect(st.tokenMenuId).toBeNull();
  });

  it('removeToken шлёт token:remove', () => {
    useGameStore.getState().removeToken('t1');
    expect(emitted).toContainEqual({ event: 'token:remove', payload: { mapId: 'm1', id: 't1' } });
  });

  it('setTokenFields зажимает размер и рассылает patch', () => {
    useGameStore.getState().setTokenFields('t1', { cells: 9 });

    expect(token().cells).toBe(4);
    expect(token().w).toBe(4 * DEFAULT_GRID.size);
    const update = emitted.find((e) => e.event === 'token:update');
    expect(update?.payload).toMatchObject({ mapId: 'm1', id: 't1', patch: { cells: 4 } });
  });
});
