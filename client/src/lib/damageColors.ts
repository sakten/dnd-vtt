/** Цвета типов урона: общие для чата и FX-эффектов. */
const TYPE_COLORS: Record<string, string> = {
  fire: '#ff8a2b',
  cold: '#7fd4ff',
  lightning: '#ffe86b',
  acid: '#9bea3a',
  poison: '#7cd06a',
  necrotic: '#a06bff',
  radiant: '#ffe6a3',
  force: '#8fb7ff',
  thunder: '#dbe9ff',
  psychic: '#ff7fd0',
  bludgeoning: '#c9b8a3',
  piercing: '#d9d9d9',
  slashing: '#e0a0a0',
};

/** Нейтральный «магический» цвет (нет типа/неизвестный). */
export const ARCANE_COLOR = '#8fb7ff';

export function damageTypeColor(type: string | undefined): string | undefined {
  return type ? TYPE_COLORS[type] : undefined;
}
