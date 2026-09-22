import { useEffect, useState } from 'react';

/**
 * Ленивая загрузка картинки. `fallbackUrl` — если основной URL не загрузился
 * (например, у старой загрузки ещё нет webp-производной).
 */
export function useImage(url: string | undefined, fallbackUrl?: string): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);

  useEffect(() => {
    if (!url) {
      setImage(undefined);
      return;
    }
    let active = true;
    const el = new window.Image();
    el.onload = () => {
      if (active) setImage(el);
    };
    el.onerror = () => {
      if (!active) return;
      if (fallbackUrl && fallbackUrl !== url) {
        el.onerror = () => {
          if (active) setImage(undefined);
        };
        el.src = fallbackUrl;
        return;
      }
      setImage(undefined);
    };
    el.src = url;
    return () => {
      active = false;
    };
  }, [url, fallbackUrl]);

  return image;
}
