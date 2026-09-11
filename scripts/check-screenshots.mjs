import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.resolve('artifacts/e2e');
const RUN_MARKER = path.join(OUT, '.run');
if (!fs.existsSync(RUN_MARKER)) {
  throw new Error(`нет отметки запуска e2e (${RUN_MARKER}) — сначала выполните npm run e2e`);
}
const parsedRun = Number(fs.readFileSync(RUN_MARKER, 'utf8'));
const runStartedAt = Number.isFinite(parsedRun) ? parsedRun : fs.statSync(RUN_MARKER).mtimeMs;
const STALE_SLACK_MS = 1000;

function decodePng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`не PNG: ${file}`);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (colorType !== 6 && colorType !== 2) throw new Error(`неподдерживаемый colorType ${colorType} в ${file}`);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const rowIn = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const rowOut = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? rowOut[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = rowIn[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += Math.floor((a + b) / 2);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      rowOut[x] = v & 0xff;
    }
  }
  return {
    width,
    height,
    pixel(x, y) {
      const o = (y * width + x) * bpp;
      return [out[o], out[o + 1], out[o + 2], bpp === 4 ? out[o + 3] : 255];
    },
  };
}

let ok = true;
const check = (cond, label) => {
  console.log(cond ? 'PASS' : 'FAIL', '-', label);
  if (!cond) ok = false;
};

function near(px, r, g, b, tol) {
  return Math.abs(px[0] - r) <= tol && Math.abs(px[1] - g) <= tol && Math.abs(px[2] - b) <= tol;
}

function countIn(img, pred, x0, y0, x1, y1, step = 4) {
  let n = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      if (pred(img.pixel(x, y))) n++;
    }
  }
  return n;
}

function centroidIn(img, pred, x0, y0, x1, y1) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      if (pred(img.pixel(x, y))) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  return n === 0 ? null : { x: sx / n, y: sy / n, n };
}

const files = ['01-join', '02-empty-table', '03-map', '04-grid-modal', '05-library', '07-token', '09-token-moved', '10-zoom', '12-player'];
const imgs = {};
for (const f of files) {
  const p = path.join(OUT, `${f}.png`);
  if (!fs.existsSync(p)) throw new Error(`нет файла ${p}`);
  if (fs.statSync(p).mtimeMs + STALE_SLACK_MS < runStartedAt) {
    throw new Error(`устаревший скриншот ${f}.png — перезапустите npm run e2e`);
  }
  imgs[f] = decodePng(p);
}

const join = imgs['01-join'];
const corners = [
  join.pixel(10, 10),
  join.pixel(join.width - 10, 10),
  join.pixel(10, join.height - 10),
  join.pixel(join.width - 10, join.height - 10),
];
const cornerDark = corners.every((c) => c[0] < 70 && c[1] < 70 && c[2] < 70);
check(cornerDark, '01-join: тёмный фон по углам');
const cardPoints = [join.pixel(720, 300), join.pixel(720, 450), join.pixel(720, 600)];
const cardLit = cardPoints.filter((p) => p[0] > 25 && p[0] < 200 && p[1] > 25 && p[1] < 200 && p[2] > 25).length;
check(cardLit >= 2, '01-join: светлая карточка по центру');

const empty = imgs['02-empty-table'];
check(near(empty.pixel(30, 30), 35, 39, 47, 25), '02-table: панель тулбара слева сверху');
check(near(empty.pixel(1380, 450), 35, 39, 47, 25), '02-table: панель чата справа');
check(near(empty.pixel(60, 860), 35, 39, 47, 25), '02-table: панель токенов слева снизу');

const map = imgs['03-map'];
const full = (img) => [0, 0, img.width, img.height];
const green = countIn(map, (p) => near(p, 90, 160, 90, 30), ...full(map));
const gray = countIn(map, (p) => near(p, 46, 52, 64, 10), ...full(map));
const lightLines = countIn(map, (p) => p[0] > 100 && p[1] > 100 && p[2] > 100, ...full(map));
check(green > 300, `03-map: зелёная рамка карты (${green} сэмплов)`);
check(gray > 10000, `03-map: тело карты (${gray} сэмплов)`);
check(lightLines > 1500, `03-map: светлая сетка поверх карты (${lightLines} сэмплов)`);

const modal = imgs['04-grid-modal'];
check(near(modal.pixel(720, 450), 35, 39, 47, 25), '04-modal: окно настроек по центру');

const library = imgs['05-library'];
const libRed = countIn(library, (p) => p[0] > 150 && p[1] < 100 && p[2] < 100, ...full(library));
check(libRed > 30, `05-library: красная миниатюра токена в библиотеке (${libRed} сэмплов)`);

const token = imgs['07-token'];
const redPred = (p) => p[0] > 150 && p[1] < 100 && p[2] < 100;
const tokenC = centroidIn(token, redPred, 300, 100, 1100, 750);
check(tokenC && tokenC.n > 50, `07-token: красный токен на карте (${tokenC?.n ?? 0} сэмплов)`);
check(tokenC && Math.abs(tokenC.x - token.width / 2) < 150 && Math.abs(tokenC.y - token.height / 2) < 150, '07-token: токен в центре карты');

const moved = imgs['09-token-moved'];
const movedC = centroidIn(moved, redPred, 300, 100, 1100, 750);
check(movedC && tokenC && movedC.x > tokenC.x + 60 && movedC.y > tokenC.y + 40, `09-moved: токен сдвинут вправо-вниз (центр ${tokenC.x.toFixed(0)},${tokenC.y.toFixed(0)} -> ${movedC.x.toFixed(0)},${movedC.y.toFixed(0)})`);

const zoom = imgs['10-zoom'];
const zoomGray = countIn(zoom, (p) => near(p, 46, 52, 64, 10), ...full(zoom));
check(zoomGray > gray * 1.05, `10-zoom: карта крупнее (серых сэмплов ${gray} -> ${zoomGray})`);

const player = imgs['12-player'];
const playerRed = countIn(player, redPred, ...full(player));
check(playerRed > 30, `12-player: игрок видит токен (${playerRed} сэмплов)`);
check(near(player.pixel(1380, 450), 35, 39, 47, 25), '12-player: панель чата у игрока справа');

console.log(ok ? 'SCREENSHOTS OK' : 'SCREENSHOTS FAILED');
process.exit(ok ? 0 : 1);
