import { S } from './state.mjs';
import { check } from '../lib/check.mjs';
import { attachErrorLog, findButton, nextFrame, waitFor } from '../lib/e2e-helpers.mjs';
import path from 'node:path';

S.code = await S.page.evaluate(() => window.__vtt.getState().roomCode);

const ctx2 = await S.browser.createBrowserContext();
S.page2 = await ctx2.newPage();
await S.page2.setViewport({ width: 1440, height: 900 });
await attachErrorLog(S.page2, 'Игрок');
await S.page2.goto(`${S.BASE}?room=${S.code}`, { waitUntil: 'networkidle0' });
await S.page2.waitForSelector('[data-testid="join-card"]');
const p2Inputs = await S.page2.$$('[data-testid="join-card"] input');
const prefilled = await p2Inputs[1].evaluate((el) => el.value);
check(prefilled === S.code, `инвайт-ссылка предзаполнила код комнаты (${prefilled})`);
await p2Inputs[0].type('Игрок');
const joinBtn = await findButton(S.page2, '[data-testid="join-actions"] button.primary', 'Войти');
await joinBtn.click();
await S.page2.waitForSelector('[data-testid="table-screen"]');
await S.page2.waitForSelector('canvas');
await waitFor(S.page2, () => !!(window.__vtt && window.__vtt.getState().viewMapId));

// Верхнее меню игрока: «Сетки» нет, вместо неё «Кости» с ползунком шанса анимации.
const playerToolbar = await S.page2.$eval('[data-testid="toolbar"]', (el) => el.textContent ?? '');
check(
  !playerToolbar.includes('Сетка') && playerToolbar.includes('Кости'),
  `у игрока нет «Сетки», есть «Кости» (${playerToolbar.trim()})`
);
await S.page2.click('[data-testid="dice-menu-btn"]');
await S.page2.waitForSelector('[data-testid="dice-menu"]');
const setChance = (value) =>
  S.page2.$eval(
    '[data-testid="roll-anim-chance"]',
    (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    value
  );
const chanceState = () =>
  S.page2.evaluate(() => {
    const s = window.__vtt.getState();
    return s.players.find((p) => p.id === s.selfId)?.rollAnimChance;
  });
await setChance(100);
await waitFor(S.page2, () => {
  const s = window.__vtt.getState();
  return s.players.find((p) => p.id === s.selfId)?.rollAnimChance === 100;
}, 5000);
check((await chanceState()) === 100, 'ползунок выставляет шанс анимации 100%');
await setChance(0);
await waitFor(S.page2, () => {
  const s = window.__vtt.getState();
  return s.players.find((p) => p.id === s.selfId)?.rollAnimChance === 0;
}, 5000);
await S.page2.click('[data-testid="dice-menu-btn"]');
await waitFor(S.page2, () => !document.querySelector('[data-testid="dice-menu"]'));

const p2Initial = await S.page2.evaluate(() => {
  const s = window.__vtt.getState();
  return { view: s.viewMapId, defaultId: s.scene.activeMapId };
});
check(p2Initial.view === p2Initial.defaultId, 'новичок попадает на карту по умолчанию');
const p2MapItems = await S.page2.$$('[data-testid="map-item"]');
const map1Id = await S.page.evaluate(() => window.__vtt.getState().scene.maps[0].id);
await S.page.click('[data-testid="map-item"] [data-testid="map-bring"]');
await waitFor(S.page2, (id) => window.__vtt.getState().viewMapId === id, 5000, map1Id);
const p2Brought = await S.page2.evaluate(() => window.__vtt.getState().viewMapId);
check(p2Brought === map1Id, 'кнопка «Все» переносит игроков на карту');
await p2MapItems[1].click();
await waitFor(S.page2, (id) => window.__vtt.getState().viewMapId === id, 5000, S.maps2.second);
const p2Local = await S.page2.evaluate(() => window.__vtt.getState().viewMapId);
const dmView = await S.page.evaluate(() => window.__vtt.getState().viewMapId);
check(
  p2Local === S.maps2.second && dmView === map1Id,
  'личное переключение игрока не меняет карту у ведущего'
);
await S.page.click('[data-testid="map-item"] [data-testid="map-bring"]');
await waitFor(S.page2, (id) => window.__vtt.getState().viewMapId === id, 5000, map1Id);
await waitFor(S.page2, () => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  if (!t) return false;
  const sx = t.x * s.view.scale + s.view.x;
  const sy = t.y * s.view.scale + s.view.y;
  const canvas = document.querySelector('canvas[data-vtt-layer="tokens"]'); // слой токенов и прицела
  if (!canvas) return false;
  const d = canvas.getContext('2d').getImageData(Math.round(sx), Math.round(sy), 1, 1).data;
  return d[0] > 100 && d[0] > d[2];
}, 8000);
await S.page2.screenshot({ path: path.join(S.OUT, '12-player.png') });

const msgCount = await S.page2.$$eval('[data-testid="chat-msg"]', (els) => els.length);
check(msgCount >= 2, `игрок видит историю чата (${msgCount} сообщений)`);
const tokenCount = await S.page2.$$eval('[data-testid="token-panel-item"]', (els) => els.length);
check(tokenCount === 2, 'библиотека токенов общая: игрок видит токены из библиотеки DM');
const playerChips = await S.page2.$$eval('[data-testid="player-chip"]', (els) => els.map((el) => el.textContent));
check(playerChips.some((t) => t.includes('Игрок')) && playerChips.some((t) => t.includes('DM')), 'список игроков виден');
const p2Maps = await S.page2.$$eval('[data-testid="map-item"]', (els) => els.length);
check(p2Maps === 2, 'игрок видит список карт');
const p2Sheet = await S.page2.evaluate(() => window.__vtt.getState().sheet);
check(p2Sheet === null, 'лист персонажа не виден другим игрокам');

const fogBtn = await findButton(S.page, '[data-testid="toolbar"] button', 'Туман');
await fogBtn.click();
await S.page.waitForSelector('[data-testid="fog-panel"]');
await (await findButton(S.page, '[data-testid="fog-panel"] button', 'Прямоугольник')).click();
await S.page.mouse.move(300, 150);
await S.page.mouse.down();
await S.page.mouse.move(620, 400, { steps: 8 });
await S.page.mouse.up();
await waitFor(S.page, () => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return !!m && m.fog.hidden.length > 20;
}, 5000);
await waitFor(S.page2, () => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return !!m && m.fog.hidden.length > 20;
}, 5000);
await nextFrame(S.page2);
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
  const canvas = document.querySelectorAll('canvas')[0]; // туман рисуется в слое карты
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
  const canvas = document.querySelector('canvas[data-vtt-layer="tokens"]'); // слой токенов и прицела
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(Math.round(sx), Math.round(sy), 1, 1).data;
  return { r: d[0], a: d[3] };
});
check(tokPxBefore.r > 150, 'до тумана токен виден игроку');
await (await findButton(S.page, '[data-testid="fog-panel"] button', 'Кисть')).click();
const sizeButtons = await S.page.$$('[data-testid="fog-panel"] [data-testid="fog-group"]');
await sizeButtons[2].$eval('button', (el) => el.click());
await S.page.mouse.move(tokPos.sx, tokPos.sy);
await S.page.mouse.down();
await S.page.mouse.up();
await waitFor(S.page2, (n) => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return !!m && m.fog.hidden.length > n;
}, 5000, playerFogCount);
await nextFrame(S.page2);
const tokPxAfter = await S.page2.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  const sx = t.x * s.view.scale + s.view.x;
  const sy = t.y * s.view.scale + s.view.y;
  const canvas = document.querySelector('canvas[data-vtt-layer="tokens"]'); // слой токенов и прицела
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(Math.round(sx), Math.round(sy), 1, 1).data;
  return { r: d[0], a: d[3] };
});
check(tokPxAfter.a === 0, 'токен в тумане скрыт от игрока');
await S.page2.screenshot({ path: path.join(S.OUT, '13-fog.png') });
const fogDoneBtn = await findButton(S.page, '[data-testid="fog-panel"] button', 'Готово');
await fogDoneBtn.click();
await waitFor(S.page, () => !document.querySelector('[data-testid="fog-panel"]'));

const combatBtn = await findButton(S.page, '[data-testid="toolbar"] button', 'Бой');
check(!!combatBtn, 'у ведущего есть кнопка боя');
await combatBtn.click();
await S.page.waitForSelector('[data-testid="initiative-bar"]');
await S.page2.waitForSelector('[data-testid="initiative-bar"]');
const chipCount = await S.page.$$eval('[data-testid="initiative-bar"] [data-testid="initiative-chip"]', (els) => els.length);
check(chipCount >= 1, `полоса инициативы появилась (${chipCount} чипов)`);
check((await S.page2.$('[data-testid="initiative-bar"]')) !== null, 'игрок видит полосу инициативы');

const firstChip = await S.page.$('[data-testid="initiative-bar"] [data-testid="initiative-chip"]');
await firstChip.hover();
await waitFor(S.page, () => window.__vtt.getState().hoverTokenId !== null);
const hoverOk = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const combat = s.scene.maps.find((m) => m.id === s.viewMapId)?.combat;
  return s.hoverTokenId !== null && !!combat && combat.entries.some((e) => e.tokenId === s.hoverTokenId);
});
check(hoverOk, 'наведение на чип подсвечивает токен');

const endCombatBtn = await findButton(S.page, '[data-testid="toolbar"] button', 'Конец боя');
await endCombatBtn.click();
await waitFor(S.page, () => !document.querySelector('[data-testid="initiative-bar"]'));
check((await S.page.$('[data-testid="initiative-bar"]')) === null, 'после конца боя полоса исчезла у ведущего');
check((await S.page2.$('[data-testid="initiative-bar"]')) === null, 'после конца боя полоса исчезла у игрока');

// Игрок (в режиме тестов) тянет токен: ход по клеткам, позиция меняется и фиксируется.
await S.page.evaluate(() => window.__vtt.getState().setRoomSettings(true));
await waitFor(S.page2, () => window.__vtt.getState().testMode === true, 5000);
const pStart = await S.page2.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  return t ? { sx: t.x * s.view.scale + s.view.x, sy: t.y * s.view.scale + s.view.y, x: t.x, y: t.y } : null;
});
await S.page2.mouse.move(pStart.sx, pStart.sy);
await S.page2.mouse.down();
await S.page2.mouse.move(pStart.sx + 300, pStart.sy + 300, { steps: 10 });
await S.page2.mouse.up();
await waitFor(
  S.page2,
  (old) => {
    const s = window.__vtt.getState();
    const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
    return !!t && !s.movingTokens[t.id] && (t.x !== old.x || t.y !== old.y);
  },
  8000,
  { x: pStart.x, y: pStart.y }
);
const pAfter = await S.page2.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  return { x: t?.x, y: t?.y, distance: t ? Math.hypot(t.x - 0, t.y - 0) : 0 };
});
check(
  pAfter.x !== pStart.x || pAfter.y !== pStart.y,
  `игрок перетащил токен по маршруту (${pStart.x},${pStart.y} -> ${pAfter.x},${pAfter.y})`
);
await S.page.evaluate(() => window.__vtt.getState().setRoomSettings(false));
await waitFor(S.page2, () => window.__vtt.getState().testMode === false, 5000);

S.ctx3 = await S.browser.createBrowserContext();
S.page3 = await S.ctx3.newPage();
await S.page3.setViewport({ width: 1200, height: 800 });
await S.page3.goto(`${S.BASE}?admin=1`, { waitUntil: 'networkidle0' });
await S.page3.waitForSelector('[data-testid="admin-card"]');
await waitFor(S.page3, () => document.querySelectorAll('[data-testid="admin-room"]').length >= 1, 8000);
const adminRooms = await S.page3.$$eval('[data-testid="admin-room"]', (els) => els.length);
check(adminRooms >= 1, `страница ведущего показывает список комнат (${adminRooms})`);
