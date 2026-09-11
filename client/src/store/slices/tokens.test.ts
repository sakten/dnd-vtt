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
    targetTokenId: null,
    measureFromId: null,
    hoverTokenId: null,
    tokenMenuId: null,
  });
  return emitted;
}

const deactivateCombat = () => {
  const s = useGameStore.getState();
  useGameStore.setState({
    scene: { ...s.scene, maps: s.scene.maps.map((m) => ({ ...m, combat: { ...m.combat, active: false } })) },
  });
};

const turn = () => useGameStore.getState().scene.maps[0].combat.turns.e1;
const token = () => useGameStore.getState().scene.maps[0].tokens[0];
const hasEvent = (emitted: EmittedEvent[], event: string) => emitted.some((e) => e.event === event);

let emitted: EmittedEvent[] = [];
beforeEach(() => {
  emitted = setupState();
});

describe('tokens slice: передвижение', () => {
  it('moveToken двигает токен и накапливает путь активного бойца', () => {
    useGameStore.getState().moveToken('t1', 100, 0);

    expect(token().x).toBe(100);
    expect(turn().movementUsed).toBe(10);
    expect(hasEvent(emitted, 'token:move')).toBe(true);
  });

  it('не накапливает путь, если бой не активен', () => {
    deactivateCombat();
    useGameStore.getState().moveToken('t1', 100, 0);
    expect(token().x).toBe(100);
    expect(turn().movementUsed).toBe(0);
  });

  it('finalizeTokenMove добирает финальный сегмент и шлёт setMovement', () => {
    useGameStore.getState().moveToken('t1', 100, 0);
    useGameStore.getState().finalizeTokenMove('t1', 150, 0);

    expect(turn().movementUsed).toBe(15);
    expect(emitted).toContainEqual({
      event: 'combat:setMovement',
      payload: { mapId: 'm1', tokenId: 't1', used: 15, diagonals: 0 },
    });
    expect(emitted).toContainEqual({ event: 'token:lock', payload: { mapId: 'm1', id: 't1', lock: false } });
  });

  it('диагонали чередуют стоимость 5/10', () => {
    useGameStore.getState().moveToken('t1', 50, 50);
    expect(turn().movementUsed).toBe(5);
    expect(turn().diagonalsUsed).toBe(1);

    useGameStore.getState().moveToken('t1', 100, 100);
    expect(turn().movementUsed).toBe(15);
    expect(turn().diagonalsUsed).toBe(2);
  });

  it('finalizeTokenMove без активной записи не шлёт setMovement', () => {
    deactivateCombat();
    useGameStore.getState().finalizeTokenMove('t1', 50, 0);
    expect(hasEvent(emitted, 'combat:setMovement')).toBe(false);
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
    expect(useGameStore.getState().scene.maps[0].tokens.map((t) => t.id)).toEqual(['t1', 't2']);

    useGameStore.setState({
      selectedTokenId: 't1',
      targetTokenId: 't1',
      measureFromId: 't1',
      hoverTokenId: 't1',
      draggingTokenId: 't1',
      tokenMenuId: 't1',
    });
    useGameStore.getState().onTokenRemove({ mapId: 'm1', id: 't1' });

    const st = useGameStore.getState();
    expect(st.scene.maps[0].tokens.map((t) => t.id)).toEqual(['t2']);
    expect(st.selectedTokenId).toBeNull();
    expect(st.targetTokenId).toBeNull();
    expect(st.measureFromId).toBeNull();
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
