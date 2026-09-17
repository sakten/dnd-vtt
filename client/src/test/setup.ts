import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { setLocale } from '../i18n';

try {
  localStorage.setItem('vtt-lang', 'ru');
} catch {
  void 0;
}
setLocale('ru');

afterEach(() => cleanup());
