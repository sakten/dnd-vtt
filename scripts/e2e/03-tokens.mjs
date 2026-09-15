import { S } from './state.mjs';
import { check } from '../lib/check.mjs';
import { findButton, nextFrame, waitFor } from '../lib/e2e-helpers.mjs';
import path from 'node:path';

await S.page.screenshot({ path: path.join(S.OUT, '08-token-menu.png') });
const fieldName = await S.page.$('.modal input[type=text]');
await fieldName.click();
await S.page.keyboard.down('Control');
await S.page.keyboard.press('KeyA');
await S.page.keyboard.up('Control');
await S.page.keyboard.type('Гоблин', { delay: 40 });
const menuDone = await findButton(S.page, '.modal button', 'Готово');
await menuDone.click();
await waitFor(S.page, () => !document.querySelector('.modal'));
const afterEdit = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return { field: t?.name, lib: s.library[0]?.name };
});
check(
  afterEdit.field === 'Гоблин' && afterEdit.lib === 'Дракон',
  `правка токена на поле не меняет предмет библиотеки (поле: ${afterEdit.field}, библиотека: ${afterEdit.lib})`
);

const sized = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return t ? { sx: t.x * s.view.scale + s.view.x, sy: t.y * s.view.scale + s.view.y, x: t.x, y: t.y } : null;
});
await S.page.mouse.move(sized.sx, sized.sy);
await S.page.mouse.down();
await S.page.mouse.move(sized.sx + 140, sized.sy + 110, { steps: 10 });
await S.page.mouse.up();
await S.page.waitForFunction(
  (old) => {
    const s = window.__vtt.getState();
    const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
    return !!t && (t.x !== old.x || t.y !== old.y);
  },
  {},
  { x: sized.x, y: sized.y }
);
await S.page.screenshot({ path: path.join(S.OUT, '09-token-moved.png') });
const moved2 = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[0];
  return t ? { x: t.x, y: t.y } : null;
});
check(
  moved2 && Math.abs(moved2.x % 50) < 0.01 && Math.abs(moved2.y % 50) < 0.01,
  `после перетаскивания 2x2 остался на пересечении линий (${moved2?.x}, ${moved2?.y})`
);

await S.fileInputs[1].uploadFile(S.tokenSquarePath);
await waitFor(S.page, () => {
  const imgs = document.querySelectorAll('.token-panel-item img');
  return imgs.length >= 2 && [...imgs].every((img) => img.complete && img.naturalWidth > 0);
}, 8000);
const thumbs = await S.page.$$('.token-panel-item img');
await thumbs[1].click();
await thumbs[1].click();
await S.page.waitForSelector('.modal');
const hasPlayerTokenCheck = await S.page.evaluate(() =>
  Array.from(document.querySelectorAll('.modal label')).some((l) =>
    l.textContent?.includes('Это токен игрока')
  )
);
check(hasPlayerTokenCheck, 'в свойствах предмета есть галка «Это токен игрока»');
const roundCheck = await S.page.$('.modal input[type=checkbox]');
await roundCheck.click();
const libRoundDone = await findButton(S.page, '.modal button', 'Готово');
await libRoundDone.click();
await waitFor(S.page, () => !document.querySelector('.modal'));
await S.page.evaluate(() => {
  const src = document.querySelectorAll('.token-panel-item img')[1];
  const target = document.querySelector('.table-top');
  const dt = new DataTransfer();
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  target.dispatchEvent(
    new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 800, clientY: 380 })
  );
  target.dispatchEvent(
    new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 800, clientY: 380 })
  );
});
await waitFor(S.page, () => {
  const s = window.__vtt.getState();
  const map = s.scene.maps.find((m) => m.id === s.viewMapId);
  return !!map && map.tokens.length > 1;
}, 8000);
const roundToken = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  return t ? { round: t.round, name: t.name, w: t.w } : null;
});
check(
  roundToken && roundToken.round === true && roundToken.name === 'test-token-square',
  `перетащенный квадратный токен получил круглость (round=${roundToken?.round})`
);
await nextFrame(S.page);
const corner = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  const sx = t.x * s.view.scale + s.view.x;
  const sy = t.y * s.view.scale + s.view.y;
  const half = (t.w / 2) * s.view.scale;
  const canvas = document.querySelectorAll('canvas')[4]; // 0 карта, 1 туман, 2 сетка, 3 зоны, 4 токены
  const ctx = canvas.getContext('2d');
  const px = ctx.getImageData(Math.round(sx - half + 3), Math.round(sy - half + 3), 1, 1).data;
  return { r: px[0], g: px[1], b: px[2] };
});
check(corner.r < 150, `угол квадратного токена скрыт круглым клипом (r=${corner.r})`);
const roundPos = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  return { sx: t.x * s.view.scale + s.view.x, sy: t.y * s.view.scale + s.view.y };
});
await S.page.mouse.click(roundPos.sx, roundPos.sy);
await S.page.mouse.click(roundPos.sx, roundPos.sy);
await S.page.waitForSelector('.modal');
const roundToggle = await S.page.$('.modal input[type=checkbox]');
await roundToggle.click();
const roundMenuDone = await findButton(S.page, '.modal button', 'Готово');
await roundMenuDone.click();
await waitFor(S.page, () => !document.querySelector('.modal'));
const roundAfter = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  return s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1]?.round;
});
check(roundAfter === false, 'круглость токена меняется в меню поля');
await S.page.screenshot({ path: path.join(S.OUT, '09b-round.png') });

S.canvas = await S.page.$('canvas');
const box = await S.canvas.boundingBox();
const scaleBeforeZoom = await S.page.evaluate(() => window.__vtt.getState().view.scale);
await S.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await S.page.mouse.wheel({ deltaY: -240 });
await waitFor(S.page, (prev) => window.__vtt.getState().view.scale > prev, 5000, scaleBeforeZoom);
await S.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await S.page.screenshot({ path: path.join(S.OUT, '10-zoom.png') });

const wheelToken = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  // Берём токен выше нижней панели действий, чтобы колесо шло по канвасу.
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  return {
    sx: t.x * s.view.scale + s.view.x,
    sy: t.y * s.view.scale + s.view.y,
    viewScale: s.view.scale,
    tokenScale: t.scale,
    tokenW: t.w,
  };
});
await S.page.mouse.move(wheelToken.sx, wheelToken.sy);
await S.page.mouse.wheel({ deltaY: -120 });
await waitFor(S.page, (prev) => window.__vtt.getState().view.scale > prev, 5000, wheelToken.viewScale);
const wheelAfter = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const t = s.scene.maps.find((m) => m.id === s.viewMapId)?.tokens[1];
  return { viewScale: s.view.scale, tokenScale: t.scale, tokenW: t.w };
});
check(
  wheelAfter.viewScale > wheelToken.viewScale && wheelAfter.tokenScale === wheelToken.tokenScale && wheelAfter.tokenW === wheelToken.tokenW,
  `колесо над токеном зумит карту, а не токен (scale ${wheelToken.viewScale.toFixed(2)} -> ${wheelAfter.viewScale.toFixed(2)}, токен ${wheelAfter.tokenW}px)`
);
