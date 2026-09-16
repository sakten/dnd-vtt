import type { Wall } from 'shared';
import { detectWalls, type WallDetectParams } from './wallDetect';

export interface WallAnalysis {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  scale: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('image load failed'));
    el.src = url;
  });
}

/** Загрузка картинки для анализа (кап 4096px по длинной стороне). */
export async function loadWallAnalysis(url: string): Promise<WallAnalysis | null> {
  const img = await loadImage(url);
  const scale = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { data, width, height, scale };
}

/** Детект стен на загруженном анализе; параметры сетки — в пикселях карты. */
export function detectWallsInAnalysis(
  analysis: WallAnalysis,
  params: Omit<WallDetectParams, 'size' | 'offsetX' | 'offsetY'> & { size: number; offsetX: number; offsetY: number }
): Wall[] {
  const { scale } = analysis;
  const scaled: WallDetectParams = {
    ...params,
    size: params.size * scale,
    offsetX: params.offsetX * scale,
    offsetY: params.offsetY * scale,
    skip: params.skip != null ? params.skip * scale : undefined,
    margin: params.margin != null ? params.margin * scale : undefined,
    minThickness: params.minThickness != null ? Math.max(2, Math.round(params.minThickness * scale)) : undefined,
  };
  const found = detectWalls(analysis.data, analysis.width, analysis.height, scaled);
  return found.map((wall) => ({
    ...wall,
    x1: wall.x1 / scale,
    y1: wall.y1 / scale,
    x2: wall.x2 / scale,
    y2: wall.y2 / scale,
  }));
}
