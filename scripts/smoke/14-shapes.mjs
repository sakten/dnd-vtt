import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { addLibrary, eventOnce, setCharacter, setSheet, spawnToken, waitFor } from '../lib/smoke-helpers.mjs';

// Формы (С5): витрина зверя через резолвер, отдельный пул HP, форма держится при пуле 0 (XPHB),
// возврат бонусным действием, синхронизация подошвы (отечественная 1×1 ↔ 2×2) без потери своих полей.
S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);
S.player.emit('combat:end', { mapId: S.map1.id });

const errors = [];
S.player.on('chat:error', (e) => errors.push(e));

const item = await addLibrary(S, 'Друид-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
});
const setChar = await setCharacter(S, item);
check('ok' in setChar, 'друид назначен текущим персонажем');
const token = (await spawnToken(S, { libraryItemId: item, x: 700, y: 500 })).token;

let latest = null;
S.player.on('token:update', (p) => {
  if (p.token?.id === token.id) latest = p.token;
});
let resources = null;
S.player.on('resources:update', (r) => {
  resources = r;
});

await setSheet(S, {
  name: 'Друид-Тест',
  abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 10 },
  proficiencyBonus: '3',
  saves: {},
  skills: {},
  attacks: [{ name: 'Скимитар', hit: 'd20+5', damage: '1d6+3', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 }],
  classes: [{ className: 'druid', level: 6 }],
  spells: [],
  wildShape: { known: ['XMM:Wolf', 'XMM:Giant Goat'] },
});
const wildUses = () => resources?.resources?.find((r) => r.key === 'druid:wildShape')?.current ?? -1;
await waitFor(() => wildUses() === 3);
// HP персонажа: без настроенных ресурсов урон уходил бы в поля токена и валил его.
if ((resources?.hp?.current ?? 0) <= 0) {
  S.player.emit('resources:update', { ...resources, hp: { ...resources.hp, current: resources.hp.max, temp: 0 } });
}
await waitFor(() => (resources?.hp?.current ?? 0) > 0);

// Принятие формы: витрина — волк, пул = уровень друида, атаки статблока на месте.
S.player.emit('token:shape', { mapId: S.map1.id, id: token.id, formKey: 'XMM:Wolf' });
await waitFor(() => latest?.shape?.key === 'XMM:Wolf');
check(latest.name === 'Wolf', `витрина формы: Wolf (${latest.name})`);
check(latest.shape.hp === 6 && latest.shape.maxHp === 6, `пул формы = уровень (${latest.shape.hp}/${latest.shape.maxHp})`);
check(latest.cells === 1, `подошва волка 1×1 (${latest.cells})`);
check(
  (latest.attacks?.length ?? 0) + (latest.statblock?.actions?.length ?? 0) > 0,
  'у формы есть атаки статблока'
);
check(wildUses() === 2, `использование облика списано (${wildUses()})`);

// Урон по пулу: форма держится (XPHB), урон сверх пула идёт в свои HP.
S.dm.emit('token:hp', { mapId: S.map1.id, id: token.id, delta: -6 });
await waitFor(() => latest?.shape?.hp === 0);
check(latest.shape.hp === 0 && latest.name === 'Wolf', `пул 0 не спадает форму (${latest.name})`);
// Возврат — бонусным действием (вне боя свободно).
S.player.emit('token:revert', { mapId: S.map1.id, id: token.id });
await waitFor(() => latest && !latest.shape);
check(latest.name === 'Друид-Тест', `после возврата витрина своя (${latest.name})`);
check(latest.attacks?.[0]?.name === 'Скимитар', 'своё оружие вернулось');

// Large-форма: подошва 2×2, пиксельный размер синхронен; способность RAM бьёт с броском.
S.player.emit('token:shape', { mapId: S.map1.id, id: token.id, formKey: 'XMM:Giant Goat' });
await waitFor(() => latest?.shape?.key === 'XMM:Giant Goat');
check(
  latest.cells === 2 && latest.w === 100 && latest.h === 100,
  `giant goat 2×2 (${latest.cells}, ${latest.w}×${latest.h})`
);
const dummyItem = await addLibrary(S, 'Манекен', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: false,
});
const dummy = (await spawnToken(S, { libraryItemId: dummyItem, x: 725, y: 525, by: 'dm' })).token;
const rolls = [];
S.player.on('chat:message', (m) => {
  if (m?.roll) rolls.push(m);
});
S.player.emit('action:use', {
  mapId: S.map1.id,
  tokenId: token.id,
  actionId: 'xmm:giant-goat:ram',
  targetIds: [dummy.id],
  slot: 'action',
});
await waitFor(() => rolls.length > 0);
check(errors.length === 0, `RAM без ошибок (${errors.map((e) => e.code).join(', ') || 'нет'})`);
S.dm.emit('token:hp', { mapId: S.map1.id, id: token.id, delta: -6 });
await waitFor(() => latest?.shape?.hp === 0);
check(latest.shape?.hp === 0 && latest.cells === 2, `пул 0 не сбрасывает Large-форму (${latest.cells})`);
S.player.emit('token:revert', { mapId: S.map1.id, id: token.id });
await waitFor(() => latest && !latest.shape);
check(
  latest.cells === 1 && latest.w === 50 && latest.h === 50,
  `возврат сбросил размер (${latest.cells}, ${latest.w}×${latest.h})`
);
check(errors.length === 0, `без ошибок (${errors.map((e) => e.code).join(', ') || 'нет'})`);

const removed = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: token.id });
await removed;
const removedDummy = eventOnce(S.player, 'token:remove');
S.dm.emit('token:remove', { mapId: S.map1.id, id: dummy.id });
await removedDummy;
S.dm.emit('library:remove', item);
S.dm.emit('library:remove', dummyItem);
await setSheet(S, {
  name: 'Гоблин-игрок',
  abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
  proficiencyBonus: '3',
  saves: {},
  skills: {},
  attacks: [],
  classes: [{ className: 'wizard', level: 5 }],
  spells: [{ key: 'XPHB:Fireball', className: 'wizard' }],
});
await waitFor(() => resources?.hitDice?.length);
// Смена класса друида обнуляет кости хитов в syncResources: возвращаем остаток,
// который ждёт 05-admin-persistence (в 09 потрачена одна, 13 восстановила до 2).
if (resources?.hitDice?.length) {
  S.player.emit('resources:update', {
    ...resources,
    hitDice: resources.hitDice.map((h, i) => (i === 0 ? { ...h, current: 2 } : h)),
  });
}
await sleep(200);
