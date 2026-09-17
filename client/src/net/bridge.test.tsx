import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../store/types';
import { attachSocketBridge } from './bridge';
import type { AppSocket } from './socket';

function fakeSocket() {
  return {
    connected: true,
    on: vi.fn(),
    off: vi.fn(),
    onAny: vi.fn(),
    offAny: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    emit: vi.fn(),
  };
}

const get = (() => ({})) as unknown as () => GameState;

describe('attachSocketBridge', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('вешает слушатели и heartbeat', () => {
    const socket = fakeSocket();
    attachSocketBridge(socket as unknown as AppSocket, get);

    expect(socket.onAny).toHaveBeenCalledTimes(1);
    expect(socket.on).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('dispose снимает слушатели и гасит heartbeat', () => {
    const socket = fakeSocket();
    const dispose = attachSocketBridge(socket as unknown as AppSocket, get);

    dispose();

    expect(socket.offAny).toHaveBeenCalledTimes(1);
    expect(socket.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('heartbeat пингует, а при долгом простое переподключает сокет', () => {
    const socket = fakeSocket();
    attachSocketBridge(socket as unknown as AppSocket, get);

    vi.advanceTimersByTime(60_000);
    expect(socket.emit).toHaveBeenCalledWith('ping');
    expect(socket.disconnect).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000 * 3);
    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.connect).toHaveBeenCalled();
  });
});
