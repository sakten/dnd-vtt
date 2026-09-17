import { beforeEach, describe, expect, it } from 'vitest';
import { fakeSocket } from '../../test/fixtures';
import { useGameStore } from '../useGameStore';

beforeEach(() => {
  useGameStore.setState({
    socket: fakeSocket().socket,
    wallsMode: { active: false, tool: 'wall', start: null },
  });
});

describe('view slice: режим стен', () => {
  it('выход из режима завершает цепочку', () => {
    const st = useGameStore.getState();
    st.setWallsMode({ active: true, start: { x: 10, y: 20 } });
    expect(useGameStore.getState().wallsMode.start).toEqual({ x: 10, y: 20 });

    st.setWallsMode({ active: false });
    expect(useGameStore.getState().wallsMode.active).toBe(false);
    expect(useGameStore.getState().wallsMode.start).toBeNull();
  });

  it('смена инструмента цепочку не трогает', () => {
    const st = useGameStore.getState();
    st.setWallsMode({ active: true, start: { x: 10, y: 20 }, tool: 'door' });
    expect(useGameStore.getState().wallsMode.start).toEqual({ x: 10, y: 20 });
    expect(useGameStore.getState().wallsMode.tool).toBe('door');
  });
});
