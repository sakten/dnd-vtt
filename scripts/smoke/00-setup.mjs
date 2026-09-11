import { io } from 'socket.io-client';

import { S } from './state.mjs';
import { check, sleep, VERBOSE } from '../lib/check.mjs';
import { eventOnce, joinAndAck, waitFor } from '../lib/smoke-helpers.mjs';

S.watchdog = setTimeout(() => {
  console.log('SMOKE TIMEOUT');
  process.exit(1);
}, 120000);
S.watchdog.unref();

S.URL = process.env.VTT_URL ?? 'http://localhost:3001';

S.dm = io(S.URL);
S.player = io(S.URL);
await Promise.all([eventOnce(S.dm, 'connect'), eventOnce(S.player, 'connect')]);

S.created = await joinAndAck(S.dm, (cb) =>
  S.dm.emit('room:create', { name: 'Мастер', clientId: 'smoke-dm' }, cb)
);
if (VERBOSE) console.log('room created:', S.created.room.code);

check(S.created.room.code.length >= 10, `код комнаты длинный и случайный (${S.created.room.code.length} символов)`);
check(
  typeof S.created.room.name === 'string' && S.created.room.name.length > 0,
  `у комнаты есть название (${S.created.room.name})`
);

S.joined = await joinAndAck(S.player, (cb) =>
  S.player.emit('room:join', { code: S.created.room.code, name: 'Игрок', clientId: 'smoke-p1' }, cb)
);
if (VERBOSE) console.log('player joined as:', S.joined.room.players.find((p) => p.id === 'smoke-p1').role);

check(Array.isArray(S.joined.room.scene.maps) && S.joined.room.scene.maps.length === 0, 'новая комната без карт');
check(Array.isArray(S.joined.room.library) && S.joined.room.library.length === 0, 'библиотека токенов пустая в новой комнате');

S.lastMaps = null;
S.player.on('maps:update', (p) => {
  S.lastMaps = p;
});
S.lastLibrary = null;
S.player.on('library:update', (l) => {
  S.lastLibrary = l;
});
S.lastBring = null;
S.player.on('map:bring', (p) => {
  S.lastBring = p;
});
S.gridUpdates = 0;
S.dm.on('grid:update', () => {
  S.gridUpdates++;
});



S.dm.emit('map:add', { name: 'Подземелье', url: '/uploads/m.png', width: 800, height: 600 });
await waitFor(() => S.lastMaps && S.lastMaps.maps.length === 1);
check(S.lastMaps.activeMapId === S.lastMaps.maps[0].id, 'карта добавлена и стала активной');
S.map1 = S.lastMaps.maps[0];

S.player.emit('map:add', { name: 'Hack', url: '/x.png', width: 10, height: 10 });
await sleep(600);
check(S.lastMaps.maps.length === 1, 'игрок не может добавлять карты');
