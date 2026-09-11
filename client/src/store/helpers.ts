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
