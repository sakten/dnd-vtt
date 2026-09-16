import { LIGHT_AREA_NAMES, type LightAreaKind } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { activeMapOf } from '../store/selectors';

const KINDS: LightAreaKind[] = ['darkness', 'magical', 'obscured'];

/** Панель областей тьмы/магической тьмы/мглы (DM): вид и рисование прямоугольником. */
export default function LightPanel() {
  const lightMode = useGameStore((s) => s.lightMode);
  const setLightMode = useGameStore((s) => s.setLightMode);
  const updateAreas = useGameStore((s) => s.updateAreas);
  const map = useGameStore(activeMapOf);

  return (
    <div className="fog-panel">
      <div className="fog-group">
        <span className="fog-label">Вид:</span>
        {KINDS.map((k) => (
          <button key={k} className={lightMode.kind === k ? 'active' : ''} onClick={() => setLightMode({ kind: k })}>
            {LIGHT_AREA_NAMES[k]}
          </button>
        ))}
      </div>
      <div className="fog-group">
        <button
          title="Убрать все области этой карты"
          disabled={!map?.lightAreas.length}
          onClick={() => {
            if (map) updateAreas(map.id, []);
          }}
        >
          Очистить
        </button>
      </div>
      <span className="fog-label">Протяни прямоугольник по узлам сетки; ПКМ — удалить область.</span>
      <button onClick={() => setLightMode({ active: false })}>Готово</button>
    </div>
  );
}
