import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = path.resolve('artifacts/walls-lab');
fs.mkdirSync(OUT, { recursive: true });

const DIR = 'C:\\Users\\Victor\\Downloads\\AncientCryptDungeonPublic\\Ancient Crypt Dungeon Public';
const maps = [
  path.join(DIR, 'Ancient-Crypt-Dungeon-Gridded-22x33-MapPublic.jpg'),
  path.join(DIR, 'oxthhldvu5361.jpg'),
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
await page.goto(pathToFileURL(path.resolve('lab/lab.html')).href);

const blocks = [];
for (const mapPath of maps) {
  const url = pathToFileURL(mapPath).href;
  const res = await page.evaluate(async (url) => {
    const lab = window.__lab;
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    const t0 = performance.now();
    const grid = lab.detectGridFromImageData(imageData.data, w, h);
    const gridMs = performance.now() - t0;
    const size = grid ? grid.size : 75;
    const offsetX = grid ? grid.offsetX : 0;
    const offsetY = grid ? grid.offsetY : 0;
    const base = { size, offsetX, offsetY };

    // Даунскейл для скелета (медленный морфологический этап).
    const scale2 = Math.min(1, 1600 / Math.max(w, h));
    const w2 = Math.round(w * scale2);
    const h2 = Math.round(h * scale2);
    const canvas2 = document.createElement('canvas');
    canvas2.width = w2;
    canvas2.height = h2;
    const ctx2 = canvas2.getContext('2d', { willReadFrequently: true });
    ctx2.drawImage(img, 0, 0, w2, h2);
    const data2 = ctx2.getImageData(0, 0, w2, h2).data;

    const run = (name, fn) => {
      const t = performance.now();
      let walls = [];
      let error = null;
      try {
        walls = fn();
      } catch (e) {
        error = String(e);
      }
      return { name, ms: Math.round(performance.now() - t), walls, error };
    };

    const variants = [
      run('A: рёбра + глобальный Otsu (их подход)', () => lab.detectWalls(imageData.data, w, h, { ...base, edgeWidth: 6, darkRatio: 0.4, skip: 3 })),
      run('A++: контраст 55, толщина 3', () => lab.detectWallsLocal(imageData.data, w, h, { ...base, contrast: 55, ratio: 0.5, band: 10, skip: 2, minThickness: 3 })),
      run('A++: контраст 40, толщина 4', () => lab.detectWallsLocal(imageData.data, w, h, { ...base, contrast: 40, ratio: 0.45, band: 12, skip: 2, minThickness: 4 })),
      run('D: скелет (даунскейл 1600)', () => {
        const sk = lab.detectWallsSkeleton(data2, w2, h2, { size: size * scale2, offsetX: offsetX * scale2, offsetY: offsetY * scale2, minCells: 1, simplify: 3 });
        return sk.map((wall) => ({ ...wall, x1: wall.x1 / scale2, y1: wall.y1 / scale2, x2: wall.x2 / scale2, y2: wall.y2 / scale2 }));
      }),
      run('C: контуры скал (окно 31, c12)', () => lab.detectWallsContour(imageData.data, w, h, { c: 12, window: 31, minLen: 60, simplify: 4 })),
      run('C: контуры скал (окно 51, c16)', () => lab.detectWallsContour(imageData.data, w, h, { c: 16, window: 51, minLen: 70, simplify: 4 })),
    ];

    const overlay = (walls) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, w, h);
      g.strokeStyle = 'rgba(80,160,255,0.30)';
      g.lineWidth = 1;
      for (let cx = 0; cx <= Math.floor((w - offsetX) / size); cx++) {
        const x = offsetX + cx * size;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
      }
      for (let cy = 0; cy <= Math.floor((h - offsetY) / size); cy++) {
        const y = offsetY + cy * size;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      g.lineCap = 'round';
      for (const wall of walls) {
        g.strokeStyle = wall.kind === 'door' ? '#39d353' : '#ff3b3b';
        g.lineWidth = Math.max(3, size / 16);
        g.beginPath();
        g.moveTo(wall.x1, wall.y1);
        g.lineTo(wall.x2, wall.y2);
        g.stroke();
      }
      return c.toDataURL('image/png');
    };

    const results = variants.map((v) => {
      let len = 0;
      for (const wall of v.walls) len += Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
      return {
        name: v.name,
        ms: v.ms,
        error: v.error,
        walls: v.walls.filter((x) => x.kind === 'wall').length,
        doors: v.walls.filter((x) => x.kind === 'door').length,
        lenPx: Math.round(len),
        png: overlay(v.walls),
      };
    });
    return { w, h, grid, gridMs: Math.round(gridMs), fallback: !grid, results };
  }, url);

  const name = path.basename(mapPath, path.extname(mapPath));
  const mapBlock = {
    name,
    w: res.w,
    h: res.h,
    gridText: res.grid
      ? `сетка: ${Math.round(res.grid.size)}px, сдвиг (${Math.round(res.grid.offsetX)}, ${Math.round(res.grid.offsetY)}), уверенность ${(res.grid.confidence * 100).toFixed(0)}%`
      : 'сетка не найдена — использован размер 75px вручную',
    items: [],
  };
  for (const [i, r] of res.results.entries()) {
    const file = `${name}__v${i}.png`;
    fs.writeFileSync(path.join(OUT, file), Buffer.from(r.png.split(',')[1], 'base64'));
    mapBlock.items.push({
      label: r.name,
      file,
      stats: `${r.ms}мс · стен ${r.walls} · дверей ${r.doors} · длина ${r.lenPx}px${r.error ? ' · ERROR ' + r.error : ''}`,
    });
    console.log(`${name} | ${r.name} | ${r.ms}мс | стен ${r.walls} | дверей ${r.doors} | ${r.lenPx}px`);
  }
  blocks.push(mapBlock);
}

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Walls lab</title>
<style>
body{background:#151517;color:#e6e6e6;font-family:system-ui,Segoe UI,sans-serif;margin:16px}
h1{font-size:18px} h2{font-size:15px;margin:18px 0 6px;color:#9cf}
.map{display:flex;flex-wrap:wrap;gap:14px}
.item{width:520px} .item img{width:100%;border:1px solid #333;border-radius:6px;display:block}
.label{font-size:13px;font-weight:600;margin:4px 0 2px} .stats{font-size:12px;color:#9a9a9a;margin-bottom:10px}
</style></head><body>
<h1>Автопоиск стен — сравнение подходов</h1>
${blocks
  .map(
    (b) => `<h2>${b.name} (${b.w}x${b.h}) — ${b.gridText}</h2>
<div class="map">${b.items
      .map((it) => `<div class="item"><img src="${it.file}"><div class="label">${it.label}</div><div class="stats">${it.stats}</div></div>`)
      .join('')}</div>`
  )
  .join('\n')}
</body></html>`;

fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
console.log('HTML: ' + path.join(OUT, 'index.html'));
await browser.close();
await import('node:child_process').then(({ exec }) => exec(`start "" "${path.join(OUT, 'index.html')}"`));
