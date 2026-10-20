import { useEffect, useState } from 'react';

/**
 * Ленивая загрузка картинки с общим кэшем по URL: одинаковые токены/миниатюры
 * не декодируются по разу на каждый компонент. Крупные карты (карта стола) не
 * кэшируем, чтобы не держать десятки мегабайт декодированных пикселей.
 * `fallbackUrl` — если основной URL не загрузился (например, у старой загрузки
 * ещё нет webp-производной).
 */
const MAX_CACHED = 64;
const MAX_CACHED_PIXELS = 256 * 256;

const loaded = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement>>();

function remember(url: string, image: HTMLImageElement): void {
  if (image.naturalWidth * image.naturalHeight > MAX_CACHED_PIXELS) return;
  loaded.set(url, image);
  if (loaded.size > MAX_CACHED) {
    const oldest = loaded.keys().next().value;
    if (oldest !== undefined) loaded.delete(oldest);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = loaded.get(url);
  if (cached) return Promise.resolve(cached);
  const pending = loading.get(url);
  if (pending) return pending;
  const task = new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => {
      remember(url, el);
      resolve(el);
    };
    el.onerror = () => reject(new Error(`image load failed: ${url}`));
    el.src = url;
  }).finally(() => loading.delete(url));
  loading.set(url, task);
  return task;
}

interface Entry {
  url: string;
  image: HTMLImageElement;
}

export function useImage(url: string | undefined, fallbackUrl?: string): HTMLImageElement | undefined {
  const [entry, setEntry] = useState<Entry | undefined>(() => {
    if (!url) return undefined;
    const image = loaded.get(url);
    return image ? { url, image } : undefined;
  });

  useEffect(() => {
    if (!url) {
      setEntry(undefined);
      return;
    }
    const cached = loaded.get(url);
    if (cached) {
      setEntry({ url, image: cached });
      return;
    }
    let active = true;
    // Смена URL: старую картинку не показываем (иначе на столе остаётся
    // растянутая предыдущая карта, пока грузится новая).
    setEntry(undefined);
    const apply = (image: HTMLImageElement) => {
      if (active) setEntry({ url, image });
    };
    const fail = () => {
      if (active) setEntry(undefined);
    };
    loadImage(url).then(apply, () => {
      if (!active) return;
      if (fallbackUrl && fallbackUrl !== url) loadImage(fallbackUrl).then(apply, fail);
      else fail();
    });
    return () => {
      active = false;
    };
  }, [url, fallbackUrl]);

  if (!url) return undefined;
  if (entry?.url !== url) {
    // Кэшированная миниатюра доступна сразу, без кадра с пустым столом.
    return loaded.get(url);
  }
  return entry.image;
}
