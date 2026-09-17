import { describe, expect, it } from 'vitest';
import { setLocale } from './index';
import { systemText } from './system';

describe('i18n system', () => {
  it('структурные системные сообщения рендерятся в RU', () => {
    setLocale('ru');
    expect(systemText({ system: { code: 'misdirect.hit', params: { name: 'Гоблин' } } })).toBe(
      'Гоблин: образ принял удар'
    );
    expect(systemText({ system: { code: 'room.joined', params: { name: 'Виктор' } } })).toBe('Виктор вошёл в комнату');
    expect(
      systemText({
        system: { code: 'conditions.ended', params: { name: 'Гоблин', condition: 'stunned', label: 'Ошеломлён' } },
      })
    ).toBe('Гоблин: состояние «Ошеломлён» окончено');
    expect(
      systemText({ system: { code: 'spells.resistance', params: { name: 'Маг', spell: 'Щит', type: 'fire' } } })
    ).toBe('Маг: Щит — сопротивление (Огонь)');
    expect(
      systemText({
        system: { code: 'reactions.opportunityError', params: { name: 'Орк', error: 'attackOutOfReach', feet: 10 } },
      })
    ).toBe('Орк: Вне досягаемости: 10 фт');
    expect(
      systemText({
        system: {
          code: 'automation.manualLevel',
          params: { name: 'Маг', feature: 'Огненный шар', level: 3, detail: '\nОгонь бьёт по площади' },
        },
      })
    ).toBe('Маг: Огненный шар (3 круг)\nОгонь бьёт по площади');
  });

  it('custom-состояние использует переданное имя как fallback', () => {
    setLocale('ru');
    expect(
      systemText({ system: { code: 'conditions.ended', params: { name: 'X', condition: 'custom', label: 'Моё состояние' } } })
    ).toBe('X: состояние «Моё состояние» окончено');
  });

  it('legacy-сообщение без system отдаёт text', () => {
    setLocale('ru');
    expect(systemText({ text: 'старое сообщение' })).toBe('старое сообщение');
    expect(systemText({})).toBe('');
  });

  it('EN: перевод ключа и параметров-меток', () => {
    setLocale('en');
    expect(systemText({ system: { code: 'misdirect.hit', params: { name: 'Goblin' } } })).toBe(
      'Goblin: an image took the hit'
    );
    expect(
      systemText({ system: { code: 'spells.resistance', params: { name: 'Mage', spell: 'Shield', type: 'fire' } } })
    ).toBe('Mage: Shield — resistance (Fire)');
    setLocale('ru');
  });
});
