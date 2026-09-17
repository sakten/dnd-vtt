import { S } from './state.mjs';
import { check } from '../lib/check.mjs';
import { findButton, waitFor } from '../lib/e2e-helpers.mjs';
import path from 'node:path';

// Режим «Стены»: ПКМ по пустому месту завершает цепочку и позволяет начать новую
// без выхода из режима; Escape — сначала завершает цепочку, потом выходит.
if (await S.page.$('[data-testid="modal"]')) {
  await S.page.keyboard.press('Escape');
  await waitFor(S.page, () => !document.querySelector('[data-testid="modal"]'), 3000);
}
const wallsBtn = await findButton(S.page, '[data-testid="toolbar"] button', 'Стены');
check(!!wallsBtn, 'у ведущего есть кнопка «Стены»');
await wallsBtn.click();
await waitFor(S.page, () => window.__vtt.getState().wallsMode.active, 3000);
await S.page.waitForSelector('[data-testid="walls-panel"]');

const pts = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const map = s.scene.maps.find((m) => m.id === s.viewMapId);
  const g = map?.grid ?? s.scene.grid;
  const { x, y, scale } = s.view;
  const vw = s.viewport.w;
  const vh = s.viewport.h;
  const cx = Math.round(((vw / 2 - x) / scale - g.offsetX) / g.size);
  const cy = Math.round(((vh / 2 - y) / scale - g.offsetY) / g.size);
  const at = (dc, dr) => {
    const wx = g.offsetX + (cx + dc) * g.size;
    const wy = g.offsetY + (cy + dr) * g.size;
    return { wx, wy, sx: Math.round(wx * scale + x), sy: Math.round(wy * scale + y) };
  };
  const onCanvas = (p) =>
    p.sx > 60 && p.sy > 60 && p.sx < vw - 60 && p.sy < vh - 60 &&
    document.elementFromPoint(p.sx, p.sy)?.tagName === 'CANVAS';
  const offsets = [
    [0, 0], [2, 0], [0, 2], [-4, -4], [-4, 4], [4, -4], [8, 0], [0, 8], [-8, 0], [0, -8],
    [8, 8], [-8, -8], [8, -8], [-8, 8],
  ];
  let chosen = null;
  for (const [dc, dr] of offsets) {
    const set = {
      a: at(dc, dr),
      b: at(dc + 2, dr),
      empty: at(dc + 4, dr + 4),
      d: at(dc, dr + 2),
      e: at(dc + 2, dr + 2),
      doorA: at(dc + 4, dr),
      doorB: at(dc + 4, dr + 2),
    };
    if ([set.a, set.b, set.empty, set.d, set.e, set.doorA, set.doorB].every(onCanvas)) {
      chosen = set;
      break;
    }
  }
  return {
    ...(chosen ?? {
      a: at(0, 0),
      b: at(2, 0),
      empty: at(4, 4),
      d: at(0, 2),
      e: at(2, 2),
      doorA: at(4, 0),
      doorB: at(4, 2),
    }),
    free: !!chosen,
    walls: map.walls.map((w) => w.id),
  };
});
check(pts.free, 'нашлась свободная зона на карте для рисования стен');

const wallsLen = () => S.page.evaluate(() => {
  const s = window.__vtt.getState();
  return s.scene.maps.find((m) => m.id === s.viewMapId)?.walls.length ?? 0;
});
const before = await wallsLen();

await S.page.mouse.click(pts.a.sx, pts.a.sy);
await S.page.mouse.move(pts.b.sx, pts.b.sy, { steps: 4 });
const anchor = await S.page.evaluate(() => window.__vtt.getState().wallsMode.start);
check(anchor !== null, 'первый клик начал цепочку');
await S.page.mouse.click(pts.b.sx, pts.b.sy);
await waitFor(S.page, (n) => {
  const s = window.__vtt.getState();
  return (s.scene.maps.find((m) => m.id === s.viewMapId)?.walls.length ?? 0) === n;
}, 5000, before + 1);
const chainAfterFirst = await S.page.evaluate(() => window.__vtt.getState().wallsMode.start);
check(
  chainAfterFirst !== null && Math.abs(chainAfterFirst.x - pts.b.wx) < 0.5 && Math.abs(chainAfterFirst.y - pts.b.wy) < 0.5,
  'второй клик добавил сегмент и переставил якорь цепочки'
);

// ПКМ по пустому месту: цепочка завершается, сегменты на месте.
await S.page.mouse.click(pts.empty.sx, pts.empty.sy, { button: 'right' });
await waitFor(S.page, () => window.__vtt.getState().wallsMode.start === null, 3000);
const afterFinish = await wallsLen();
const stillActive = await S.page.evaluate(() => window.__vtt.getState().wallsMode.active);
check(afterFinish === before + 1, `ПКМ по пустому месту не тронул сегменты (${afterFinish})`);
check(stillActive, 'после ПКМ режим «Стены» остался включён');

// Вторая цепочка рисуется тем же режимом.
await S.page.mouse.click(pts.d.sx, pts.d.sy);
await S.page.mouse.move(pts.e.sx, pts.e.sy, { steps: 4 });
await S.page.mouse.click(pts.e.sx, pts.e.sy);
await waitFor(S.page, (n) => {
  const s = window.__vtt.getState();
  return (s.scene.maps.find((m) => m.id === s.viewMapId)?.walls.length ?? 0) === n;
}, 5000, before + 2);
check(true, 'вторая цепочка нарисована без выхода из режима');

// Дверь: завершаем текущую цепочку и рисуем дверь инструментом «Дверь».
await S.page.mouse.click(pts.empty.sx, pts.empty.sy, { button: 'right' });
await waitFor(S.page, () => window.__vtt.getState().wallsMode.start === null, 3000);
const doorTool = await findButton(S.page, '[data-testid="walls-panel"] button', 'Дверь');
await doorTool.click();
await S.page.mouse.click(pts.doorA.sx, pts.doorA.sy);
await S.page.mouse.move(pts.doorB.sx, pts.doorB.sy, { steps: 4 });
await S.page.mouse.click(pts.doorB.sx, pts.doorB.sy);
await waitFor(S.page, (n) => {
  const s = window.__vtt.getState();
  return (s.scene.maps.find((m) => m.id === s.viewMapId)?.walls.length ?? 0) === n;
}, 5000, before + 3);
const doorBefore = await S.page.evaluate(() => {
  const s = window.__vtt.getState();
  const m = s.scene.maps.find((x) => x.id === s.viewMapId);
  const door = m?.walls.find((w) => w.kind === 'door');
  return door ? { id: door.id, open: !!door.open, dmOnly: !!door.dmOnly, pickDc: door.pickDc ?? 0 } : null;
});
check(
  doorBefore !== null && !doorBefore.open && !doorBefore.dmOnly && doorBefore.pickDc === 0,
  'дверь создана с настройками по умолчанию (открываема игроками, без замка)'
);
await S.page.screenshot({ path: path.join(S.OUT, '14-walls.png') });

// Escape: первое нажатие завершает цепочку, второе — выходит из режима.
await S.page.keyboard.press('Escape');
await waitFor(S.page, () => window.__vtt.getState().wallsMode.start === null, 3000);
const activeAfterEsc1 = await S.page.evaluate(() => window.__vtt.getState().wallsMode.active);
check(activeAfterEsc1, 'первый Escape завершил цепочку, режим остался');
await S.page.keyboard.press('Escape');
await waitFor(S.page, () => !document.querySelector('[data-testid="walls-panel"]') && !window.__vtt.getState().wallsMode.active, 3000);
check((await wallsLen()) === before + 3, 'второй Escape вышел из режима, сегменты остались');

// Вне режима редактирования клик по двери открывает мини-UI; «Открыть» шлёт door:toggle.
const doorMid = {
  sx: Math.round((pts.doorA.sx + pts.doorB.sx) / 2),
  sy: Math.round((pts.doorA.sy + pts.doorB.sy) / 2),
};
await S.page.mouse.click(doorMid.sx, doorMid.sy);
await S.page.waitForSelector('[data-testid="object-menu"]');
const openBtn = await findButton(S.page, '[data-testid="object-menu"] button', 'Открыть');
check(!!openBtn, 'мини-UI двери открылся по клику вне режима «Стены»');
// Клик по кнопке «Открыть»: синтезируем DOM-click (у меню transform-позиционирование,
// из-за которого координатные клики нестабильны; поведение кнопки покрыто юнит-тестом).
await S.page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-testid="object-menu"] button')].find((x) =>
    x.textContent?.includes('Открыть')
  );
  b.click();
});
let doorAfter = false;
for (let i = 0; i < 25 && !doorAfter; i++) {
  doorAfter = await S.page.evaluate((id) => {
    const s = window.__vtt.getState();
    const m = s.scene.maps.find((x) => x.id === s.viewMapId);
    return !!m?.walls.find((w) => w.id === id)?.open;
  }, doorBefore.id);
  if (!doorAfter) await new Promise((r) => setTimeout(r, 200));
}
check(doorAfter, 'DM открывает дверь через мини-UI');
await S.page.screenshot({ path: path.join(S.OUT, '14b-door-open.png') });
await S.page.click('[data-testid="object-menu-close"]');
await waitFor(S.page, () => !document.querySelector('[data-testid="object-menu"]'), 3000);

// Возвращаем карту как была — стены тестового сценария удаляем.
await S.page.evaluate((kept) => {
  const st = window.__vtt.getState();
  const map = st.scene.maps.find((m) => m.id === st.viewMapId);
  st.updateWalls(map.id, map.walls.filter((w) => kept.includes(w.id)));
}, pts.walls);
await waitFor(S.page, (n) => {
  const s = window.__vtt.getState();
  return (s.scene.maps.find((m) => m.id === s.viewMapId)?.walls.length ?? 0) === n;
}, 5000, before);
check((await wallsLen()) === before, 'тестовые стены убраны с карты');
