import { describe, expect, it } from 'vitest';
import { screenUrl, thumbUrl, tokenImageUrl } from './imageVariants';

describe('производные загруженных картинок', () => {
  it('даёт миниатюру, токен и превью карты', () => {
    expect(thumbUrl('/uploads/ROOM/a.png')).toBe('/uploads/ROOM/a.png.thumb.webp');
    expect(tokenImageUrl('/uploads/ROOM/a.png')).toBe('/uploads/ROOM/a.png.token.webp');
    expect(screenUrl('/uploads/ROOM/a.png')).toBe('/uploads/ROOM/a.png.screen.webp');
  });

  it('готовую производную и внешний URL не трогает', () => {
    expect(screenUrl('/uploads/ROOM/a.png.screen.webp')).toBe('/uploads/ROOM/a.png.screen.webp');
    expect(screenUrl('/uploads/ROOM/a.png.thumb.webp')).toBe('/uploads/ROOM/a.png.thumb.webp');
    expect(screenUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(screenUrl(undefined)).toBeUndefined();
    expect(screenUrl(null)).toBeUndefined();
  });
});
