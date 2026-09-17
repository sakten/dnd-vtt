import { describe, expect, it } from 'vitest';
import { detectLang, interpolate, plural, setLocale, t } from './index';

describe('i18n', () => {
  it('detectLang: приоритет ?lang= → localStorage → navigator', () => {
    expect(detectLang({ search: '?lang=en', stored: 'ru', navigator: 'ru-RU' })).toBe('en');
    expect(detectLang({ search: '?room=X', stored: 'en', navigator: 'ru-RU' })).toBe('en');
    expect(detectLang({ search: '?lang=de', stored: null, navigator: 'ru-RU' })).toBe('ru');
  });

  it('detectLang: en* → en, остальное → ru', () => {
    expect(detectLang({ search: '', stored: null, navigator: 'en-US' })).toBe('en');
    expect(detectLang({ search: '', stored: null, navigator: 'de-DE' })).toBe('ru');
    expect(detectLang({ search: '', stored: null, navigator: '' })).toBe('ru');
  });

  it('t: перевод, смена локали, fallback на ключ', () => {
    setLocale('ru');
    expect(t('ui.language')).toBe('Язык интерфейса');
    setLocale('en');
    expect(t('ui.language')).toBe('Interface language');
    expect((t as (key: string) => string)('nope')).toBe('nope');
    setLocale('ru');
  });

  it('interpolate: подстановка параметров', () => {
    expect(interpolate('{a} и {b}', { a: 1, b: 'х' })).toBe('1 и х');
    expect(interpolate('без параметров')).toBe('без параметров');
  });

  it('plural: русские и английские формы', () => {
    setLocale('ru');
    const forms = { one: 'фут', few: 'фута', many: 'футов' };
    expect([1, 2, 5, 11, 21].map((n) => plural(n, forms))).toEqual(['фут', 'фута', 'футов', 'футов', 'фут']);
    setLocale('en');
    expect(plural(1, forms)).toBe('фут');
    expect(plural(2, forms)).toBe('футов');
    setLocale('ru');
  });
});
