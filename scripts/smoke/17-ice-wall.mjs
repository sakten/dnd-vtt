import { io } from 'socket.io-client';
import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import {
  eventOnce,
  waitFor,
  waitMsg,
  joinAndAck,
  addLibrary,
  setCharacter,
  setSheet,
  spawnToken,
  waitToken,
} from '../lib/smoke-helpers.mjs';

// У сценария свой игрок: лист/персонажа smoke-p1 не трогаем (его проверяет 05-persistence).
const p4 = io(S.URL);
await waitFor(() => p4.connected);
await joinAndAck(p4, (cb) =>
  p4.emit('room:join', { code: S.created.room.code, name: 'Игрок-17', clientId: 'smoke-p4' }, cb)
);

S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);
S.dm.emit('combat:end', { mapId: S.map1.id });

let zones = [];
p4.on('zones:update', ({ mapId, zones: list }) => {
  if (mapId === S.map1.id) zones = list;
});
const iceZone = () => zones.find((z) => z.sourceKey === 'XPHB:Wall of Ice');
const section0 = () => iceZone()?.sections?.[0];

let latestResources = null;
p4.on('resources:update', (r) => {
  latestResources = r;
});

const casterItem = await addLibrary(S, 'Ледяной-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
});
const setChar = await setCharacter(S, casterItem, p4);
check('ok' in setChar, 'кастер назначен текущим персонажем');
const caster = (await spawnToken(S, { libraryItemId: casterItem, x: 200, y: 200, by: 'dm', observe: 'dm' })).token;

await setSheet(
  S,
  {
    name: 'Ледяной',
    abilities: { str: 16, dex: 12, con: 16, int: 16, wis: 10, cha: 10 },
    proficiencyBonus: '4',
    saves: {},
    skills: {},
    attacks: [
      {
        id: 'hammer',
        name: 'Молот',
        hit: 'd20+10',
        damage: '2d6+10',
        damageType: 'bludgeoning',
        rangeType: 'melee',
        rangeNormal: 5,
        rangeLong: 0,
      },
    ],
    hands: { right: 'hammer' },
    classes: [{ className: 'wizard', level: 11 }],
    spells: [{ key: 'XPHB:Wall of Ice', className: 'wizard' }],
  },
  p4
);
await waitFor(() => latestResources?.spellSlots?.some((s) => s.level >= 6));

// Манекен, разрезанный стеной при появлении: должен быть вытолкнут и получить спас-урон.
const dummyItem = await addLibrary(S, 'Манекен-Стена', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  ac: '10',
  hpMax: '40',
  hpCurrent: 40,
  showStats: true,
});
const dummy = (await spawnToken(S, { libraryItemId: dummyItem, x: 350, y: 100, by: 'dm', observe: 'dm' })).token;
const pushedP = waitToken(S, dummy.id, (t) => t.y !== 100, S.dm);
const dummyHurtP = waitToken(S, dummy.id, (t) => t.hpCurrent < 40, S.dm);

// Каст цепочкой по узлам сетки: панель вправо (y=100) и полудиагональ 1×2 вниз-вправо.
const wallPath = [
  { x: 300, y: 100 },
  { x: 400, y: 100 },
  { x: 450, y: 200 },
];
p4.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: caster.id,
  spellKey: 'XPHB:Wall of Ice',
  slotLevel: 6,
  variant: 'wall',
  path: wallPath,
});
const pushed = await pushedP;
check(
  pushed.x === 375 && pushed.y === 175,
  `разрезанный манекен вытолкнут на свободную сторону (${pushed.x},${pushed.y})`
);
const dummyHurt = await dummyHurtP;
check(dummyHurt.hpCurrent < 40, `разрезанный манекен получил урон появления (${dummyHurt.hpCurrent}/40)`);
await waitFor(() => !!iceZone());
const ice = iceZone();
check(ice.wall?.ac === 12 && ice.wall?.hp === 30, `у секции КЗ ${ice.wall?.ac} и ${ice.wall?.hp} HP`);
check(
  ice.wall?.immunities?.includes('cold') && ice.wall?.vulnerabilities?.includes('fire'),
  `иммунитет холоду, уязвимость к огню (${ice.wall?.immunities?.join('/')} / ${ice.wall?.vulnerabilities?.join('/')})`
);
check(
  ice.wallPath?.length === 3 && ice.sections?.length === 2 && ice.sections.every((s) => s.hp === 30 && !s.broken),
  `цепочка из двух целых секций по 30 HP (узлов: ${ice.wallPath?.length}, секций: ${ice.sections?.length})`
);

// Кастер встаёт вплотную снизу к секции 0 (перенос позиции — подготовка сценария).
const movedP = waitToken(S, caster.id, (t) => t.x === 375 && t.y === 125, S.dm);
p4.emit('token:move', { mapId: S.map1.id, id: caster.id, x: 375, y: 125 });
await movedP;

// Бьём секцию 0, пока не пробьём: вне боя атаки не тратят действия.
const targetId = `zone:${ice.id}#0`;
let broken = false;
for (let attempt = 0; attempt < 6 && !broken; attempt++) {
  const hitMsgP = waitMsg(p4, (m) => m.kind === 'roll' && m.rollKind === 'attack');
  p4.emit('action:use', {
    mapId: S.map1.id,
    tokenId: caster.id,
    actionId: 'attack',
    attackIndex: 0,
    targetIds: [targetId],
  });
  const hitMsg = await hitMsgP;
  const subject = String(hitMsg.labelParams?.subject ?? '');
  if (attempt === 0) {
    check(hitMsg.roll.expression === 'd20+10', `бросок по секции — формула оружия (${hitMsg.roll.expression})`);
    check(
      subject.includes('Wall of Ice') && subject.includes('секция 1'),
      `метка атаки называет стену и секцию (${subject})`
    );
  }
  const before = section0()?.hp ?? 30;
  await waitFor(() => !!section0()?.broken || (section0()?.hp ?? 30) < before, 3000).catch(() => {});
  broken = !!section0()?.broken;
}
check(broken, `секция 0 пробита атаками (${JSON.stringify(section0())})`);

// По пробитой секции ударить нельзя — явная ошибка в чат.
const errP = eventOnce(p4, 'chat:error');
p4.emit('action:use', {
  mapId: S.map1.id,
  tokenId: caster.id,
  actionId: 'attack',
  attackIndex: 0,
  targetIds: [targetId],
});
const err = await errP;
check(err?.code === 'spellNoTarget', `атака по пробитой секции отклонена явно (${err?.code})`);

// Проход сквозь «лист холода»: спас CON, затем 5к6 холодом (половина при успехе).
const saveMsgP = waitMsg(p4, (m) => m.kind === 'roll' && m.rollKind === 'save');
const coldMsgP = waitMsg(
  p4,
  (m) => m.kind === 'roll' && m.rollKind === 'damage' && m.labelParams?.damageType === 'cold'
);
const hpBefore = latestResources?.hp?.current ?? 0;
p4.emit('token:step', { mapId: S.map1.id, id: caster.id, x: 375, y: 75 });
await saveMsgP;
const coldMsg = await coldMsgP;
await waitFor(() => (latestResources?.hp?.current ?? 0) !== hpBefore);
check(coldMsg.roll.expression === '5d6cold', `лист холода бросает 5к6 холодом (${coldMsg.roll.expression})`);
check(
  (latestResources?.hp?.current ?? 0) < hpBefore,
  `проход сквозь лист снял хиты (${hpBefore} → ${latestResources?.hp?.current})`
);

// Уборка: концентрация и зона, токен, предмет.
const goneP = waitFor(() => !iceZone());
p4.emit('spell:endConcentration', { mapId: S.map1.id, tokenId: caster.id });
await goneP;
check(true, 'концентрация стены прекращена, зона снята');
const removedP = eventOnce(S.dm, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: caster.id });
await removedP;
const libP = eventOnce(S.dm, 'library:update');
S.dm.emit('library:remove', casterItem);
await libP;
const dummyRemoved = eventOnce(S.dm, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: dummy.id });
await dummyRemoved;
const dummyLibP = eventOnce(S.dm, 'library:update');
S.dm.emit('library:remove', dummyItem);
await dummyLibP;
await sleep(200);
p4.close();
