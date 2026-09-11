import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitFor, addLibrary } from '../lib/smoke-helpers.mjs';

await waitFor(() => S.lastMaps && S.lastMaps.maps.length === 2);
const map2 = S.lastMaps.maps[1];
check(S.lastMaps.activeMapId === map2.id, 'вторая карта стала активной по умолчанию для новичков');

S.player.emit('map:bring', S.map1.id);
await sleep(600);
check(S.lastBring === null, 'игрок не может переносить всех на карту');

S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);

const thirdItem = await addLibrary(S, 'Третий', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '+5',
});
S.dm.emit('token:add', { mapId: S.map1.id, libraryItemId: thirdItem, x: 50, y: 50 });
const thirdAdd = await eventOnce(S.player, 'token:add');
check(thirdAdd.token.name === 'Третий', 'токен добавляется на указанную карту');
check(thirdAdd.token.initiativeBonus === '+5', 'бонус инициативы наследуется из библиотеки');

let combatState = null;
S.player.on('combat:update', (p) => {
  if (p.mapId === S.map1.id) combatState = p.combat;
});
S.dm.emit('combat:start', { mapId: S.map1.id });
await waitFor(() => combatState && combatState.active);
check(combatState.entries.length === 3, `бой начался, все токены карты в очереди (${combatState.entries.length})`);
check(
  combatState.entries.every((e, i, a) => i === 0 || a[i - 1].initiative >= e.initiative),
  'очередь отсортирована по инициативе'
);
check(
  combatState.entries.every((e) => e.initiative >= 1 && e.initiative <= 25),
  'инициатива = d20 + бонус'
);
check(
  combatState.entries.find((e) => e.name === 'Третий')?.bonus === '+5',
  'бонус инициативы токена учтён в бою'
);

const fifthItem = await addLibrary(S, 'Пятый', {
  imageUrl: '/y.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
});
S.dm.emit('token:add', { mapId: S.map1.id, libraryItemId: fifthItem, x: 70, y: 70 });
await eventOnce(S.player, 'token:add');
await waitFor(() => combatState.entries.length === 4);
check(combatState.entries.length === 4, 'токен, добавленный в бою, попал в очередь');
const addedEntry = combatState.entries.find((e) => e.name === 'Пятый');
check(!!addedEntry, 'запись нового токена есть в очереди');

S.dm.emit('token:remove', { mapId: S.map1.id, id: addedEntry.tokenId });
await eventOnce(S.player, 'token:remove');
await waitFor(() => combatState.entries.length === 3);
check(combatState.entries.length === 3, 'удалённый токен выбыл из очереди');

const combatCountBefore = combatState.entries.length;
S.player.emit('combat:remove', { mapId: S.map1.id, id: combatState.entries[0].id });
await sleep(400);
check(combatState.entries.length === combatCountBefore, 'игрок не управляет очередью инициативы');

S.dm.emit('combat:end', { mapId: S.map1.id });
await waitFor(() => combatState && !combatState.active);
check(!combatState.active && combatState.entries.length === 0, 'бой закончен, очередь очищена');

let combat2 = null;
S.player.on('combat:update', (p) => {
  if (p.mapId === map2.id) combat2 = p.combat;
});
S.dm.emit('combat:start', { mapId: map2.id });
await waitFor(() => combat2 && combat2.active);
check(combat2.active && combat2.entries.length === 0, 'бой у второй карты свой (пока без токенов)');
check(!combatState.active, 'бой первой карты не затронут');
S.dm.emit('combat:end', { mapId: map2.id });
await sleep(400);

S.player.emit('grid:update', { ...S.joined.room.scene.grid, size: 100 });
await sleep(800);
check(S.gridUpdates === 0, 'игрок не может менять сетку');
