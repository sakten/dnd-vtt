import { useEffect, useState } from 'react';

export function useImage(url: string | undefined): HTMLImageElement | undefined {
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
      if (active) setImage(undefined);
    };
    el.src = url;
    return () => {
      active = false;
    };
  }, [url]);

  return image;
}
