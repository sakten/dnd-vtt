import { describe, expect, it, vi } from 'vitest';

describe('loadSpellIcons', () => {
  it('грузит карту иконок один раз и кэширует её', async () => {
    vi.resetModules();
    vi.doMock('../components/spellIcons', () => ({ SPELL_ICONS: { fireball: 'icon' } }));
    const { loadSpellIcons, spellIconsSync } = await import('./spellIcons');

    expect(spellIconsSync()).toBeNull();
    const first = await loadSpellIcons();
    expect(first.fireball).toBe('icon');
    expect(spellIconsSync()).toBe(first);
    expect(await loadSpellIcons()).toBe(first);
  });
});
