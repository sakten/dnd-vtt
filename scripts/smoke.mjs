import { io } from 'socket.io-client';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VTT_URL ?? 'http://localhost:3001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const watchdog = setTimeout(() => {
  console.log('SMOKE TIMEOUT');
  process.exit(1);
}, 120000);
watchdog.unref();

let ok = true;
const check = (cond, label) => {
  console.log(cond ? 'PASS' : 'FAIL', '-', label);
  if (!cond) ok = false;
};

function eventOnce(emitter, event, timeoutMs = 8000) {
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

function joinAndAck(emitter, emitFn, timeoutMs = 8000) {
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

function ack(emitFn, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for ack')), timeoutMs);
    emitFn((res) => {
      clearTimeout(timer);
      if (res && 'error' in res) reject(new Error(res.error));
      else resolve(res);
    });
  });
}

const waitFor = (fn, timeout = 5000) =>
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

function waitMsg(emitter, pred, timeout = 4000) {
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

const dm = io(URL);
const player = io(URL);
await Promise.all([eventOnce(dm, 'connect'), eventOnce(player, 'connect')]);

const created = await joinAndAck(dm, (cb) =>
  dm.emit('room:create', { name: 'Мастер', clientId: 'smoke-dm' }, cb)
);
console.log('room created:', created.room.code);

check(created.room.code.length >= 10, `код комнаты длинный и случайный (${created.room.code.length} символов)`);
check(
  typeof created.room.name === 'string' && created.room.name.length > 0,
  `у комнаты есть название (${created.room.name})`
);

const joined = await joinAndAck(player, (cb) =>
  player.emit('room:join', { code: created.room.code, name: 'Игрок', clientId: 'smoke-p1' }, cb)
);
console.log('player joined as:', joined.room.players.find((p) => p.id === 'smoke-p1').role);

check(Array.isArray(joined.room.scene.maps) && joined.room.scene.maps.length === 0, 'новая комната без карт');
check(Array.isArray(joined.room.library) && joined.room.library.length === 0, 'библиотека токенов пустая в новой комнате');

let lastMaps = null;
player.on('maps:update', (p) => {
  lastMaps = p;
});
let lastLibrary = null;
player.on('library:update', (l) => {
  lastLibrary = l;
});
let lastBring = null;
player.on('map:bring', (p) => {
  lastBring = p;
});
let gridUpdates = 0;
dm.on('grid:update', () => {
  gridUpdates++;
});

async function addLibrary(name, fields) {
  dm.emit('library:add', { name, ...fields });
  await waitFor(() => lastLibrary && lastLibrary.some((i) => i.name === name));
  return lastLibrary.find((i) => i.name === name).id;
}

dm.emit('map:add', { name: 'Подземелье', url: '/uploads/m.png', width: 800, height: 600 });
await waitFor(() => lastMaps && lastMaps.maps.length === 1);
check(lastMaps.activeMapId === lastMaps.maps[0].id, 'карта добавлена и стала активной');
const map1 = lastMaps.maps[0];

player.emit('map:add', { name: 'Hack', url: '/x.png', width: 10, height: 10 });
await sleep(600);
check(lastMaps.maps.length === 1, 'игрок не может добавлять карты');

dm.emit('library:add', {
  name: 'Гоблин',
  imageUrl: '/uploads/goblin.png',
  cells: 2,
  round: true,
  description: 'Зелёный',
  initiativeBonus: '+2',
});
await waitFor(() => lastLibrary && lastLibrary.length === 1);
check(
  lastLibrary[0].name === 'Гоблин' &&
    lastLibrary[0].cells === 2 &&
    lastLibrary[0].description === 'Зелёный' &&
    lastLibrary[0].round === true &&
    lastLibrary[0].initiativeBonus === '+2',
  'библиотека общая: игрок получил токен от DM (со свойствами)'
);
player.emit('library:update', { id: lastLibrary[0].id, patch: { cells: 3 } });
await waitFor(() => lastLibrary && lastLibrary[0]?.cells === 3);
check(lastLibrary[0].cells === 3, 'игрок может менять свойства предмета в общей библиотеке');

const goblinItem = await addLibrary('Гоблин-воин', {
  imageUrl: '/uploads/fake.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
});
dm.emit('token:add', { mapId: map1.id, libraryItemId: goblinItem, x: 100, y: 100 });
const tokenAdd = await eventOnce(player, 'token:add');
check(tokenAdd.token.name === 'Гоблин-воин', 'token add broadcast');
check(tokenAdd.mapId === map1.id, 'токен попал на нужную карту');
check(tokenAdd.token.cells === 1 && tokenAdd.token.w === 50, 'токен по умолчанию 1x1 (50px)');
const token = tokenAdd.token;

const dragonItem = await addLibrary('Дракон', {
  imageUrl: '/uploads/fake.png',
  cells: 3,
  round: true,
  description: 'Большой',
  initiativeBonus: '',
});
dm.emit('token:add', { mapId: map1.id, libraryItemId: dragonItem, x: 300, y: 300 });
const bigAdd = await eventOnce(player, 'token:add');
check(
  bigAdd.token.cells === 3 && bigAdd.token.w === 150 && bigAdd.token.round === true && bigAdd.token.description === 'Большой',
  'свойства перетащенного токена наследуются из библиотеки'
);

player.emit('token:move', { mapId: map1.id, id: token.id, x: 250, y: 300 });
const moved = await eventOnce(dm, 'token:update');
check(moved.token.id === token.id && moved.token.x === 250 && moved.token.y === 300, 'token move broadcast');

dm.emit('map:add', { name: 'Лес', url: '/uploads/m2.png', width: 640, height: 480 });
await waitFor(() => lastMaps && lastMaps.maps.length === 2);
const map2 = lastMaps.maps[1];
check(lastMaps.activeMapId === map2.id, 'вторая карта стала активной по умолчанию для новичков');

player.emit('map:bring', map1.id);
await sleep(600);
check(lastBring === null, 'игрок не может переносить всех на карту');

dm.emit('map:bring', map1.id);
await waitFor(() => lastBring && lastBring.activeMapId === map1.id);
check(true, 'DM переносит всех игроков на карту');

const thirdItem = await addLibrary('Третий', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '+5',
});
dm.emit('token:add', { mapId: map1.id, libraryItemId: thirdItem, x: 50, y: 50 });
const thirdAdd = await eventOnce(player, 'token:add');
check(thirdAdd.token.name === 'Третий', 'токен добавляется на указанную карту');
check(thirdAdd.token.initiativeBonus === '+5', 'бонус инициативы наследуется из библиотеки');

let combatState = null;
player.on('combat:update', (p) => {
  if (p.mapId === map1.id) combatState = p.combat;
});
dm.emit('combat:start', { mapId: map1.id });
await waitFor(() => combatState && combatState.active);
check(combatState.entries.length === 3, `бой начался, все токены карты в очереди (${combatState.entries.length})`);
check(
  combatState.entries.every((e, i, a) => i === 0 || a[i - 1].initiative >= e.initiative),
  'очередь отсортирована по инициативе'
);
check(
  combatState.entries.every((e) => e.initiative >= 1 && e.initiative <= 21),
  'инициатива = d20 + бонус'
);
check(
  combatState.entries.find((e) => e.name === 'Третий')?.bonus === '+5',
  'бонус инициативы токена учтён в бою'
);

const fifthItem = await addLibrary('Пятый', {
  imageUrl: '/y.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
});
dm.emit('token:add', { mapId: map1.id, libraryItemId: fifthItem, x: 70, y: 70 });
await eventOnce(player, 'token:add');
await waitFor(() => combatState.entries.length === 4);
check(combatState.entries.length === 4, 'токен, добавленный в бою, попал в очередь');
const addedEntry = combatState.entries.find((e) => e.name === 'Пятый');
check(!!addedEntry, 'запись нового токена есть в очереди');

dm.emit('token:remove', { mapId: map1.id, id: addedEntry.tokenId });
await eventOnce(player, 'token:remove');
await waitFor(() => combatState.entries.length === 3);
check(combatState.entries.length === 3, 'удалённый токен выбыл из очереди');

const combatCountBefore = combatState.entries.length;
player.emit('combat:remove', { mapId: map1.id, id: combatState.entries[0].id });
await sleep(400);
check(combatState.entries.length === combatCountBefore, 'игрок не управляет очередью инициативы');

dm.emit('combat:end', { mapId: map1.id });
await waitFor(() => combatState && !combatState.active);
check(!combatState.active && combatState.entries.length === 0, 'бой закончен, очередь очищена');

let combat2 = null;
player.on('combat:update', (p) => {
  if (p.mapId === map2.id) combat2 = p.combat;
});
dm.emit('combat:start', { mapId: map2.id });
await waitFor(() => combat2 && combat2.active);
check(combat2.active && combat2.entries.length === 0, 'бой у второй карты свой (пока без токенов)');
check(!combatState.active, 'бой первой карты не затронут');
dm.emit('combat:end', { mapId: map2.id });
await sleep(400);

player.emit('grid:update', { ...joined.room.scene.grid, size: 100 });
await sleep(800);
check(gridUpdates === 0, 'игрок не может менять сетку');

let playerFog = null;
player.on('fog:update', (p) => {
  playerFog = p;
});
const fogState = { size: 50, offsetX: 0, offsetY: 0, hidden: ['2,3', '3,3'] };
dm.emit('fog:update', { mapId: map1.id, fog: fogState });
await waitFor(() => playerFog && playerFog.fog.hidden.length === 2);
check(playerFog.mapId === map1.id, 'туман войны обновляется у игроков');
player.emit('fog:update', { mapId: map1.id, fog: { ...fogState, hidden: [] } });
await sleep(600);
check(playerFog.fog.hidden.length === 2, 'игрок не может менять туман');

player.emit('dice:roll', { expression: 'd20+3' });
const rollMsg = await waitMsg(dm, (m) => m.kind === 'roll' && !m.label);
check(rollMsg.roll.total >= 4 && rollMsg.roll.total <= 23, `dice d20+3 total=${rollMsg.roll.total}`);
check(rollMsg.roll.expression === 'd20+3', 'roll expression');

player.emit('dice:roll', { expression: 'd20+3+d4', label: 'Атака: Меч' });
const labeledMsg = await waitMsg(dm, (m) => m.kind === 'roll' && m.label === 'Атака: Меч');
check(labeledMsg.roll.expression === 'd20+3+d4', 'бросок с кубом-бонусом и меткой');

const svgForm = new FormData();
svgForm.append(
  'image',
  new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'], { type: 'image/svg+xml' }),
  'evil.svg'
);
const svgRes = await fetch(`${URL}/api/upload`, {
  method: 'POST',
  headers: { 'X-Room': created.room.code, 'X-Player': 'smoke-p1' },
  body: svgForm,
});
check(svgRes.status === 400, 'SVG-загрузки запрещены (400)');

const attackHitP = waitMsg(dm, (m) => m.kind === 'roll' && m.label === 'Атака: Топор');
const attackDmgP = waitMsg(dm, (m) => m.kind === 'roll' && m.label === 'Урон: Топор');
player.emit('dice:attack', {
  hit: { expression: 'd20+5', label: 'Атака: Топор' },
  damage: { expression: '2d6+3', label: 'Урон: Топор' },
});
const attackHit = await attackHitP;
const attackDmg = await attackDmgP;
check(attackHit.roll.dice[0].sides === 20, 'dice:attack кидает попадание');
check(
  attackDmg.roll.total >= 5 && attackDmg.roll.total <= 27,
  `dice:attack кидает урон (${attackDmg.roll.total})`
);

const testSheet = {
  name: 'Гоблин-игрок',
  abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 13, cha: 10 },
  proficiencyBonus: 'd4',
  saves: { dex: true },
  skills: { stealth: 2 },
  attacks: [
    { name: 'Кинжал', hit: 'd20+5', damage: 'd4+3' },
    { name: '', hit: '', damage: '' },
    { name: '', hit: '', damage: '' },
  ],
};
let dmGotSheet = false;
dm.once('sheet:update', () => {
  dmGotSheet = true;
});
const sheetEchoPromise = eventOnce(player, 'sheet:update');
player.emit('sheet:update', testSheet);
const sheetEcho = await sheetEchoPromise;
check(sheetEcho.sheet.name === 'Гоблин-игрок', 'лист сохраняется и возвращается владельцу');
check(sheetEcho.sheet.attacks?.[0]?.name === 'Кинжал', 'в листе три поля оружия');
await sleep(600);
check(!dmGotSheet, 'лист игрока невидим другим игрокам');

dm.emit('chat:send', 'Всем привет');
const textMsg = await waitMsg(player, (m) => m.kind === 'text' && m.text === 'Всем привет');
check(textMsg.author === 'Мастер', 'text message author');

const pongPromise = eventOnce(player, 'pong');
player.emit('ping');
await pongPromise;
check(true, 'сервер отвечает на heartbeat-ping');

const reconnected = eventOnce(player, 'connect');
player.disconnect();
player.connect();
await reconnected;
await joinAndAck(player, (cb) =>
  player.emit('room:join', { code: created.room.code, name: 'Игрок', clientId: 'smoke-p1' }, cb)
);
player.emit('dice:roll', { expression: 'd20' });
await waitMsg(dm, (m) => m.kind === 'roll' && m.roll.expression === 'd20');
check(true, 'броски работают после переподключения и возврата в комнату');

const listRes = await ack((cb) => dm.emit('admin:list', { adminToken: '' }, cb));
check(
  listRes.rooms.some((r) => r.code === created.room.code && typeof r.name === 'string' && r.name.length > 0),
  'admin:list показывает комнаты с названиями'
);

const renamedEvent = eventOnce(player, 'room:renamed');
const renameRes = await ack((cb) =>
  dm.emit('admin:rename', { adminToken: '', code: created.room.code, name: 'Переименованная' }, cb)
);
check('ok' in renameRes, 'admin:rename переименовывает комнату');
const renamedPayload = await renamedEvent;
check(renamedPayload.name === 'Переименованная', 'игроки получают room:renamed');
const listNamed = await ack((cb) => dm.emit('admin:list', { adminToken: '' }, cb));
check(
  listNamed.rooms.some((r) => r.code === created.room.code && r.name === 'Переименованная'),
  'новое имя комнаты видно в списке'
);

const adminCreated = await joinAndAck(dm, (cb) =>
  dm.emit('admin:create', { adminToken: '', name: 'Ведущий-2', clientId: 'smoke-dm' }, cb)
);
check(adminCreated.room.code !== created.room.code, 'admin:create создаёт новую игру');
check(
  adminCreated.room.players.find((p) => p.id === 'smoke-dm')?.role === 'dm',
  'админ входит в новую игру как ведущий'
);

await sleep(1500);
const savedFile = path.resolve('server/data/rooms', `${created.room.code}.json`);
let persisted = null;
if (fs.existsSync(savedFile)) persisted = JSON.parse(fs.readFileSync(savedFile, 'utf8'));
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
  check(persisted.chat.length >= 2, 'chat persisted');
}

const delRoomCode = adminCreated.room.code;
const deletedEventPromise = eventOnce(dm, 'room:deleted');
await ack((cb) => dm.emit('admin:delete', { adminToken: '', code: delRoomCode }, cb));
await deletedEventPromise;
check(true, 'игроки получают room:deleted при удалении комнаты');
const listAfter = await ack((cb) => player.emit('admin:list', { adminToken: '' }, cb));
check(!listAfter.rooms.some((r) => r.code === delRoomCode), 'комната удалена из списка');
await sleep(500);
const delFile = path.resolve('server/data/rooms', `${delRoomCode}.json`);
check(!fs.existsSync(delFile), 'файл комнаты удалён с диска');

await ack((cb) => player.emit('admin:delete', { adminToken: '', code: created.room.code }, cb));
await sleep(500);
const room1File = path.resolve('server/data/rooms', `${created.room.code}.json`);
check(!fs.existsSync(room1File), 'тестовая комната удалена после теста (файл стёрт)');

dm.close();
player.close();
clearTimeout(watchdog);
console.log(ok ? 'SMOKE OK' : 'SMOKE FAILED');
process.exit(ok ? 0 : 1);
