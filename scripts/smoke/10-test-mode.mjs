import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitFor } from '../lib/smoke-helpers.mjs';

// Карта 1 активна у всех после предыдущих сценариев.
S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);

// Реальный ведущий включает режим тестов.
const enabledP = eventOnce(S.player, 'room:settings');
S.dm.emit('room:settings', { testMode: true });
const enabled = await enabledP;
check(enabled.testMode === true, 'режим тестов включён и разослан игрокам');

// Игрок получил права ведущего: DM-only событие grid:update срабатывает.
const gridP = eventOnce(S.dm, 'grid:update');
S.player.emit('grid:update', { mapId: S.map1.id, grid: { ...S.joined.room.scene.grid } });
const grid = await gridP;
check(
  !!grid && grid.grid.size === S.joined.room.scene.grid.size && grid.mapId === S.map1.id,
  'в режиме тестов игрок меняет сетку (права DM)'
);

// Сам переключатель режима игроку недоступен.
const received = [];
const onChange = (p) => received.push(p);
S.player.on('room:settings', onChange);
S.player.emit('room:settings', { testMode: false });
await sleep(300);
S.player.off('room:settings', onChange);
check(received.length === 0, 'игрок не может выключить режим тестов');

// Ведущий выключает режим — права игрока откатываются.
const disabledP = eventOnce(S.player, 'room:settings');
S.dm.emit('room:settings', { testMode: false });
const disabled = await disabledP;
check(disabled.testMode === false, 'режим тестов выключен');

let dmGot = false;
const onGrid = () => {
  dmGot = true;
};
S.dm.on('grid:update', onGrid);
S.player.emit('grid:update', { mapId: S.map1.id, grid: { ...S.joined.room.scene.grid, size: 100 } });
await sleep(300);
S.dm.off('grid:update', onGrid);
check(!dmGot, 'без режима тестов игрок снова не может менять сетку');
