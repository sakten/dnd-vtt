import { io } from 'socket.io-client';
import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { waitFor, joinAndAck, addLibrary, setCharacter, setSheet, spawnToken, waitToken } from '../lib/smoke-helpers.mjs';

// Свой игрок на сценарий: не трогаем лист/персонажа smoke-p1 (его проверяет 05-persistence).
const p2 = io(S.URL);
await waitFor(() => p2.connected);
await joinAndAck(p2, (cb) =>
  p2.emit('room:join', { code: S.created.room.code, name: 'Игрок-15', clientId: 'smoke-p2' }, cb)
);

S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);
const prevGrid = S.map1.grid;
// Сетка карты: размер в пикселях нужен для дистанций и размеров токенов (w/h).
S.dm.emit('grid:update', { mapId: S.map1.id, grid: { ...(prevGrid ?? S.joined.room.scene.grid), size: 50 } });
await sleep(200);

const heroItem = await addLibrary(S, 'Воин-Мастерств', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
});
await setCharacter(S, heroItem, p2);
const hero = (await spawnToken(S, { libraryItemId: heroItem, x: 200, y: 200, by: 'dm', observe: 'dm' })).token;
await setSheet(
  S,
  {
    name: 'Воин-Мастерств',
    abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
    proficiencyBonus: '2',
    saves: {},
    skills: {},
    attacks: [
      {
        name: 'Двуручник',
        hit: 'd20+5',
        damage: '2d6+3',
        rangeType: 'melee',
        rangeNormal: 5,
        rangeLong: 0,
        damageType: 'slashing',
        weaponKey: 'XPHB:Greatsword',
      },
      {
        name: 'Секира',
        hit: 'd20+5',
        damage: '1d12+3',
        rangeType: 'melee',
        rangeNormal: 5,
        rangeLong: 0,
        damageType: 'slashing',
        weaponKey: 'XPHB:Greataxe',
      },
    ],
    classes: [{ className: 'fighter', level: 1 }],
    spells: [],
  },
  p2
);

const dummyFields = {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  hpMax: '30',
  showStats: true,
};

// Graze: по AC 30 атака почти всегда промахивается — урон равен модификатору Силы (3).
// Натуральная 20 — крит (урон другой), поэтому манекен пересоздаём и пробуем снова.
const highItem = await addLibrary(S, 'Манекен-Броня', { ...dummyFields, ac: '30' });
let grazeOk = false;
let grazeHp = null;
const grazeTokens = [];
for (let attempt = 0; attempt < 6 && !grazeOk; attempt++) {
  const armored = (await spawnToken(S, { libraryItemId: highItem, x: 250, y: 200, by: 'dm', observe: 'dm' })).token;
  grazeTokens.push(armored.id);
  const grazeP = waitToken(S, armored.id, (t) => t.hpCurrent < 30, p2).catch(() => null);
  p2.emit('action:use', {
    mapId: S.map1.id,
    tokenId: hero.id,
    actionId: 'attack',
    attackIndex: 0,
    targetIds: [armored.id],
    slot: 'action',
  });
  const damaged = await Promise.race([grazeP, sleep(1500).then(() => null)]);
  grazeHp = damaged ? damaged.hpCurrent : null;
  if (grazeHp === 27) grazeOk = true;
}
check(grazeOk, `Graze: промах нанёс ровно модификатор (hp=${grazeHp})`);

// Cleave: попадание по низкому AC помечает вторую цель; она должна быть в 5 фт.
const softItem = await addLibrary(S, 'Манекен-Мягкий', { ...dummyFields, ac: '5' });
const low1 = (await spawnToken(S, { libraryItemId: softItem, x: 250, y: 200, by: 'dm', observe: 'dm' })).token;
const low2 = (await spawnToken(S, { libraryItemId: softItem, x: 250, y: 250, by: 'dm', observe: 'dm' })).token;

let combat = null;
p2.on('combat:update', (p) => {
  if (p.mapId === S.map1.id) combat = p.combat;
});
S.dm.emit('combat:start', { mapId: S.map1.id });
await waitFor(() => combat && combat.active);
const entry = combat.entries.find((e) => e.tokenId === hero.id);
S.dm.emit('combat:setTurn', { mapId: S.map1.id, id: entry.id });
await waitFor(() => combat.entries[combat.currentIndex]?.tokenId === hero.id);

let cleaved = false;
for (let attempt = 0; attempt < 5 && !cleaved; attempt++) {
  p2.emit('action:use', {
    mapId: S.map1.id,
    tokenId: hero.id,
    actionId: 'attack',
    attackIndex: 1,
    targetIds: [low1.id],
    slot: 'action',
  });
  await sleep(500);
  const cleaveP = waitToken(S, low2.id, (t) => t.hpCurrent < 30, p2).catch(() => null);
  p2.emit('action:use', {
    mapId: S.map1.id,
    tokenId: hero.id,
    actionId: 'attack',
    attackIndex: 1,
    cleave: true,
    targetIds: [low2.id],
    slot: 'action',
  });
  const damaged = await Promise.race([cleaveP, sleep(1500).then(() => null)]);
  if (damaged) {
    cleaved = true;
    break;
  }
  // Промах/натуральная 1 — новый ход и ещё попытка.
  S.dm.emit('combat:setTurn', { mapId: S.map1.id, id: entry.id });
  await sleep(300);
}
check(cleaved, 'Cleave: вторая цель в 5 фт получила урон без модификатора');

// Уборка: состояние комнаты должно остаться таким, каким его ждут 05/06.
S.dm.emit('combat:end', { mapId: S.map1.id });
await sleep(200);
for (const id of [hero.id, low1.id, low2.id]) {
  S.dm.emit('token:remove', { mapId: S.map1.id, id });
}
for (const id of grazeTokens) {
  S.dm.emit('token:remove', { mapId: S.map1.id, id });
}
for (const id of [heroItem, highItem, softItem]) {
  S.dm.emit('library:remove', id);
}
if (prevGrid) {
  S.dm.emit('grid:update', { mapId: S.map1.id, grid: prevGrid });
}
await sleep(400);
p2.close();
