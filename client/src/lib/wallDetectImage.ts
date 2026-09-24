import type { Wall } from 'shared';
import { loadImageData, type ImageAnalysis } from './imageData';
import { detectWalls, type WallDetectParams } from './wallDetect';

export type WallAnalysis = ImageAnalysis;

/** Загрузка картинки для анализа (кап 4096px по длинной стороне). */
export async function loadWallAnalysis(url: string): Promise<WallAnalysis | null> {
  return loadImageData(url);
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
