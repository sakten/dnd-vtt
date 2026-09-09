import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3001';
const OUT = path.resolve('artifacts/e2e');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(width, height, pixelFn) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const o = rowStart + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mapPath = path.resolve(OUT, 'test-map.png');
fs.writeFileSync(
  mapPath,
  makePng(1000, 800, (x, y) => {
    const border = x < 4 || y < 4 || x >= 996 || y >= 796;
    if (border) return [90, 160, 90, 255];
    const onLine = x % 100 === 0 || y % 100 === 0;
    if (onLine) return [70, 78, 92, 255];
    return [46, 52, 64, 255];
  })
);

const map2Path = path.resolve(OUT, 'test-map2.png');
fs.writeFileSync(
  map2Path,
  makePng(800, 600, (x, y) => {
    const border = x < 4 || y < 4 || x >= 796 || y >= 596;
    if (border) return [160, 120, 60, 255];
    const onLine = x % 80 === 0 || y % 80 === 0;
    if (onLine) return [110, 88, 55, 255];
    return [70, 60, 44, 255];
  })
);

const tokenPath = path.resolve(OUT, 'test-token.png');
fs.writeFileSync(
  tokenPath,
  makePng(200, 200, (x, y) => {
    const d = Math.sqrt((x - 100) ** 2 + (y - 100) ** 2);
    if (d < 90) return [220, 66, 66, 255];
    if (d < 96) return [120, 30, 30, 255];
    return [0, 0, 0, 0];
  })
);

const tokenSquarePath = path.resolve(OUT, 'test-token-square.png');
fs.writeFileSync(tokenSquarePath, makePng(200, 200, () => [220, 66, 66, 255]));

const errors = [];
let ok = true;
const check = (cond, label) => {
  console.log(cond ? 'PASS' : 'FAIL', '-', label);
  if (!cond) ok = false;
};

const watchdog = setTimeout(() => {
  console.log('E2E TIMEOUT');
  process.exit(1);
}, 300000);
watchdog.unref();

async function findButton(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await h.evaluate((el) => el.textContent ?? '');
    if (t.includes(text)) return h;
  }
  return null;
}

async function attachErrorLog(page, label) {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

const page = await (await browser.createBrowserContext()).newPage();
await page.setViewport({ width: 1440, height: 900 });
await attachErrorLog(page, 'DM');

await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.waitForSelector('.join-card');
await page.screenshot({ path: path.join(OUT, '01-join.png') });

const nameInputs = await page.$$('.join-card input');
await nameInputs[0].type('Мастер');
const createBtn = await findButton(page, '.join-actions button.primary', 'Создать');
await createBtn.click();
await page.waitForSelector('.table-screen');
await page.waitForSelector('canvas');
await sleep(800);
await page.screenshot({ path: path.join(OUT, '02-empty-table.png') });
check(true, 'DM создал комнату, стол открылся');
check(page.url().includes('room='), 'ссылка после входа содержит код комнаты');

const upStatus = await page.evaluate(async () => {
  const r = await fetch('/api/upload', { method: 'POST', body: new FormData() });
  return r.status;
});
check(upStatus === 403, 'загрузка файлов без участия в комнате запрещена (403)');
const codeLength = await page.evaluate(() => window.__vtt.getState().roomCode?.length ?? 0);
check(codeLength >= 10, `длинный токен комнаты (${codeLength} символов)`);

const fileInputs = await page.$$('input[type=file]');
check(fileInputs.length === 2, 'два файловых инпута (карты и токены)');
await fileInputs[0].uploadFile(mapPath);
await sleep(1500);
await page.screenshot({ path: path.join(OUT, '03-map.png') });
const mapState = await page.evaluate(() => {
  const s = window.__vtt.getState();
  return { count: s.scene.maps.length, active: s.scene.activeMapId, first: s.scene.maps[0]?.id ?? null };
});
check(mapState.count === 1 && mapState.active === mapState.first, 'карта добавлена в список и активна');

const gridBtn = await findButton(page, '.toolbar button', 'Сетка');
await gridBtn.click();
await page.waitForSelector('.modal');
await sleep(300);
await page.keyboard.press('Escape');
await sleep(300);
check((await page.$('.modal')) === null, 'Escape закрывает настройки сетки');
const gridStill = await page.evaluate(() => window.__vtt.getState().scene.grid.size);
check(gridStill === 50, 'Escape не применяет изменения');
await gridBtn.click();
await page.waitForSelector('.modal');
await page.screenshot({ path: path.join(OUT, '04-grid-modal.png') });
const doneBtn = await findButton(page, '.modal button', 'Готово');
await doneBtn.click();
await sleep(400);

await fileInputs[1].uploadFile(tokenPath);
await page.waitForSelector('.token-panel-item img');
await sleep(600);
await page.screenshot({ path: path.join(OUT, '05-library.png') });

await page.click('.token-panel-item img');
await sleep(300);
const modalAfterSingleClick = await page.$('.modal');
check(modalAfterSingleClick === null, 'одиночный клик по токену библиотеки не открывает меню');
const tokenCountAfterClick = await page.evaluate(() => {
  const s = window.__vtt.getState();
  return s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens.length ?? -1;
});
check(tokenCountAfterClick === 0, 'клик по токену в библиотеке НЕ добавляет его на поле');
await page.click('.token-panel-item img');
await page.waitForSelector('.modal');
await sleep(400);
const modalBox = await page.$eval('.modal', (el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: window.innerWidth, h: window.innerHeight };
});
check(
  modalBox.left >= 0 && modalBox.right <= modalBox.w && modalBox.top >= 0 && modalBox.bottom <= modalBox.h,
  `окно свойств не выходит за пределы экрана (${Math.round(modalBox.left)},${Math.round(modalBox.top)}…${Math.round(modalBox.right)},${Math.round(modalBox.bottom)})`
);
await page.screenshot({ path: path.join(OUT, '06-library-editor.png') });

const escName = await page.$('.modal input[type=text]');
await escName.click();
await page.keyboard.type('Чужой', { delay: 40 });
const escNameBox = await escName.boundingBox();
await page.mouse.move(escNameBox.x + escNameBox.width / 2, escNameBox.y + escNameBox.height / 2);
await page.mouse.down();
await page.mouse.move(1000, 820, { steps: 6 });
await page.mouse.up();
await sleep(200);
check((await page.$('.modal')) !== null, 'выделение текста с выходом мыши за окно не закрывает его');
await page.keyboard.press('Escape');
await sleep(300);
check((await page.$('.modal')) === null, 'Escape закрывает редактор библиотеки');
const libAfterEsc = await page.evaluate(() => window.__vtt.getState().library[0]?.name);
check(libAfterEsc === 'test-token', `Escape не применяет изменения в библиотеке (имя: ${libAfterEsc})`);

await page.click('.token-panel-item img');
await sleep(300);
await page.click('.token-panel-item img');
await page.waitForSelector('.modal');
await sleep(300);
const itemName = await page.$('.modal input[type=text]');
await itemName.click();
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.type('Дракон', { delay: 40 });
const itemDesc = await page.$('.modal textarea');
await itemDesc.click();
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.type('Огромный красный дракон', { delay: 40 });
const sizeBtn = await findButton(page, '.modal button', '2×2');
await sizeBtn.click();
const libRound = await page.$('.modal input[type=checkbox]');
await libRound.click();
await sleep(300);
const libDone = await findButton(page, '.modal button', 'Готово');
await libDone.click();
await sleep(400);
const libItem = await page.evaluate(() => {
  const s = window.__vtt.getState();
  return s.library[0] ?? null;
});
check(
  libItem.name === 'Дракон' && libItem.cells === 2 && libItem.round === true && libItem.description === 'Огромный красный дракон',
  'свойства предмета в библиотеке сохраняются (включая круглость)'
);

await page.evaluate(() => {
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
await page.screenshot({ path: path.join(OUT, '07-token.png') });
const dropped = await page.evaluate(() => {
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

const tokenPos = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return t ? { sx: t.x * s.view.scale + s.view.x, sy: t.y * s.view.scale + s.view.y } : null;
});
await page.mouse.click(tokenPos.sx, tokenPos.sy);
await sleep(80);
await page.mouse.click(tokenPos.sx, tokenPos.sy);
await page.waitForSelector('.modal');
await sleep(300);
const fieldNameEsc = await page.$('.modal input[type=text]');
await fieldNameEsc.click();
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.type('Хобгоблин', { delay: 40 });
await page.keyboard.press('Escape');
await sleep(300);
check((await page.$('.modal')) === null, 'Escape закрывает меню токена');
const fieldAfterEsc = await page.evaluate(() => {
  const s = window.__vtt.getState();
  return s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0]?.name;
});
check(fieldAfterEsc === 'Дракон', `Escape не применяет правки токена на поле (имя: ${fieldAfterEsc})`);

await page.mouse.click(tokenPos.sx, tokenPos.sy);
await sleep(80);
await page.mouse.click(tokenPos.sx, tokenPos.sy);
await page.waitForSelector('.modal');
await sleep(300);
await page.screenshot({ path: path.join(OUT, '08-token-menu.png') });
const fieldName = await page.$('.modal input[type=text]');
await fieldName.click();
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.type('Гоблин', { delay: 40 });
await sleep(400);
const menuDone = await findButton(page, '.modal button', 'Готово');
await menuDone.click();
await sleep(400);
const afterEdit = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return { field: t?.name, lib: s.library[0]?.name };
});
check(
  afterEdit.field === 'Гоблин' && afterEdit.lib === 'Дракон',
  `правка токена на поле не меняет предмет библиотеки (поле: ${afterEdit.field}, библиотека: ${afterEdit.lib})`
);

const sized = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return t ? { sx: t.x * s.view.scale + s.view.x, sy: t.y * s.view.scale + s.view.y } : null;
});
await page.mouse.move(sized.sx, sized.sy);
await page.mouse.down();
await page.mouse.move(sized.sx + 140, sized.sy + 110, { steps: 10 });
await page.mouse.up();
await sleep(800);
await page.screenshot({ path: path.join(OUT, '09-token-moved.png') });
const moved2 = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return t ? { x: t.x, y: t.y } : null;
});
check(
  moved2 && Math.abs(moved2.x % 50) < 0.01 && Math.abs(moved2.y % 50) < 0.01,
  `после перетаскивания 2x2 остался на пересечении линий (${moved2?.x}, ${moved2?.y})`
);

await fileInputs[1].uploadFile(tokenSquarePath);
await sleep(800);
const thumbs = await page.$$('.token-panel-item img');
await thumbs[1].click();
await sleep(300);
await thumbs[1].click();
await page.waitForSelector('.modal');
const roundCheck = await page.$('.modal input[type=checkbox]');
await roundCheck.click();
await sleep(200);
const libRoundDone = await findButton(page, '.modal button', 'Готово');
await libRoundDone.click();
await sleep(400);
await page.evaluate(() => {
  const src = document.querySelectorAll('.token-panel-item img')[1];
  const target = document.querySelector('.table-top');
  const dt = new DataTransfer();
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  target.dispatchEvent(
    new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 800, clientY: 600 })
  );
  target.dispatchEvent(
    new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 800, clientY: 600 })
  );
});
await sleep(900);
const roundToken = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  return t ? { round: t.round, name: t.name, w: t.w } : null;
});
check(
  roundToken && roundToken.round === true && roundToken.name === 'test-token-square',
  `перетащенный квадратный токен получил круглость (round=${roundToken?.round})`
);
const corner = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  const sx = t.x * s.view.scale + s.view.x;
  const sy = t.y * s.view.scale + s.view.y;
  const half = (t.w / 2) * s.view.scale;
  const canvas = document.querySelectorAll('canvas')[3];
  const ctx = canvas.getContext('2d');
  const px = ctx.getImageData(Math.round(sx - half + 3), Math.round(sy - half + 3), 1, 1).data;
  return { r: px[0], g: px[1], b: px[2] };
});
check(corner.r < 150, `угол квадратного токена скрыт круглым клипом (r=${corner.r})`);
const roundPos = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  return { sx: t.x * s.view.scale + s.view.x, sy: t.y * s.view.scale + s.view.y };
});
await page.mouse.click(roundPos.sx, roundPos.sy);
await sleep(80);
await page.mouse.click(roundPos.sx, roundPos.sy);
await page.waitForSelector('.modal');
const roundToggle = await page.$('.modal input[type=checkbox]');
await roundToggle.click();
const roundMenuDone = await findButton(page, '.modal button', 'Готово');
await roundMenuDone.click();
await sleep(400);
const roundAfter = await page.evaluate(() => {
  const s = window.__vtt.getState();
  return s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1]?.round;
});
check(roundAfter === false, 'круглость токена меняется в меню поля');
await page.screenshot({ path: path.join(OUT, '09b-round.png') });

const canvas = await page.$('canvas');
const box = await canvas.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.wheel({ deltaY: -240 });
await sleep(500);
await page.screenshot({ path: path.join(OUT, '10-zoom.png') });

const wheelToken = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return {
    sx: t.x * s.view.scale + s.view.x,
    sy: t.y * s.view.scale + s.view.y,
    viewScale: s.view.scale,
    tokenScale: t.scale,
    tokenW: t.w,
  };
});
await page.mouse.move(wheelToken.sx, wheelToken.sy);
await page.mouse.wheel({ deltaY: -120 });
await sleep(500);
const wheelAfter = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return { viewScale: s.view.scale, tokenScale: t.scale, tokenW: t.w };
});
check(
  wheelAfter.viewScale > wheelToken.viewScale && wheelAfter.tokenScale === wheelToken.tokenScale && wheelAfter.tokenW === wheelToken.tokenW,
  `колесо над токеном зумит карту, а не токен (scale ${wheelToken.viewScale.toFixed(2)} -> ${wheelAfter.viewScale.toFixed(2)}, токен ${wheelAfter.tokenW}px)`
);

const chatInput = await page.$('.chat-input input[type=text]');
await chatInput.type('d20+3');
await chatInput.press('Enter');
await sleep(800);
await chatInput.type('Всем привет!');
await chatInput.press('Enter');
await sleep(800);
const dmRolls = await page.$$eval('.chat-msg.roll .roll-total-big', (els) => els.map((el) => el.textContent));
const dmTotal = Number(dmRolls[0]);
check(
  dmRolls.length === 1 && Number.isInteger(dmTotal) && dmTotal >= 4 && dmTotal <= 23,
  `бросок в чате DM отрисован: ${dmRolls[0] ?? 'нет'}`
);

await chatInput.focus();
await chatInput.press('ArrowUp');
await sleep(200);
const hist1 = await chatInput.evaluate((el) => el.value);
await chatInput.press('ArrowUp');
await sleep(200);
const hist2 = await chatInput.evaluate((el) => el.value);
await chatInput.press('ArrowDown');
await sleep(200);
const hist3 = await chatInput.evaluate((el) => el.value);
await chatInput.press('ArrowDown');
await sleep(200);
const hist4 = await chatInput.evaluate((el) => el.value);
check(
  hist1 === 'Всем привет!' && hist2 === 'd20+3' && hist3 === 'Всем привет!' && hist4 === '',
  `стрелки вверх/вниз листают историю сообщений (${hist1} / ${hist2} / ${hist4})`
);
await chatInput.type('');

await chatInput.type('d4+d20+2');
await chatInput.press('Enter');
await sleep(800);
const mixedLabels = await page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  mixedLabels.some((t) => t.includes('d20 + d4 + 2')),
  'кубы в формуле сортируются по убыванию сторон'
);

await page.click('.sheet-button');
await page.waitForSelector('.sheet-modal');
await page.screenshot({ path: path.join(OUT, '10b-sheet.png') });
const sheetInputs = await page.$$('.sheet-modal input[type=text]');
await sheetInputs[0].click();
await page.keyboard.type('Конан', { delay: 30 });
const abilityInputs = await page.$$('.sheet-modal .ability-cell input');
await abilityInputs[0].click();
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.type('45', { delay: 30 });
await abilityInputs[1].click();
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.type('16', { delay: 30 });
await abilityInputs[2].evaluate((el) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, '-5');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await sheetInputs[1].click();
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.type('d4', { delay: 30 });
const saveChecks = await page.$$('.sheet-modal .save-grid input');
await saveChecks[1].click();
const stealthRow = await findButton(page, '.sheet-modal .skill-row', 'Скрытность');
await stealthRow.click();
await sleep(150);
await stealthRow.click();
await sheetInputs[2].click();
await page.keyboard.type('Меч', { delay: 30 });
await sheetInputs[3].click();
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.type('d20+5', { delay: 30 });
await sheetInputs[4].click();
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.type('d8+3', { delay: 30 });
await page.screenshot({ path: path.join(OUT, '10c-sheet-filled.png') });
const saveSheetBtn = await findButton(page, '.sheet-modal button', 'Сохранить');
await saveSheetBtn.click();
await sleep(500);
const sheetState = await page.evaluate(() => window.__vtt.getState().sheet);
check(
  sheetState &&
    sheetState.name === 'Конан' &&
    sheetState.abilities.str === 30 &&
    sheetState.abilities.dex === 16 &&
    sheetState.abilities.con === 0 &&
    sheetState.proficiencyBonus === 'd4' &&
    sheetState.saves.dex === true &&
    sheetState.skills.stealth === 2 &&
    sheetState.attack.hit === 'd20+5' &&
    sheetState.attack.damage === 'd8+3',
  `карточка персонажа сохранилась (статы с клампом до 30) — ${JSON.stringify(sheetState?.abilities)}`
);

await page.click('.roll-button');
await page.waitForSelector('.roll-menu');
const attackItem = await findButton(page, '.roll-menu .roll-menu-item', 'Attack');
await attackItem.click();
await sleep(900);
const attackLabels = await page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  attackLabels.some((t) => t.includes('Атака: Меч') && t.includes('d20 + 5')) &&
    attackLabels.some((t) => t.includes('Урон: Меч') && t.includes('d8 + 3')),
  `Attack кинул попадание и урон в чат (${attackLabels.join(' | ')})`
);

await page.click('.roll-button');
await (await findButton(page, '.roll-menu .roll-menu-item', 'Save')).click();
await sleep(200);
await (await findButton(page, '.roll-menu .roll-menu-item', 'Ловкость')).click();
await sleep(800);
const saveLabels = await page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  saveLabels.some((t) => t.includes('Спасбросок: Ловкость') && t.includes('d20 + d4 + 3')),
  `Save кидает модификатор + ПБ-куб, кубы раньше чисел (${saveLabels[saveLabels.length - 1]})`
);

await page.click('.roll-button');
await (await findButton(page, '.roll-menu .roll-menu-item', 'Check')).click();
await sleep(200);
await (await findButton(page, '.roll-menu .roll-menu-item', 'Ловкость')).click();
await sleep(200);
await (await findButton(page, '.roll-menu .roll-menu-item', 'Скрытность')).click();
await sleep(800);
const checkLabels = await page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  checkLabels.some((t) => t.includes('Проверка: Скрытность') && t.includes('d20 + 2d4 + 3')),
  'Check кидает экспертизу как двойной ПБ-куб, кубы раньше чисел'
);

const rollCountBefore = await page.$$eval('.chat-msg.roll', (els) => els.length);
const firstRoll = await page.$('.chat-msg.roll');
await firstRoll.click();
await sleep(800);
const rollCountAfter = await page.$$eval('.chat-msg.roll', (els) => els.length);
check(rollCountAfter === rollCountBefore + 1, 'клик по броску повторяет его');

const advChecks = await page.$$('.adv-check input');
await advChecks[0].click();
await sleep(200);
await advChecks[1].click();
await sleep(200);
const bothChecked = await page.$$eval('.adv-check input', (els) => els.map((el) => el.checked));
check(bothChecked[0] === false && bothChecked[1] === true, 'Adv и Dis не могут быть выбраны одновременно');
await advChecks[1].click();
await sleep(200);
await advChecks[0].click();
await sleep(200);
const advOnly = await page.$$eval('.adv-check input', (els) => els.map((el) => el.checked));
check(advOnly[0] === true && advOnly[1] === false, 'выбор Adv снимает Dis');
await page.click('.roll-button');
await (await findButton(page, '.roll-menu .roll-menu-item', 'Attack')).click();
await sleep(900);
const advLabels = await page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  advLabels.some((t) => t.includes('Атака: Меч') && t.includes('d20a')) &&
    advLabels.some((t) => t.includes('Урон: Меч') && t.includes('d8 + 3')),
  'Adv: попадание кидается с преимуществом, урон без изменений'
);
const advState = await page.$$eval('.adv-check input', (els) => els.map((el) => el.checked));
check(advState[0] === false && advState[1] === false, 'галочки Adv/Dis сбрасываются после броска');

const disChecks = await page.$$('.adv-check input');
await disChecks[1].click();
await sleep(200);
await page.click('.roll-button');
await (await findButton(page, '.roll-menu .roll-menu-item', 'Save')).click();
await sleep(200);
await (await findButton(page, '.roll-menu .roll-menu-item', 'Ловкость')).click();
await sleep(800);
const disLabels = await page.$$eval('.chat-msg.roll', (els) => els.map((el) => el.textContent));
check(
  disLabels.some((t) => t.includes('Спасбросок: Ловкость') && t.includes('d20d')),
  'Dis: спасбросок кидается с помехой'
);
const disState = await page.$$eval('.adv-check input', (els) => els.map((el) => el.checked));
check(disState[0] === false && disState[1] === false, 'галочки сбрасываются после броска');

await fileInputs[0].uploadFile(map2Path);
await sleep(1200);
const maps2 = await page.evaluate(() => {
  const s = window.__vtt.getState();
  return {
    count: s.scene.maps.length,
    active: s.scene.activeMapId,
    second: s.scene.maps[1]?.id ?? null,
    tokensOnSecond: s.scene.maps[1]?.tokens.length ?? -1,
  };
});
check(maps2.count === 2 && maps2.active === maps2.second, 'вторая карта добавлена и активна по умолчанию');
check(maps2.tokensOnSecond === 0, 'на новой карте нет токенов');
const mapItems = await page.$$('.map-item');
await mapItems[1].click();
await sleep(800);
const dmViewsMap2 = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return { name: m?.name, tokens: m?.tokens.length ?? -1 };
});
check(dmViewsMap2.name === 'test-map2' && dmViewsMap2.tokens === 0, 'ведущий переключился на вторую карту (локально)');
await page.screenshot({ path: path.join(OUT, '11-map2.png') });

await mapItems[0].click();
await sleep(800);
const backToMap1 = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return { name: m?.name, tokens: m?.tokens.length ?? -1 };
});
check(backToMap1.name === 'test-map' && backToMap1.tokens === 2, 'переключение на первую карту вернуло её токены');
await mapItems[1].click();
await sleep(800);
const backToMap2 = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return { name: m?.name, tokens: m?.tokens.length ?? -1 };
});
check(backToMap2.name === 'test-map2' && backToMap2.tokens === 0, 'переключение на вторую карту');
await mapItems[0].click();
await sleep(800);

await gridBtn.click();
await page.waitForSelector('.modal');
const sizeInput = await page.$('.modal .field input[type=number]');
await sizeInput.click();
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.type('100', { delay: 30 });
await (await findButton(page, '.modal button', 'Готово')).click();
await sleep(900);
const grid100 = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return { size: s.scene.grid.size, w: t?.w, x: t?.x, y: t?.y };
});
check(
  grid100.size === 100 && grid100.w === 200 && grid100.x === 700 && grid100.y === 500,
  `токены подстроились под новую сетку (размер ${grid100.size}, токен ${grid100.w}px на ${grid100.x},${grid100.y})`
);
await gridBtn.click();
await page.waitForSelector('.modal');
const sizeInput2 = await page.$('.modal .field input[type=number]');
await sizeInput2.click();
await page.keyboard.down('Control');
await page.keyboard.press('KeyA');
await page.keyboard.up('Control');
await page.keyboard.type('50', { delay: 30 });
await (await findButton(page, '.modal button', 'Готово')).click();
await sleep(900);
const grid50 = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return { size: s.scene.grid.size, w: t?.w };
});
check(grid50.size === 50 && grid50.w === 100, 'возврат к сетке 50 вернул токенам размер');

const code = await page.evaluate(() => window.__vtt.getState().roomCode);

const ctx2 = await browser.createBrowserContext();
const page2 = await ctx2.newPage();
await page2.setViewport({ width: 1440, height: 900 });
await attachErrorLog(page2, 'Игрок');
await page2.goto(`${BASE}?room=${code}`, { waitUntil: 'networkidle0' });
await page2.waitForSelector('.join-card');
const p2Inputs = await page2.$$('.join-card input');
const prefilled = await p2Inputs[2].evaluate((el) => el.value);
check(prefilled === code, `инвайт-ссылка предзаполнила код комнаты (${prefilled})`);
await p2Inputs[0].type('Игрок');
const joinBtn = await findButton(page2, '.join-actions button.primary', 'Войти');
await joinBtn.click();
await page2.waitForSelector('.table-screen');
await page2.waitForSelector('canvas');
await sleep(1500);

const p2Initial = await page2.evaluate(() => {
  const s = window.__vtt.getState();
  return { view: s.viewMapId, defaultId: s.scene.activeMapId };
});
check(p2Initial.view === p2Initial.defaultId, 'новичок попадает на карту по умолчанию');
const p2MapItems = await page2.$$('.map-item');
const map1Id = await page.evaluate(() => window.__vtt.getState().scene.maps[0].id);
await page.click('.map-item .map-bring');
await sleep(900);
const p2Brought = await page2.evaluate(() => window.__vtt.getState().viewMapId);
check(p2Brought === map1Id, 'кнопка «Все» переносит игроков на карту');
await p2MapItems[1].click();
await sleep(800);
const p2Local = await page2.evaluate(() => window.__vtt.getState().viewMapId);
const dmView = await page.evaluate(() => window.__vtt.getState().viewMapId);
check(
  p2Local === maps2.second && dmView === map1Id,
  'личное переключение игрока не меняет карту у ведущего'
);
await page.click('.map-item .map-bring');
await sleep(900);
await page2.screenshot({ path: path.join(OUT, '12-player.png') });

const msgCount = await page2.$$eval('.chat-msg', (els) => els.length);
check(msgCount >= 2, `игрок видит историю чата (${msgCount} сообщений)`);
const tokenCount = await page2.$$eval('.token-panel-item', (els) => els.length);
check(tokenCount === 2, 'библиотека токенов общая: игрок видит токены из библиотеки DM');
const playerChips = await page2.$$eval('.player-chip', (els) => els.map((el) => el.textContent));
check(playerChips.some((t) => t.includes('Игрок')) && playerChips.some((t) => t.includes('DM')), 'список игроков виден');
const p2Maps = await page2.$$eval('.map-item', (els) => els.length);
check(p2Maps === 2, 'игрок видит список карт');
const p2Sheet = await page2.evaluate(() => window.__vtt.getState().sheet);
check(p2Sheet === null, 'лист персонажа не виден другим игрокам');

const fogBtn = await findButton(page, '.toolbar button', 'Туман');
await fogBtn.click();
await page.waitForSelector('.fog-panel');
await (await findButton(page, '.fog-panel button', 'Прямоугольник')).click();
await sleep(200);
await page.mouse.move(300, 150);
await page.mouse.down();
await page.mouse.move(620, 400, { steps: 8 });
await page.mouse.up();
await sleep(1200);
const dmFog = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return m ? m.fog.hidden.length : -1;
});
check(dmFog > 20, `прямоугольник тумана нарисован (${dmFog} клеток скрыто)`);
const playerFogCount = await page2.evaluate(() => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  return m ? m.fog.hidden.length : -1;
});
check(playerFogCount === dmFog, 'туман синхронизировался с игроком');
const fogPx = await page2.evaluate(() => {
  const s = window.__vtt.getState();
  const sx = 225 * s.view.scale + s.view.x;
  const sy = 225 * s.view.scale + s.view.y;
  const canvas = document.querySelectorAll('canvas')[1];
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(Math.round(sx), Math.round(sy), 1, 1).data;
  return { r: d[0], a: d[3] };
});
check(fogPx.a > 200 && fogPx.r < 40, `игрок видит туман (r=${fogPx.r}, a=${fogPx.a})`);

const tokPos = await page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  return t ? { wx: t.x, wy: t.y, sx: t.x * s.view.scale + s.view.x, sy: t.y * s.view.scale + s.view.y } : null;
});
const tokPxBefore = await page2.evaluate(() => {
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
await (await findButton(page, '.fog-panel button', 'Кисть')).click();
await sleep(200);
const sizeButtons = await page.$$('.fog-panel .fog-group');
await sizeButtons[2].$eval('button', (el) => el.click());
await sleep(200);
await page.mouse.move(tokPos.sx, tokPos.sy);
await page.mouse.down();
await page.mouse.up();
await sleep(1200);
const tokPxAfter = await page2.evaluate(() => {
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
await page2.screenshot({ path: path.join(OUT, '13-fog.png') });
await (await findButton(page, '.fog-panel button', 'Готово')).click();
await sleep(300);

const ctx3 = await browser.createBrowserContext();
const page3 = await ctx3.newPage();
await page3.setViewport({ width: 1200, height: 800 });
await page3.goto(`${BASE}?admin=1`, { waitUntil: 'networkidle0' });
await page3.waitForSelector('.admin-card');
await sleep(800);
const adminRooms = await page3.$$eval('.admin-room', (els) => els.length);
check(adminRooms >= 1, `страница ведущего показывает список комнат (${adminRooms})`);
const n3 = await page3.$$('.admin-card input[type=text]');
await n3[0].type('Третий');
const createBtn3 = await findButton(page3, '.join-actions button', 'Создать новую игру');
await createBtn3.click();
await page3.waitForSelector('.table-screen');
const codeY = await page3.evaluate(() => window.__vtt.getState().roomCode);
const page3Role = await page3.evaluate(() => window.__vtt.getState().role);
check(page3Role === 'dm', 'создание из страницы ведущего даёт роль DM');
await ctx3.close();

await page2.goto(`${BASE}?room=${codeY}`, { waitUntil: 'networkidle0' });
await page2.waitForSelector('.room-badge strong');
const badge2 = await page2.evaluate(() => window.__vtt.getState().roomCode);
check(badge2 === codeY, `инвайт-ссылка приоритетнее сохранённой комнаты (перешёл в ${badge2})`);

await page2.goto(BASE, { waitUntil: 'networkidle0' });
await page2.waitForSelector('.join-card');
check(true, 'голая ссылка без кода не входит в комнату автоматически');

const ctx4 = await browser.createBrowserContext();
const page4 = await ctx4.newPage();
await page4.setViewport({ width: 1200, height: 800 });
await page4.goto(`${BASE}?admin=1`, { waitUntil: 'networkidle0' });
await page4.waitForSelector('.admin-room');
const roomsBefore = await page4.$$eval('.admin-room', (els) => els.length);
let targetRow = null;
for (const row of await page4.$$('.admin-room')) {
  const t = await row.$eval('.admin-room-code', (el) => el.textContent);
  if (t === codeY) {
    targetRow = row;
    break;
  }
}
check(!!targetRow, 'нашлась строка собственной тестовой комнаты для проверки удаления');
await targetRow.$eval('button.danger', (el) => el.click());
await page4.waitForSelector('.modal');
const confirmDeleteBtn = await findButton(page4, '.modal button', 'Удалить');
await confirmDeleteBtn.click();
await sleep(1000);
const roomsAfter = await page4.$$eval('.admin-room', (els) => els.length);
check(roomsAfter === roomsBefore - 1, `удаление комнаты с подтверждением работает (${roomsBefore} -> ${roomsAfter})`);

await page4.evaluate(
  (c) =>
    new Promise((resolve) =>
      window.__vtt.getState().socket.emit('admin:delete', { adminToken: '', code: c }, () => resolve(true))
    ),
  code
);
await sleep(1000);
const refreshBtn = await findButton(page4, '.join-actions button', 'Обновить');
await refreshBtn.click();
await sleep(800);
const roomsFinal = await page4.$$eval('.admin-room', (els) => els.length);
check(roomsFinal === roomsBefore - 2, `тестовые комнаты удалены после теста (${roomsBefore} -> ${roomsFinal})`);
await ctx4.close();

const realErrors = errors.filter((e) => !e.includes('403'));
check(realErrors.length === 0, `нет ошибок в консоли браузера${realErrors.length ? ': ' + realErrors.join(' | ') : ''}`);

await browser.close();
clearTimeout(watchdog);
console.log(ok ? 'E2E OK' : 'E2E FAILED');
process.exit(ok ? 0 : 1);
