import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitFor, addLibrary } from '../lib/smoke-helpers.mjs';

// На карте 1 активен игрок; создаём его персонажа.
S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);

const patientItem = await addLibrary(S, 'Пациент', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '+20',
  isPlayerToken: true,
});
await new Promise((resolve) => S.player.emit('player:setCharacter', { libraryItemId: patientItem }, resolve));
const addP = eventOnce(S.player, 'token:add');
S.player.emit('token:add', { mapId: S.map1.id, libraryItemId: patientItem, x: 100, y: 100 });
const patient = (await addP).token;

const withCondition = (id, predicate) =>
  new Promise((resolve) => {
    const h = (p) => {
      if (p.token.id === id && predicate(p.token)) {
        S.dm.off('token:update', h);
        resolve(p.token);
      }
    };
    S.dm.on('token:update', h);
  });

S.dm.emit('token:update', {
  mapId: S.map1.id,
  id: patient.id,
  patch: { conditions: [{ key: 'grappled', name: 'Схвачен', rounds: null }] },
});
const grabbed = await withCondition(patient.id, (t) => t.conditions.length > 0);
check(grabbed.conditions[0]?.key === 'grappled', 'состояние наложено и разослано');

const moveErrP = eventOnce(S.player, 'chat:error');
S.player.emit('token:move', { mapId: S.map1.id, id: patient.id, x: 900, y: 900 });
const moveErr = await moveErrP;
check(/двигаться/.test(moveErr), 'состояние блокирует движение игрока');

S.dm.emit('token:update', { mapId: S.map1.id, id: patient.id, patch: { conditions: [] } });
await withCondition(patient.id, (t) => t.conditions.length === 0);
check(true, 'состояние снято');

// Истечение длительности в начале хода (rounds: 1 → 0).
let combatState = null;
S.player.on('combat:update', (p) => {
  if (p.mapId === S.map1.id) combatState = p.combat;
});
S.dm.emit('combat:start', { mapId: S.map1.id });
await waitFor(() => combatState && combatState.active);
const patientEntry = combatState.entries.find((e) => e.tokenId === patient.id);
S.dm.emit('token:update', {
  mapId: S.map1.id,
  id: patient.id,
  patch: { conditions: [{ key: 'prone', name: 'Сбит с ног', rounds: 1 }] },
});
await withCondition(patient.id, (t) => t.conditions.length > 0);
const expiredP = withCondition(patient.id, (t) => t.conditions.length === 0);
S.dm.emit('combat:setTurn', { mapId: S.map1.id, id: patientEntry.id });
await expiredP;
check(true, 'состояние истекает в начале хода носителя');

S.dm.emit('combat:end', { mapId: S.map1.id });
await sleep(300);

const removed = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: patient.id });
await removed;
const libP = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', patientItem);
await libP;
