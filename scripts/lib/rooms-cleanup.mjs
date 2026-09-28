import { io } from 'socket.io-client';

const ADMIN_TOKEN = process.env.VTT_ADMIN_TOKEN ?? '';

/** Открыть служебный сокет, выполнить fn, гарантированно закрыть по таймауту. */
function withSocket(url, fn, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const socket = io(url);
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    socket.on('connect', () => fn(socket, finish));
    socket.on('connect_error', () => finish(undefined));
  });
}

/**
 * Коды всех комнат на сервере (для снимка «до» теста).
 * `undefined` — сервер не ответил: снимок недостоверен, очистка запрещена.
 */
export async function snapshotRoomCodes(url, attempts = 4) {
  for (let i = 0; i < attempts; i += 1) {
    const codes = await withSocket(url, (socket, finish) => {
      socket.emit('admin:list', { adminToken: ADMIN_TOKEN }, (res) => {
        finish(res && Array.isArray(res.rooms) ? res.rooms.map((r) => r.code) : undefined);
      });
    });
    if (codes) return codes;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return undefined;
}

/** Удалить все комнаты, которых не было в снимке `baselineCodes`. */
export function deleteNewRooms(url, baselineCodes) {
  // Пустой baseline неотличим от «сервер был не готов»: без достоверного снимка
  // не удаляем ничего, иначе холодный старт сносит все комнаты (инцидент 28.09).
  if (!Array.isArray(baselineCodes)) return Promise.resolve();
  const baseline = new Set(baselineCodes);
  return withSocket(url, (socket, finish) => {
    socket.emit('admin:list', { adminToken: ADMIN_TOKEN }, (res) => {
      if (!res || !Array.isArray(res.rooms)) {
        finish();
        return;
      }
      const codes = res.rooms.map((r) => r.code).filter((code) => !baseline.has(code));
      if (codes.length === 0) {
        finish();
        return;
      }
      let pending = codes.length;
      for (const code of codes) {
        socket.emit('admin:delete', { adminToken: ADMIN_TOKEN, code }, () => {
          pending -= 1;
          if (pending === 0) finish();
        });
      }
    });
  });
}
