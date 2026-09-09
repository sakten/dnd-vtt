import { useGameStore } from '../store/useGameStore';

export default function FogPanel() {
  const fogMode = useGameStore((s) => s.fogMode);
  const setFogMode = useGameStore((s) => s.setFogMode);

  return (
    <div className="fog-panel">
      <div className="fog-group">
        <button
          className={fogMode.tool === 'brush' ? 'active' : ''}
          onClick={() => setFogMode({ tool: 'brush' })}
        >
          Кисть
        </button>
        <button
          className={fogMode.tool === 'rect' ? 'active' : ''}
          onClick={() => setFogMode({ tool: 'rect' })}
        >
          Прямоугольник
        </button>
      </div>
      <div className="fog-group">
        <button
          className={fogMode.action === 'hide' ? 'active' : ''}
          onClick={() => setFogMode({ action: 'hide' })}
        >
          Скрыть
        </button>
        <button
          className={fogMode.action === 'reveal' ? 'active' : ''}
          onClick={() => setFogMode({ action: 'reveal' })}
        >
          Открыть
        </button>
      </div>
      {fogMode.tool === 'brush' && (
        <div className="fog-group">
          <span className="fog-label">Кисть:</span>
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
      <button onClick={() => setFogMode({ active: false })}>Готово</button>
    </div>
  );
}
