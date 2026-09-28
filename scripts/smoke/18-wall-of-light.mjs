import { io } from 'socket.io-client';
import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitFor, waitMsg, joinAndAck, addLibrary, setCharacter, setSheet, spawnToken } from '../lib/smoke-helpers.mjs';

// У сценария свой игрок: лист/персонажа smoke-p1 не трогаем.
const p5 = io(S.URL);
await waitFor(() => p5.connected);
await joinAndAck(p5, (cb) =>
  p5.emit('room:join', { code: S.created.room.code, name: 'Игрок-18', clientId: 'smoke-p5' }, cb)
);

S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);
S.dm.emit('combat:end', { mapId: S.map1.id });

let zones = [];
p5.on('zones:update', ({ mapId, zones: list }) => {
  if (mapId === S.map1.id) zones = list;
});
const lightZone = () => zones.find((z) => z.sourceKey === 'XGE:Wall of Light');

let latestResources = null;
p5.on('resources:update', (r) => {
  latestResources = r;
});

const casterItem = await addLibrary(S, 'Свет-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
});
const setChar = await setCharacter(S, casterItem, p5);
check('ok' in setChar, 'кастер света назначен текущим персонажем');
const caster = (await spawnToken(S, { libraryItemId: casterItem, x: 200, y: 500, by: 'dm', observe: 'dm' })).token;

await setSheet(
  S,
  {
    name: 'Свет',
    abilities: { str: 10, dex: 14, con: 14, int: 18, wis: 10, cha: 10 },
    proficiencyBonus: '4',
    saves: {},
    skills: {},
    attacks: [],
    hands: {},
    classes: [{ className: 'wizard', level: 9 }],
    spells: [{ key: 'XGE:Wall of Light', className: 'wizard' }],
  },
  p5
);
await waitFor(() => latestResources?.spellSlots?.some((s) => s.level >= 5));

// Манекен в 20 фт от стены — цель для лучей (переживает все шесть).
const dummyItem = await addLibrary(S, 'Манекен-Свет', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  ac: '12',
  hpMax: '200',
  hpCurrent: 200,
  showStats: true,
});
const dummy = (await spawnToken(S, { libraryItemId: dummyItem, x: 200, y: 300, by: 'dm', observe: 'dm' })).token;

// Каст: горизонтальная полоса 60×5 от (200,500).
p5.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: caster.id,
  spellKey: 'XGE:Wall of Light',
  slotLevel: 5,
  variant: 'horizontal',
  origin: { x: 200, y: 500 },
  direction: { x: 300, y: 500 },
});
await waitFor(() => !!lightZone());
const light = lightZone();
check(light.area?.size === 60 && light.area?.width === 5, `полоса 60×5 (${light.area?.size}×${light.area?.width})`);
check(light.light?.bright === 120 && light.light?.dim === 120, `свет 120/120 (${light.light?.bright}/${light.light?.dim})`);
check(light.flags?.blocksLineOfSight === true, 'стена блокирует обзор');
check(light.flags?.obscured === undefined, 'стена не мгла (светящаяся, а не тёмная)');
check(
  light.actions?.some((a) => a.id === 'beam' && a.shrinkFeet === 10),
  'действие «Луч» с сокращением на 10 фт'
);
check(!light.sections && !light.wall, 'световая стена — клеточная зона без секций');

// Шаг кастера не в стену: концентрация и зона держатся.
p5.emit('token:step', { mapId: S.map1.id, id: caster.id, x: 250, y: 400 });
await sleep(400);
check(!!lightZone(), 'шаг кастера не сбрасывает концентрацию');

// Луч: заклинательная атака; попадание/промах — стена короче на 10 фт.
const hitP = waitMsg(p5, (m) => m.kind === 'roll' && m.rollKind === 'attack');
p5.emit('action:use', {
  mapId: S.map1.id,
  tokenId: caster.id,
  actionId: `zone:${light.id}:beam`,
  targetIds: [dummy.id],
});
const hitMsg = await hitP;
// Кастер стоит в упор к манекену — заклинательная атака дальней дистанции с помехой.
check(
  hitMsg.roll.expression === 'd20d+8' &&
    hitMsg.labelParams?.sources?.some((s) => s.kind === 'range' && s.key === 'adjacent'),
  `луч — заклинательная атака в упор с помехой (${hitMsg.roll.expression})`
);
await waitFor(() => lightZone()?.area?.size === 50);
check(lightZone()?.area?.size === 50, 'после луча стена 50 фт');

// Луч без подходящей цели — явная ошибка.
const errP = eventOnce(p5, 'chat:error');
p5.emit('action:use', {
  mapId: S.map1.id,
  tokenId: caster.id,
  actionId: `zone:${light.id}:beam`,
  targetIds: [caster.id],
});
const err = await errP;
check(err?.code === 'spellNoTarget', `луч без цели отклонён явно (${err?.code})`);

// Пять остальных лучей: длина 0 — заклинание оканчивается.
for (let i = 0; i < 5 && lightZone(); i++) {
  const shotP = waitMsg(p5, (m) => m.kind === 'roll' && m.rollKind === 'attack');
  p5.emit('action:use', {
    mapId: S.map1.id,
    tokenId: caster.id,
    actionId: `zone:${light.id}:beam`,
    targetIds: [dummy.id],
  });
  await shotP;
}
await waitFor(() => !lightZone());
check(true, 'шесть лучей — стена растаяла (длина 0)');

// Уборка: зона/концентрация, токены, предметы.
p5.emit('spell:endConcentration', { mapId: S.map1.id, tokenId: caster.id });
const casterRemoved = eventOnce(S.dm, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: caster.id });
await casterRemoved;
const dummyRemoved = eventOnce(S.dm, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: dummy.id });
await dummyRemoved;
const libP = eventOnce(S.dm, 'library:update');
S.dm.emit('library:remove', casterItem);
await libP;
const libP2 = eventOnce(S.dm, 'library:update');
S.dm.emit('library:remove', dummyItem);
await libP2;
await sleep(200);
p5.close();
