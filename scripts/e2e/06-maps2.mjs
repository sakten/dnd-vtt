import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { findButton } from '../lib/e2e-helpers.mjs';
import path from 'node:path';

S.maps2 = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  return {
    count: s.scene.maps.length,
    active: s.scene.activeMapId,
    second: s.scene.maps[1]?.id ?? null,
    tokensOnSecond: s.scene.maps[1]?.tokens.length ?? -1,
  };
});
check(S.maps2.count === 2 && S.maps2.active === S.maps2.second, 'вторая карта добавлена и активна по умолчанию');
check(S.maps2.tokensOnSecond === 0, 'на новой карте нет токенов');
const mapItems = await S.page.$$('.map-item');
await mapItems[1].click();
await sleep(800);
const dmViewsMap2 = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return { name: m?.name, tokens: m?.tokens.length ?? -1 };
});
check(dmViewsMap2.name === 'test-map2' && dmViewsMap2.tokens === 0, 'ведущий переключился на вторую карту (локально)');
await S.page.screenshot({ path: path.join(S.OUT, '11-map2.png') });

await mapItems[0].click();
await sleep(800);
const backToMap1 = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return { name: m?.name, tokens: m?.tokens.length ?? -1 };
});
check(backToMap1.name === 'test-map' && backToMap1.tokens === 2, 'переключение на первую карту вернуло её токены');
await mapItems[1].click();
await sleep(800);
const backToMap2 = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return { name: m?.name, tokens: m?.tokens.length ?? -1 };
});
check(backToMap2.name === 'test-map2' && backToMap2.tokens === 0, 'переключение на вторую карту');
await mapItems[0].click();
await sleep(800);

await S.gridBtn.click();
await S.page.waitForSelector('.modal');
const sizeInput = await S.page.$('.modal .field input[type=number]');
await sizeInput.click();
await S.page.keyboard.down('Control');
await S.page.keyboard.press('KeyA');
await S.page.keyboard.up('Control');
await S.page.keyboard.type('100', { delay: 30 });
await (await findButton(S.page, '.modal button', 'Готово')).click();
await sleep(900);
const grid100 = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return { size: s.scene.grid.size, w: t?.w, x: t?.x, y: t?.y };
});
check(
  grid100.size === 100 && grid100.w === 200 && grid100.x === 700 && grid100.y === 500,
  `токены подстроились под новую сетку (размер ${grid100.size}, токен ${grid100.w}px на ${grid100.x},${grid100.y})`
);
await S.gridBtn.click();
await S.page.waitForSelector('.modal');
const sizeInput2 = await S.page.$('.modal .field input[type=number]');
await sizeInput2.click();
await S.page.keyboard.down('Control');
await S.page.keyboard.press('KeyA');
await S.page.keyboard.up('Control');
await S.page.keyboard.type('50', { delay: 30 });
await (await findButton(S.page, '.modal button', 'Готово')).click();
await sleep(900);
const grid50 = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return { size: s.scene.grid.size, w: t?.w };
});
check(grid50.size === 50 && grid50.w === 100, 'возврат к сетке 50 вернул токенам размер');
