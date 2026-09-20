import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { addLibrary, eventOnce, setCharacter, setSheet, spawnToken, waitFor } from '../lib/smoke-helpers.mjs';

// Призывы: спавн Summon Fey, скейл круга, фракция, гейт Pact of the Chain,
// сброс концентрации снимает призыв, но не фамильяра.
S.dm.emit('map:bring', S.map1.id);
await waitFor(() => S.lastBring && S.lastBring.activeMapId === S.map1.id);
S.player.emit('combat:end', { mapId: S.map1.id });

const errors = [];
S.player.on('chat:error', (e) => errors.push(e));
const summons = [];
S.player.on('token:add', (p) => {
  if (p.mapId === S.map1.id && p.token.summon) summons.push(p.token);
});
const removed = [];
S.player.on('token:remove', (p) => removed.push(p.id));

const casterItem = await addLibrary(S, 'Суммонер-Тест', {
  imageUrl: '/x.png',
  cells: 1,
  round: false,
  description: '',
  initiativeBonus: '',
  isPlayerToken: true,
});
const setChar = await setCharacter(S, casterItem);
check('ok' in setChar, 'суммонер назначен текущим персонажем');
const caster = (await spawnToken(S, { libraryItemId: casterItem, x: 300, y: 300 })).token;

let latestResources = null;
S.player.on('resources:update', (r) => {
  latestResources = r;
});
// 05-persistence ждёт кость хитов, потраченную в 09 — вернём её после смены листа.
const preHitDie = latestResources?.hitDice?.[0]?.current ?? 2;
await setSheet(S, {
  name: 'Суммонер',
  abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 16, cha: 18 },
  proficiencyBonus: '3',
  saves: {},
  skills: {},
  attacks: [],
  classes: [{ className: 'warlock', level: 5 }],
  spells: [
    { key: 'XPHB:Summon Fey', className: 'warlock' },
    { key: 'XPHB:Find Familiar', className: 'warlock' },
  ],
});
await waitFor(
  () =>
    latestResources &&
    (latestResources.spellSlots?.some((s) => s.level >= 3) || (latestResources.pact?.max ?? 0) > 0)
);

// Summon Fey: токен со скейлом круга, владельцем-контролёром и фракцией кастера.
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: caster.id,
  spellKey: 'XPHB:Summon Fey',
  slotLevel: 3,
  origin: { x: caster.x + 150, y: caster.y },
});
await waitFor(() => summons.length === 1);
const fey = summons[0];
check(fey.name === 'Fey Spirit', `призван Fey Spirit (${fey.name})`);
check(fey.hpMax === '30', `HP по кругу ячейки: ${fey.hpMax}`);
check(fey.summon?.casterTokenId === caster.id, 'призыв привязан к кастеру');
check(fey.faction === 'ally', `фракция призыва — ally (${fey.faction})`);

// Особая форма без Pact of the Chain: ошибка до траты ячейки, токена нет.
errors.length = 0;
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: caster.id,
  spellKey: 'XPHB:Find Familiar',
  slotLevel: 3,
  origin: { x: caster.x + 50, y: caster.y },
  summonKey: 'XMM:Imp',
});
await waitFor(() => errors.length > 0);
check(errors[0]?.code === 'summonNoPact', `Imp без пакта отклонён (${errors[0]?.code})`);
check(summons.length === 1, 'токен особой формы не создан');

// Обычная форма (сова) — можно и без инвокации.
S.player.emit('spell:cast', {
  mapId: S.map1.id,
  tokenId: caster.id,
  spellKey: 'XPHB:Find Familiar',
  slotLevel: 3,
  origin: { x: caster.x + 50, y: caster.y },
  summonKey: 'XMM:Owl',
});
await waitFor(() => summons.length === 2);
const owl = summons[1];
check(owl.name === 'Owl' && owl.summon?.pact !== true, 'сова призвана без pact');

// Сброс концентрации: Summon Fey исчезает, фамильяр остаётся.
S.player.emit('spell:endConcentration', { mapId: S.map1.id, tokenId: caster.id });
await waitFor(() => removed.includes(fey.id));
check(!removed.includes(owl.id), 'сброс концентрации не снял фамильяра');

// Уборка (Fey уже снят концентрацией).
for (const id of [owl.id, caster.id]) {
  const p = eventOnce(S.player, 'token:remove');
  S.dm.emit('token:remove', { mapId: S.map1.id, id });
  await p;
}
const libP = eventOnce(S.player, 'library:update');
S.dm.emit('library:remove', casterItem);
await libP;

// Возвращаем лист игрока и ресурсы к состоянию, которое проверяет 05-persistence.
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
await waitFor(() => latestResources?.spellSlots?.some((s) => s.level === 1) && latestResources?.hitDice?.length);
if (latestResources) {
  S.player.emit('resources:update', {
    ...latestResources,
    hitDice: latestResources.hitDice.map((h, i) => (i === 0 ? { ...h, current: preHitDie } : h)),
  });
}
await sleep(200);
