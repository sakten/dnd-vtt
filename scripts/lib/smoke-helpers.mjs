export function eventOnce(emitter, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(event, handler);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    const handler = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    emitter.once(event, handler);
  });
}

export function joinAndAck(emitter, emitFn, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off('room:joined', handler);
      reject(new Error('timeout waiting for room:joined'));
    }, timeoutMs);
    const handler = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    emitter.once('room:joined', handler);
    emitFn((res) => {
      if (res && 'error' in res) {
        clearTimeout(timer);
        emitter.off('room:joined', handler);
        reject(new Error(res.error));
      }
    });
  });
}

export function ack(emitFn, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for ack')), timeoutMs);
    emitFn((res) => {
      clearTimeout(timer);
      if (res && 'error' in res) reject(new Error(res.error));
      else resolve(res);
    });
  });
}

export const waitFor = (fn, timeout = 5000) =>
  new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (fn()) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - t0 > timeout) {
        clearInterval(iv);
        reject(new Error('timeout'));
      }
    }, 50);
  });

export function waitMsg(emitter, pred, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off('chat:message', handler);
      reject(new Error('timeout waiting for chat message'));
    }, timeout);
    const handler = (m) => {
      if (pred(m)) {
        clearTimeout(timer);
        emitter.off('chat:message', handler);
        resolve(m);
      }
    };
    emitter.on('chat:message', handler);
  });
}

export async function addLibrary(S, name, fields) {
  S.dm.emit('library:add', { name, ...fields });
  await waitFor(() => S.lastLibrary && S.lastLibrary.some((i) => i.name === name));
  return S.lastLibrary.find((i) => i.name === name).id;
}
