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

/** Назначает персонажа игроку (ждём ack). */
export function setCharacter(S, libraryItemId, socket = S.player) {
  return new Promise((resolve, reject) => {
    socket.emit('player:setCharacter', { libraryItemId }, (res) => {
      if (res && 'error' in res) reject(new Error(res.error));
      else resolve(res);
    });
  });
}

/**
 * Добавляет токен и ждёт рассылку token:add; возвращает payload { mapId, token }.
 * `by` — кто шлёт, `observe` — чей видимый вариант токена нужен (по умолчанию игрок).
 */
export async function spawnToken(S, { libraryItemId, x = 0, y = 0, mapId = S.map1.id, by = 'player', observe = 'player' } = {}) {
  const emitter = by === 'dm' ? S.dm : S.player;
  const watcher = observe === 'dm' ? S.dm : S.player;
  const addP = eventOnce(watcher, 'token:add');
  emitter.emit('token:add', { mapId, libraryItemId, x, y });
  return await addP;
}

/** Обновляет лист персонажа и ждёт эхо sheet:update (возвращает payload). */
export async function setSheet(S, sheet, socket = S.player) {
  const echoP = eventOnce(socket, 'sheet:update');
  socket.emit('sheet:update', sheet);
  return await echoP;
}

/** Ждёт token:update по id с предикатом (эффекты, HP и т.п.). */
export function waitToken(S, id, predicate, socket = S.dm, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('token:update', handler);
      reject(new Error(`timeout waiting for token ${id}`));
    }, timeout);
    const handler = (p) => {
      if (p.token.id === id && predicate(p.token)) {
        clearTimeout(timer);
        socket.off('token:update', handler);
        resolve(p.token);
      }
    };
    socket.on('token:update', handler);
  });
}
