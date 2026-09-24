export interface ImageAnalysis {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Масштаб относительно исходного изображения (кап 4096px по длинной стороне). */
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

/** Пиксели картинки по URL (кап 4096px по длинной стороне) для автодетекта сетки и стен. */
export async function loadImageData(url: string): Promise<ImageAnalysis | null> {
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
