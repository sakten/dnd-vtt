import { describe, expect, it } from 'vitest';
import type { ZoneInstance } from 'shared';
import { zoneColor, zoneStyle } from './zoneRender';

function zone(patch: Partial<ZoneInstance>): ZoneInstance {
  return {
    id: 'z1',
    name: 'Zone',
    sourceKey: 'XPHB:Web',
    sourceId: 't1',
    origin: { x: 0, y: 0 },
    area: { shape: 'sphere', size: 20 },
    duration: { type: 'concentration' },
    ...patch,
  };
}

describe('zoneStyle', () => {
  it('магическая тьма и мгла — разные стили, оба отличимы от эффекта', () => {
    const dark = zoneStyle(zone({ flags: { blocksLight: true } }));
    const fog = zoneStyle(zone({ flags: { obscured: 'heavy' } }));
    const web = zoneStyle(zone({ flags: { difficultTerrain: true } }));

    expect(dark.kind).toBe('magical-darkness');
    expect(fog.kind).toBe('obscured');
    expect(web.kind).toBe('effect');
    expect(dark.fill).not.toBe(fog.fill);
    expect(dark.fillAlpha).not.toBe(fog.fillAlpha);
    expect(web.fill).toBe(zoneColor('XPHB:Web'));
  });

  it('обычная зона получает стабильный цвет по sourceKey', () => {
    expect(zoneStyle(zone({ sourceKey: 'a' })).fill).toBe(zoneStyle(zone({ sourceKey: 'a' })).fill);
  });
});
