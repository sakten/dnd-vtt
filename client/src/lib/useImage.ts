import { useEffect, useState } from 'react';

export function useImage(url: string | undefined): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);

  useEffect(() => {
    if (!url) {
      setImage(undefined);
      return;
    }
    const el = new window.Image();
    el.onload = () => setImage(el);
    el.src = url;
  }, [url]);

  return image;
}
