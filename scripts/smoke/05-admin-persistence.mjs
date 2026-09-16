import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, joinAndAck, ack, waitMsg } from '../lib/smoke-helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';

S.player.emit('dice:roll', { expression: 'd20' });
await waitMsg(S.dm, (m) => m.kind === 'roll' && m.roll.expression === 'd20');

const listRes = await ack((cb) => S.dm.emit('admin:list', { adminToken: '' }, cb));
check(
  listRes.rooms.some((r) => r.code === S.created.room.code && typeof r.name === 'string' && r.name.length > 0),
  'admin:list показывает комнаты с названиями'
);

const renamedEvent = eventOnce(S.player, 'room:renamed');
const renameRes = await ack((cb) =>
  S.dm.emit('admin:rename', { adminToken: '', code: S.created.room.code, name: 'Переименованная' }, cb)
);
check('ok' in renameRes, 'admin:rename переименовывает комнату');
const renamedPayload = await renamedEvent;
check(renamedPayload.name === 'Переименованная', 'игроки получают room:renamed');
const listNamed = await ack((cb) => S.dm.emit('admin:list', { adminToken: '' }, cb));
check(
  listNamed.rooms.some((r) => r.code === S.created.room.code && r.name === 'Переименованная'),
  'новое имя комнаты видно в списке'
);

const adminCreated = await joinAndAck(S.dm, (cb) =>
  S.dm.emit('admin:create', { adminToken: '', name: 'Ведущий-2', clientId: 'smoke-dm' }, cb)
);
check(adminCreated.room.code !== S.created.room.code, 'admin:create создаёт новую игру');
check(
  adminCreated.room.players.find((p) => p.id === 'smoke-dm')?.role === 'dm',
  'админ входит в новую игру как ведущий'
);

const roomsDir = path.resolve('server/data/rooms');
const savedFile = path.join(roomsDir, `${S.created.room.code}.json`);
const chatFile = path.join(roomsDir, `${S.created.room.code}.chat.json`);
const readJson = (file) => {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
// Запись с дебаунсом: просим сервер сбросить отложенные файлы (детерминированно, без ожидания).
await ack((cb) => S.dm.emit('admin:flush', { adminToken: '' }, cb));
const persisted = readJson(savedFile);
check(!!persisted, 'room persisted to disk');
if (persisted) {
  check(persisted.name === 'Переименованная', 'название комнаты persisted');
  check(persisted.scene.maps.length === 2, 'maps persisted');
  check(persisted.scene.maps[0].tokens.length === 3, 'tokens map1 persisted (3)');
  check(persisted.scene.maps[0].combat && persisted.scene.maps[0].combat.active === false, 'combat persisted');
  check(persisted.scene.maps[1].tokens.length === 0, 'tokens map2 persisted (0)');
  check(persisted.library.length === 5 && persisted.library[0].cells === 3, 'library persisted');
  check(persisted.scene.maps[0].fog.hidden.length === 2, 'fog persisted');
  check(
    persisted.sheets && persisted.sheets['smoke-p1'] && persisted.sheets['smoke-p1'].name === 'Гоблин-игрок',
    'character sheet persisted'
  );
  check(
    persisted.resources &&
      persisted.resources['smoke-p1'] &&
      persisted.resources['smoke-p1'].hitDice?.[0]?.current === 2,
    'resources persisted'
  );
  check(persisted.chat === undefined, 'чат вынесен из файла комнаты');
}
const persistedChat = readJson(chatFile);
check(Array.isArray(persistedChat) && persistedChat.length >= 2, 'чат persisted отдельным файлом');

const delRoomCode = adminCreated.room.code;
const deletedEventPromise = eventOnce(S.dm, 'room:deleted');
await ack((cb) => S.dm.emit('admin:delete', { adminToken: '', code: delRoomCode }, cb));
await deletedEventPromise;
const listAfter = await ack((cb) => S.player.emit('admin:list', { adminToken: '' }, cb));
check(!listAfter.rooms.some((r) => r.code === delRoomCode), 'комната удалена из списка');
await sleep(500);
const delFile = path.join(roomsDir, `${delRoomCode}.json`);
const delChatFile = path.join(roomsDir, `${delRoomCode}.chat.json`);
check(!fs.existsSync(delFile) && !fs.existsSync(delChatFile), 'файлы комнаты и чата удалены с диска');

if (S.uploadedDir) check(fs.existsSync(S.uploadedDir), 'папка загрузок комнаты существует до удаления');
await ack((cb) => S.player.emit('admin:delete', { adminToken: '', code: S.created.room.code }, cb));
await sleep(500);
const room1File = path.join(roomsDir, `${S.created.room.code}.json`);
const room1ChatFile = path.join(roomsDir, `${S.created.room.code}.chat.json`);
check(!fs.existsSync(room1File) && !fs.existsSync(room1ChatFile), 'тестовая комната удалена после теста (файлы стёрты)');
if (S.uploadedDir) check(!fs.existsSync(S.uploadedDir), 'папка загрузок комнаты удалена вместе с комнатой');

S.dm.close();
S.player.close();
