import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { findButton } from '../lib/e2e-helpers.mjs';
import path from 'node:path';

S.fileInputs = await S.page.$$('input[type=file]');
check(S.fileInputs.length === 2, 'два файловых инпута (карты и токены)');
const slotLabel = await S.page.$eval('.character-slot .character-slot-label', (el) => el.textContent);
check(slotLabel === 'Текущий Персонаж', 'поле «Текущий Персонаж» есть над панелью токенов');
await S.fileInputs[0].uploadFile(S.mapPath);
await sleep(1500);
await S.page.screenshot({ path: path.join(S.OUT, '03-map.png') });
const mapState = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  return { count: s.scene.maps.length, active: s.scene.activeMapId, first: s.scene.maps[0]?.id ?? null };
});
check(mapState.count === 1 && mapState.active === mapState.first, 'карта добавлена в список и активна');

S.gridBtn = await findButton(S.page, '.toolbar button', 'Сетка');
await S.gridBtn.click();
await S.page.waitForSelector('.modal');
await sleep(300);
await S.page.keyboard.press('Escape');
await sleep(300);
check((await S.page.$('.modal')) === null, 'Escape закрывает настройки сетки');
const gridStill = await S.page.evaluate(() => window.__vtt.getState().scene.grid.size);
check(gridStill === 50, 'Escape не применяет изменения');
await S.gridBtn.click();
await S.page.waitForSelector('.modal');
await S.page.screenshot({ path: path.join(S.OUT, '04-grid-modal.png') });
const doneBtn = await findButton(S.page, '.modal button', 'Готово');
await doneBtn.click();
await sleep(400);

await S.fileInputs[1].uploadFile(S.tokenPath);
await S.page.waitForSelector('.token-panel-item img');
await sleep(600);
await S.page.screenshot({ path: path.join(S.OUT, '05-library.png') });

await S.page.click('.token-panel-item img');
await sleep(300);
const modalAfterSingleClick = await S.page.$('.modal');
check(modalAfterSingleClick === null, 'одиночный клик по токену библиотеки не открывает меню');
const tokenCountAfterClick = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  return s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens.length ?? -1;
});
check(tokenCountAfterClick === 0, 'клик по токену в библиотеке НЕ добавляет его на поле');
await S.page.click('.token-panel-item img');
await S.page.waitForSelector('.modal');
await sleep(400);
const modalBox = await S.page.$eval('.modal', (el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: window.innerWidth, h: window.innerHeight };
});
check(
  modalBox.left >= 0 && modalBox.right <= modalBox.w && modalBox.top >= 0 && modalBox.bottom <= modalBox.h,
  `окно свойств не выходит за пределы экрана (${Math.round(modalBox.left)},${Math.round(modalBox.top)}…${Math.round(modalBox.right)},${Math.round(modalBox.bottom)})`
);
await S.page.screenshot({ path: path.join(S.OUT, '06-library-editor.png') });

const escName = await S.page.$('.modal input[type=text]');
await escName.click();
await S.page.keyboard.type('Чужой', { delay: 40 });
const escNameBox = await escName.boundingBox();
await S.page.mouse.move(escNameBox.x + escNameBox.width / 2, escNameBox.y + escNameBox.height / 2);
await S.page.mouse.down();
await S.page.mouse.move(1000, 820, { steps: 6 });
await S.page.mouse.up();
await sleep(200);
check((await S.page.$('.modal')) !== null, 'выделение текста с выходом мыши за окно не закрывает его');
await S.page.keyboard.press('Escape');
await sleep(300);
check((await S.page.$('.modal')) === null, 'Escape закрывает редактор библиотеки');
const libAfterEsc = await S.page.evaluate(() => window.__vtt.getState().library[0]?.name);
check(libAfterEsc === 'test-token', `Escape не применяет изменения в библиотеке (имя: ${libAfterEsc})`);

await S.page.click('.token-panel-item img');
await sleep(300);
await S.page.click('.token-panel-item img');
await S.page.waitForSelector('.modal');
await sleep(300);
const itemName = await S.page.$('.modal input[type=text]');
await itemName.click();
await S.page.keyboard.down('Control');
await S.page.keyboard.press('KeyA');
await S.page.keyboard.up('Control');
await S.page.keyboard.type('Дракон', { delay: 40 });
const itemDesc = await S.page.$('.modal textarea');
await itemDesc.click();
await S.page.keyboard.down('Control');
await S.page.keyboard.press('KeyA');
await S.page.keyboard.up('Control');
await S.page.keyboard.type('Огромный красный дракон', { delay: 40 });
const sizeBtn = await findButton(S.page, '.modal button', '2×2');
await sizeBtn.click();
const libRound = await S.page.$('.modal input[type=checkbox]');
await libRound.click();
await sleep(300);
const libDone = await findButton(S.page, '.modal button', 'Готово');
await libDone.click();
await sleep(400);
const libItem = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  return s.library[0] ?? null;
});
check(
  libItem.name === 'Дракон' && libItem.cells === 2 && libItem.round === true && libItem.description === 'Огромный красный дракон',
  'свойства предмета в библиотеке сохраняются (включая круглость)'
);

await S.page.evaluate(() => {
  const src = document.querySelector('.token-panel-item img');
  const target = document.querySelector('.table-top');
  const dt = new DataTransfer();
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  target.dispatchEvent(
    new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 720, clientY: 450 })
  );
  target.dispatchEvent(
    new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 720, clientY: 450 })
  );
});
await sleep(900);
await S.page.screenshot({ path: path.join(S.OUT, '07-token.png') });
const dropped = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return t
    ? { name: t.name, description: t.description, cells: t.cells, w: t.w, round: t.round, x: t.x, y: t.y }
    : null;
});
check(
  dropped && dropped.name === 'Дракон' && dropped.description === 'Огромный красный дракон' && dropped.cells === 2 && dropped.w === 100 && dropped.round === true,
  `drag&drop создал токен со свойствами предмета (${dropped?.name}, ${dropped?.cells}×${dropped?.cells}, круг=${dropped?.round})`
);
check(
  dropped && Math.abs(dropped.x % 50) < 0.01 && Math.abs(dropped.y % 50) < 0.01,
  `2x2 встал на пересечение линий (${dropped?.x}, ${dropped?.y})`
);

const tokenPos = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return t ? { sx: t.x * s.view.scale + s.view.x, sy: t.y * s.view.scale + s.view.y } : null;
});
await S.page.mouse.click(tokenPos.sx, tokenPos.sy);
await sleep(80);
const targetCheck = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return { target: s.targetTokenId, id: t?.id ?? null };
});
check(targetCheck.target === targetCheck.id, 'клик по не-токену игрока задаёт цель');
await S.page.mouse.click(tokenPos.sx, tokenPos.sy);
await S.page.waitForSelector('.modal');
await sleep(300);
const fieldNameEsc = await S.page.$('.modal input[type=text]');
await fieldNameEsc.click();
await S.page.keyboard.down('Control');
await S.page.keyboard.press('KeyA');
await S.page.keyboard.up('Control');
await S.page.keyboard.type('Хобгоблин', { delay: 40 });
await S.page.keyboard.press('Escape');
await sleep(300);
check((await S.page.$('.modal')) === null, 'Escape закрывает меню токена');
const fieldAfterEsc = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  return s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0]?.name;
});
check(fieldAfterEsc === 'Дракон', `Escape не применяет правки токена на поле (имя: ${fieldAfterEsc})`);

await S.page.mouse.click(tokenPos.sx, tokenPos.sy);
await sleep(80);
await S.page.mouse.click(tokenPos.sx, tokenPos.sy);
await S.page.waitForSelector('.modal');
await sleep(300);
