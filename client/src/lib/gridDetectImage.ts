import { detectGridFromImageData, type GridCandidate } from './gridDetect';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('image load failed'));
    el.src = url;
  });
}

/** Анализ картинки по URL: профили по полному разрешению (кап 4096px по длинной стороне). */
export async function detectGridFromUrl(url: string): Promise<GridCandidate | null> {
  const img = await loadImage(url);
  const scale = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const found = detectGridFromImageData(data, w, h);
  if (!found) return null;
  return {
    size: found.size / scale,
    offsetX: found.offsetX / scale,
    offsetY: found.offsetY / scale,
    confidence: found.confidence,
  };
}
