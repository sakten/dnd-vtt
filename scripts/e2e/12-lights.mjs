import { S } from './state.mjs';
import { check } from '../lib/check.mjs';
import { findButton, waitFor } from '../lib/e2e-helpers.mjs';
import path from 'node:path';

// Инструмент «Свет»: ставим факел кликом по столу, проверяем данные карты и очистку.
// Предыдущий сценарий мог оставить открытым меню токена — закрываем, чтобы клик дошёл до тулбара.
if (await S.page.$('[data-testid="modal"]')) {
  await S.page.keyboard.press('Escape');
  await waitFor(S.page, () => !document.querySelector('[data-testid="modal"]'));
}
const lightBtn = await findButton(S.page, '[data-testid="toolbar"] button', 'Свет');
check(!!lightBtn, 'у ведущего есть инструмент «Свет»');
await lightBtn.click();
await S.page.waitForSelector('[data-testid="light-panel"]');

const torch = await findButton(S.page, '[data-testid="light-panel"] button', 'Факел');
check(!!torch, 'в панели есть пресет «Факел»');
await torch.click();

const mapId = await S.page.evaluate(() => window.__vtt.getState().viewMapId);
const box = await S.page.$eval('[data-testid="table-top"]', (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await S.page.mouse.click(box.x + box.w / 2, box.y + box.h / 2);
await waitFor(
  S.page,
  (id) => {
    const s = window.__vtt.getState();
    const map = s.scene.maps.find((m) => m.id === id);
    return !!map && map.lights.length === 1;
  },
  5000,
  mapId
);

const placed = await S.page.evaluate((id) => {
  const s = window.__vtt.getState();
  const map = s.scene.maps.find((m) => m.id === id);
  return { light: map?.lights[0], place: s.lightMode.place };
}, mapId);
check(!!placed.light, 'источник света появился на карте');
check(placed.light?.bright === 20 && placed.light?.dim === 20, `радиусы факела 20/20 (${placed.light?.bright}/${placed.light?.dim})`);
check(placed.light?.color === '#ffab4a', `цвет факела сохранён (${placed.light?.color})`);
check(!!placed.place, 'режим размещения источника активен');
await S.page.screenshot({ path: path.join(S.OUT, '13-lights.png') });

const clear = await findButton(S.page, '[data-testid="light-panel"] button', 'Убрать свет');
check(!!clear, 'есть кнопка «Убрать свет»');
await clear.click();
await waitFor(
  S.page,
  (id) => {
    const s = window.__vtt.getState();
    const map = s.scene.maps.find((m) => m.id === id);
    return !!map && map.lights.length === 0;
  },
  5000,
  mapId
);
check(true, 'источники света очищены');

const done = await findButton(S.page, '[data-testid="light-panel"] button', 'Готово');
await done.click();
await waitFor(S.page, () => !window.__vtt.getState().lightMode.active);
check(true, 'инструмент «Свет» закрылся');
