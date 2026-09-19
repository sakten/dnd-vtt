import * as THREE from 'three';

export function canvasTexture(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  return new THREE.CanvasTexture(canvas);
}

/** Свечение (ядро снаряда/вспышка). */
export const glowTex = canvasTexture((ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.32, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});

/** Конус 53°: вершина слева по центру, раскрыв на весь правый край (длина = ширине). */
export const coneTex = canvasTexture((ctx) => {
  const g = ctx.createRadialGradient(0, 64, 0, 0, 64, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0.4)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(128, 0);
  ctx.lineTo(128, 128);
  ctx.closePath();
  ctx.fill();
});

/** Язык пламени: вытянутая капля (для конусов — волна языков). */
export const tongueTex = canvasTexture((ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(64, 64, 28, 60, 0, 0, Math.PI * 2);
  ctx.fill();
});
