import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';

export default function FogPanel() {
  const fogMode = useGameStore((s) => s.fogMode);
  const setFogMode = useGameStore((s) => s.setFogMode);

  return (
    <div className="fog-panel" data-testid="fog-panel">
      <div className="fog-group" data-testid="fog-group">
        <button
          className={fogMode.tool === 'brush' ? 'active' : ''}
          onClick={() => setFogMode({ tool: 'brush' })}
        >
          {t('ui.fog.brush')}
        </button>
        <button
          className={fogMode.tool === 'rect' ? 'active' : ''}
          onClick={() => setFogMode({ tool: 'rect' })}
        >
          {t('ui.fog.rect')}
        </button>
      </div>
      <div className="fog-group" data-testid="fog-group">
        <button
          className={fogMode.action === 'hide' ? 'active' : ''}
          onClick={() => setFogMode({ action: 'hide' })}
        >
          {t('ui.fog.hide')}
        </button>
        <button
          className={fogMode.action === 'reveal' ? 'active' : ''}
          onClick={() => setFogMode({ action: 'reveal' })}
        >
          {t('ui.fog.reveal')}
        </button>
      </div>
      {fogMode.tool === 'brush' && (
        <div className="fog-group" data-testid="fog-group">
          <span className="fog-label">{t('ui.fog.brushLabel')}</span>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className={fogMode.brush === n ? 'active' : ''}
              onClick={() => setFogMode({ brush: n })}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setFogMode({ active: false })}>{t('ui.common.done')}</button>
    </div>
  );
}
