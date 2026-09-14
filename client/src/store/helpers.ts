import type { ClientToServerEvents } from 'shared';
import type { StoreGet } from './types';

interface ThrottleState {
  last: number;
  timer: ReturnType<typeof setTimeout> | null;
  fn: () => void;
}

const states = new Map<string, ThrottleState>();

function run(state: ThrottleState) {
  if (state.timer !== null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.last = Date.now();
  state.fn();
}

/**
 * Throttle с догоняющим вызовом: если окно ещё не прошло, последний `fn`
 * (с самыми свежими данными) будет вызван по истечении окна, а не потерян.
 */
export function throttled(key: string, ms: number, fn: () => void) {
  const now = Date.now();
  const state = states.get(key) ?? { last: -Infinity, timer: null, fn };
  state.fn = fn;
  states.set(key, state);
  if (now - state.last >= ms) {
    run(state);
    return;
  }
  if (state.timer === null) {
    state.timer = setTimeout(() => {
      state.timer = null;
      run(state);
    }, ms - (now - state.last));
  }
}

/** Немедленно выполнить отложенный вызов (если есть). */
export function flushThrottled(key: string) {
  const state = states.get(key);
  if (state) run(state);
}

/** Отменить отложенный вызов, не выполняя его. */
export function clearThrottled(key: string) {
  const state = states.get(key);
  if (!state) return;
  if (state.timer !== null) clearTimeout(state.timer);
  states.delete(key);
}

type EventPayload<E extends keyof ClientToServerEvents> = Parameters<ClientToServerEvents[E]>[0];

/** Отправка события без проверки полного типа (ack-события имеют второй аргумент). */
type LooseSocket = { emit: (event: string, payload: unknown) => void };

/** События клиент→сервер, в payload которых есть mapId. */
type MapEvent = {
  [E in keyof ClientToServerEvents]: EventPayload<E> extends { mapId: string } ? E : never;
}[keyof ClientToServerEvents];

/** Отправить событие с mapId активной карты (без карты/сокета — молча выходим). */
export function emitInMap<E extends MapEvent>(
  get: StoreGet,
  event: E,
  payload: Omit<EventPayload<E>, 'mapId'>
) {
  const { viewMapId: mapId, socket } = get();
  if (!mapId || !socket) return;
  (socket as unknown as LooseSocket).emit(event, { mapId, ...payload });
}

/** Отправить событие без привязки к карте (без сокета — молча выходим). */
export function emit<E extends keyof ClientToServerEvents>(get: StoreGet, event: E, payload: EventPayload<E>) {
  const socket = get().socket;
  if (!socket) return;
  (socket as unknown as LooseSocket).emit(event, payload);
}

/** Троттлинг события; payload считается в момент отправки (undefined — не отправляем). */
export function emitThrottled<E extends keyof ClientToServerEvents>(
  get: StoreGet,
  key: string,
  ms: number,
  event: E,
  payloadOf: () => EventPayload<E> | undefined
) {
  throttled(key, ms, () => {
    const socket = get().socket;
    const payload = payloadOf();
    if (!socket || payload === undefined) return;
    (socket as unknown as LooseSocket).emit(event, payload);
  });
}

/** Троттлинг map-события: mapId активной карты подставляется в момент отправки. */
export function emitThrottledInMap<E extends MapEvent>(
  get: StoreGet,
  key: string,
  ms: number,
  event: E,
  payloadOf: () => Omit<EventPayload<E>, 'mapId'> | undefined
) {
  throttled(key, ms, () => {
    const { viewMapId: mapId, socket } = get();
    const payload = payloadOf();
    if (!mapId || !socket || payload === undefined) return;
    (socket as unknown as LooseSocket).emit(event, { mapId, ...payload });
  });
}
