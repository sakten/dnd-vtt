import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GRID, emptyCombatState } from 'shared';
import { fakeSocket, makeMap, type EmittedEvent } from '../../test/fixtures';
import { useGameStore } from '../useGameStore';

let emitted: EmittedEvent[] = [];

beforeEach(() => {
  const { socket, emitted: out } = fakeSocket();
  emitted = out;
  useGameStore.setState({
    socket,
    viewMapId: 'm1',
    scene: { maps: [makeMap('m1')], activeMapId: 'm1', grid: { ...DEFAULT_GRID } },
  });
});

const last = (event: string) => emitted.filter((e) => e.event === event).at(-1)?.payload;

describe('combat slice: эмиты', () => {
  it('управление боем шлёт события с mapId', () => {
    const s = useGameStore.getState();
    s.startCombat();
    expect(last('combat:start')).toEqual({ mapId: 'm1' });
    s.endCombat();
    expect(last('combat:end')).toEqual({ mapId: 'm1' });
    s.addMapCombatants();
    expect(last('combat:addMap')).toEqual({ mapId: 'm1' });
    s.clearCombat();
    expect(last('combat:clear')).toEqual({ mapId: 'm1' });
  });

  it('действия с бойцами передают id/patch', () => {
    const s = useGameStore.getState();
    s.addCombatant('tok1');
    expect(last('combat:add')).toEqual({ mapId: 'm1', tokenId: 'tok1' });
    s.removeCombatant('e1');
    expect(last('combat:remove')).toEqual({ mapId: 'm1', id: 'e1' });
    s.updateCombatant('e1', { name: 'X' });
    expect(last('combat:update')).toEqual({ mapId: 'm1', id: 'e1', patch: { name: 'X' } });
    s.moveCombatant('e1', 2);
    expect(last('combat:move')).toEqual({ mapId: 'm1', id: 'e1', toIndex: 2 });
  });

  it('броски инициативы с id и без', () => {
    const s = useGameStore.getState();
    s.rollInitiative('e1');
    expect(last('combat:roll')).toEqual({ mapId: 'm1', id: 'e1' });
    s.rollInitiative();
    expect(last('combat:roll')).toEqual({ mapId: 'm1' });
  });

  it('ход: endTurn и setTurn', () => {
    const s = useGameStore.getState();
    s.endTurn();
    expect(last('combat:endTurn')).toEqual({ mapId: 'm1' });
    s.setTurn('e1');
    expect(last('combat:setTurn')).toEqual({ mapId: 'm1', id: 'e1' });
  });

  it('без активной карты ничего не шлётся', () => {
    useGameStore.setState({ viewMapId: null });
    const s = useGameStore.getState();
    s.startCombat();
    s.endTurn();
    s.setTurn('e1');
    expect(emitted).toHaveLength(0);
  });
});

describe('combat slice: onCombatUpdate', () => {
  it('заменяет состояние боя карты', () => {
    const combat = { ...emptyCombatState(), active: true, round: 3, currentIndex: 1 };
    useGameStore.getState().onCombatUpdate({ mapId: 'm1', combat });
    expect(useGameStore.getState().scene.maps[0].combat).toEqual(combat);
  });
});
