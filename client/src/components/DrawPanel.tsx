import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { DRAW_COLORS } from '../store/slices/draw';

/** Панель рисования: палитра и подсказка; штрихи видны всем и гаснут через 10 с. */
export default function DrawPanel() {
  const color = useGameStore((s) => s.drawMode.color);
  const setDrawMode = useGameStore((s) => s.setDrawMode);

  return (
    <div className="draw-panel" data-testid="draw-panel">
      <span className="fog-label">{t('ui.draw.hint')}</span>
      <div className="draw-colors">
        {DRAW_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`draw-color${c.value === color ? ' active' : ''}`}
            style={{ background: c.value }}
            title={t(c.key)}
            aria-label={t(c.key)}
            onClick={() => setDrawMode({ color: c.value })}
          />
        ))}
      </div>
      <button onClick={() => setDrawMode({ active: false })}>{t('ui.common.done')}</button>
    </div>
  );
}
