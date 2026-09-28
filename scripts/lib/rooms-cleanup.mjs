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
 * Удалить только тестовые комнаты — созданные автотестами с маркером `test`
 * (`room:create`/`admin:create` с `test: true`). Обычные комнаты не трогаются
 * никогда: снимок «до» не нужен, поэтому холодный старт сервера безопасен
 * (инцидент 28.09 — очистка по пустому снимку снесла все комнаты).
 */
export function deleteTestRooms(url) {
  return withSocket(url, (socket, finish) => {
    socket.emit('admin:list', { adminToken: ADMIN_TOKEN }, (res) => {
      if (!res || !Array.isArray(res.rooms)) {
        finish();
        return;
      }
      const codes = res.rooms.filter((r) => r.test === true).map((r) => r.code);
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
