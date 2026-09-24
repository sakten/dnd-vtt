import { detectGridFromImageData, type GridCandidate } from './gridDetect';
import { loadImageData } from './imageData';

/** Анализ картинки по URL: профили по полному разрешению (кап 4096px по длинной стороне). */
export async function detectGridFromUrl(url: string): Promise<GridCandidate | null> {
  const analysis = await loadImageData(url);
  if (!analysis) return null;
  const { data, width, height, scale } = analysis;
  const found = detectGridFromImageData(data, width, height);
  if (!found) return null;
  return {
    size: found.size / scale,
    offsetX: found.offsetX / scale,
    offsetY: found.offsetY / scale,
    confidence: found.confidence,
  };
}
