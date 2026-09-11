import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { attachErrorLog, findButton } from '../lib/e2e-helpers.mjs';
import path from 'node:path';

S.code = await S.page.evaluate(() => window.__vtt.getState().roomCode);

const ctx2 = await S.browser.createBrowserContext();
S.page2 = await ctx2.newPage();
await S.page2.setViewport({ width: 1440, height: 900 });
await attachErrorLog(S.page2, 'Игрок');
await S.page2.goto(`${S.BASE}?room=${S.code}`, { waitUntil: 'networkidle0' });
await S.page2.waitForSelector('.join-card');
const p2Inputs = await S.page2.$$('.join-card input');
const prefilled = await p2Inputs[1].evaluate((el) => el.value);
check(prefilled === S.code, `инвайт-ссылка предзаполнила код комнаты (${prefilled})`);
await p2Inputs[0].type('Игрок');
const joinBtn = await findButton(S.page2, '.join-actions button.primary', 'Войти');
await joinBtn.click();
await S.page2.waitForSelector('.table-screen');
await S.page2.waitForSelector('canvas');
await sleep(1500);

const p2Initial = await S.page2.evaluate(() => {
  const s = window.__vtt.getState();
  return { view: s.viewMapId, defaultId: s.scene.activeMapId };
});
check(p2Initial.view === p2Initial.defaultId, 'новичок попадает на карту по умолчанию');
const p2MapItems = await S.page2.$$('.map-item');
const map1Id = await S.page.evaluate(() => window.__vtt.getState().scene.maps[0].id);
await S.page.click('.map-item .map-bring');
await sleep(900);
const p2Brought = await S.page2.evaluate(() => window.__vtt.getState().viewMapId);
check(p2Brought === map1Id, 'кнопка «Все» переносит игроков на карту');
await p2MapItems[1].click();
await sleep(800);
const p2Local = await S.page2.evaluate(() => window.__vtt.getState().viewMapId);
const dmView = await S.page.evaluate(() => window.__vtt.getState().viewMapId);
check(
  p2Local === S.maps2.second && dmView === map1Id,
  'личное переключение игрока не меняет карту у ведущего'
);
await S.page.click('.map-item .map-bring');
await sleep(900);
await S.page2.screenshot({ path: path.join(S.OUT, '12-player.png') });

const msgCount = await S.page2.$$eval('.chat-msg', (els) => els.length);
check(msgCount >= 2, `игрок видит историю чата (${msgCount} сообщений)`);
const tokenCount = await S.page2.$$eval('.token-panel-item', (els) => els.length);
check(tokenCount === 2, 'библиотека токенов общая: игрок видит токены из библиотеки DM');
const playerChips = await S.page2.$$eval('.player-chip', (els) => els.map((el) => el.textContent));
check(playerChips.some((t) => t.includes('Игрок')) && playerChips.some((t) => t.includes('DM')), 'список игроков виден');
const p2Maps = await S.page2.$$eval('.map-item', (els) => els.length);
check(p2Maps === 2, 'игрок видит список карт');
const p2Sheet = await S.page2.evaluate(() => window.__vtt.getState().sheet);
check(p2Sheet === null, 'лист персонажа не виден другим игрокам');

const fogBtn = await findButton(S.page, '.toolbar button', 'Туман');
await fogBtn.click();
await S.page.waitForSelector('.fog-panel');
await (await findButton(S.page, '.fog-panel button', 'Прямоугольник')).click();
await sleep(200);
await S.page.mouse.move(300, 150);
await S.page.mouse.down();
await S.page.mouse.move(620, 400, { steps: 8 });
await S.page.mouse.up();
await sleep(1200);
const dmFog = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return m ? m.fog.hidden.length : -1;
});
check(dmFog > 20, `прямоугольник тумана нарисован (${dmFog} клеток скрыто)`);
const playerFogCount = await S.page2.evaluate(() => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return m ? m.fog.hidden.length : -1;
});
check(playerFogCount === dmFog, 'туман синхронизировался с игроком');
const fogPx = await S.page2.evaluate(() => {
  const s = window.__vtt.getState();
  const sx = 225 * s.view.scale + s.view.x;
  const sy = 225 * s.view.scale + s.view.y;
  const canvas = document.querySelectorAll('canvas')[1];
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(Math.round(sx), Math.round(sy), 1, 1).data;
  return { r: d[0], a: d[3] };
});
check(fogPx.a > 200 && fogPx.r < 40, `игрок видит туман (r=${fogPx.r}, a=${fogPx.a})`);

const tokPos = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  return t ? { wx: t.x, wy: t.y, sx: t.x * s.view.scale + s.view.x, sy: t.y * s.view.scale + s.view.y } : null;
});
const tokPxBefore = await S.page2.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  const sx = t.x * s.view.scale + s.view.x;
  const sy = t.y * s.view.scale + s.view.y;
  const canvas = document.querySelectorAll('canvas')[3];
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(Math.round(sx), Math.round(sy), 1, 1).data;
  return { r: d[0], a: d[3] };
});
check(tokPxBefore.r > 150, 'до тумана токен виден игроку');
await (await findButton(S.page, '.fog-panel button', 'Кисть')).click();
await sleep(200);
const sizeButtons = await S.page.$$('.fog-panel .fog-group');
await sizeButtons[2].$eval('button', (el) => el.click());
await sleep(200);
await S.page.mouse.move(tokPos.sx, tokPos.sy);
await S.page.mouse.down();
await S.page.mouse.up();
await sleep(1200);
const tokPxAfter = await S.page2.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  const sx = t.x * s.view.scale + s.view.x;
  const sy = t.y * s.view.scale + s.view.y;
  const canvas = document.querySelectorAll('canvas')[3];
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(Math.round(sx), Math.round(sy), 1, 1).data;
  return { r: d[0], a: d[3] };
});
check(tokPxAfter.a === 0, 'токен в тумане скрыт от игрока');
await S.page2.screenshot({ path: path.join(S.OUT, '13-fog.png') });
await (await findButton(S.page, '.fog-panel button', 'Готово')).click();
await sleep(300);

const combatBtn = await findButton(S.page, '.toolbar button', 'Бой');
check(!!combatBtn, 'у ведущего есть кнопка боя');
await combatBtn.click();
await S.page.waitForSelector('.initiative-bar');
await S.page2.waitForSelector('.initiative-bar');
const chipCount = await S.page.$$eval('.initiative-bar .initiative-chip', (els) => els.length);
check(chipCount >= 1, `полоса инициативы появилась (${chipCount} чипов)`);
check((await S.page2.$('.initiative-bar')) !== null, 'игрок видит полосу инициативы');

const firstChip = await S.page.$('.initiative-bar .initiative-chip');
await firstChip.hover();
await sleep(250);
const hoverOk = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const combat = s.scene.maps.find((m) => m.id === s.viewMapId)?.combat;
  return s.hoverTokenId !== null && !!combat && combat.entries.some((e) => e.tokenId === s.hoverTokenId);
});
check(hoverOk, 'наведение на чип подсвечивает токен');

const endCombatBtn = await findButton(S.page, '.toolbar button', 'Конец боя');
await endCombatBtn.click();
await sleep(400);
check((await S.page.$('.initiative-bar')) === null, 'после конца боя полоса исчезла у ведущего');
check((await S.page2.$('.initiative-bar')) === null, 'после конца боя полоса исчезла у игрока');

S.ctx3 = await S.browser.createBrowserContext();
S.page3 = await S.ctx3.newPage();
await S.page3.setViewport({ width: 1200, height: 800 });
await S.page3.goto(`${S.BASE}?admin=1`, { waitUntil: 'networkidle0' });
await S.page3.waitForSelector('.admin-card');
await sleep(800);
const adminRooms = await S.page3.$$eval('.admin-room', (els) => els.length);
check(adminRooms >= 1, `страница ведущего показывает список комнат (${adminRooms})`);
