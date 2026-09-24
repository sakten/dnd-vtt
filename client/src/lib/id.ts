/**
 * UUID v4 с fallback для небезопасного контекста — общая реализация в `shared`
 * (`crypto.randomUUID` → `getRandomValues` → счётчик).
 */
export { newId } from 'shared';
