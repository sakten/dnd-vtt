import type Konva from 'konva';

export interface TextureCell {
  key: string;
  x: number;
  y: number;
  size: number;
}

/** Детерминированный 0..1 по строке/индексу: текстура стабильна между кадрами. */
function jitter(seed: string, index: number): number {
  let h = 2166136261 ^ (index + 1);
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 997) / 997;
}

/** Языки пламени: тёмное основание + три языка (оранжевые, жёлтая сердцевина). */
function drawFire(ctx: Konva.Context, x: number, y: number, s: number, seed: string): void {
  ctx.fillStyle = '#7f1d1d';
  ctx.globalAlpha *= 0.55;
  ctx.fillRect(x, y + s * 0.72, s, s * 0.28);
  ctx.globalAlpha /= 0.55;
  for (let i = 0; i < 3; i++) {
    const cx = x + s * (0.2 + 0.3 * i) + s * 0.1 * jitter(seed, i);
    const top = y + s * (0.18 + 0.22 * jitter(seed, i + 10));
    ctx.fillStyle = i === 1 ? '#fbbf24' : '#f97316';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.14, y + s * 0.95);
    ctx.quadraticCurveTo(cx - s * 0.2, y + s * 0.55, cx, top);
    ctx.quadraticCurveTo(cx + s * 0.2, y + s * 0.55, cx + s * 0.14, y + s * 0.95);
    ctx.closePath();
    ctx.fill();
  }
}

/** Шипы: тёмно-зелёные stems и светлые колючки. */
function drawThorns(ctx: Konva.Context, x: number, y: number, s: number, seed: string): void {
  ctx.strokeStyle = '#166534';
  ctx.lineWidth = Math.max(1.5, s * 0.05);
  for (let i = 0; i < 3; i++) {
    const y1 = y + s * (0.2 + 0.3 * i);
    ctx.beginPath();
    ctx.moveTo(x, y1 + s * 0.1 * (jitter(seed, i) - 0.5));
    ctx.quadraticCurveTo(x + s * 0.5, y1 + s * (jitter(seed, i + 5) - 0.5) * 0.3, x + s, y1);
    ctx.stroke();
  }
  ctx.fillStyle = '#86efac';
  for (let i = 0; i < 6; i++) {
    const cx = x + s * (0.15 + 0.7 * jitter(seed, i + 20));
    const cy = y + s * (0.15 + 0.7 * jitter(seed, i + 30));
    const d = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(cx, cy - d);
    ctx.lineTo(cx - d, cy + d);
    ctx.lineTo(cx + d, cy + d);
    ctx.closePath();
    ctx.fill();
  }
}

/** Клинки: диагональные серебристые полосы с тёмной кромкой. */
function drawBlades(ctx: Konva.Context, x: number, y: number, s: number, seed: string): void {
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.lineWidth = Math.max(2, s * 0.07);
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * s * 0.28 + s * 0.05 * (jitter(seed, i) - 0.5);
    const len = s * (0.6 + 0.3 * jitter(seed, i + 5));
    ctx.strokeStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(-len / 2, off + 1.5);
    ctx.lineTo(len / 2, off + 1.5);
    ctx.stroke();
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(-len / 2, off);
    ctx.lineTo(len / 2, off);
    ctx.stroke();
  }
  ctx.restore();
}

/** Песок: тёмная основа, завихрения и светлые песчинки. */
function drawSand(ctx: Konva.Context, x: number, y: number, s: number, seed: string): void {
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = Math.max(1, s * 0.04);
  for (let i = 0; i < 3; i++) {
    const y1 = y + s * (0.2 + 0.3 * i);
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.bezierCurveTo(x + s * 0.3, y1 - s * 0.12, x + s * 0.6, y1 + s * 0.12, x + s, y1);
    ctx.stroke();
  }
  ctx.fillStyle = '#fde68a';
  for (let i = 0; i < 10; i++) {
    const cx = x + s * jitter(seed, i + 40);
    const cy = y + s * jitter(seed, i + 60);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.8, s * 0.015), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Процедурные текстуры стен (огонь, шипы, клинки, песок): рисуются поверх заливки
 * клеток зоны. Без ассетов и без рандома рантайма — детерминированно по ключу клетки.
 */
export function drawZoneTexture(
  ctx: Konva.Context,
  texture: 'fire' | 'thorns' | 'blades' | 'sand',
  cells: TextureCell[],
  alpha = 0.75
): void {
  ctx.save();
  for (const cell of cells) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cell.x, cell.y, cell.size, cell.size);
    ctx.clip();
    ctx.globalAlpha = alpha;
    if (texture === 'fire') drawFire(ctx, cell.x, cell.y, cell.size, cell.key);
    else if (texture === 'thorns') drawThorns(ctx, cell.x, cell.y, cell.size, cell.key);
    else if (texture === 'blades') drawBlades(ctx, cell.x, cell.y, cell.size, cell.key);
    else drawSand(ctx, cell.x, cell.y, cell.size, cell.key);
    ctx.restore();
  }
  ctx.restore();
}
