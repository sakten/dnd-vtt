import { io } from 'socket.io-client';
import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';

const socket = io(S.URL);
await new Promise((r) => socket.once('connect', r));

socket.emit('library:add', null);
socket.emit('library:update', null);
socket.emit('token:add', null);
socket.emit('token:update', null);
socket.emit('token:lock', null);
socket.emit('token:remove', null);
socket.emit('map:add', null);
socket.emit('fog:update', { mapId: null, fog: null });
socket.emit('grid:update', { size: NaN, offsetX: 'x' });
socket.emit('combat:add', null);
socket.emit('dice:attack', null);
socket.emit('dice:roll', null);
socket.emit('chat:send', 12345);
socket.emit('room:create');
socket.emit('admin:list');
socket.emit('resources:update', null);
socket.emit('sheet:update', null);

await sleep(400);
const health = await fetch(`${S.URL}/api/health`).then((r) => r.json());
check(health?.ok === true, 'сервер переживает некорректные payload и отсутствие ack');
socket.close();
await sleep(200);
