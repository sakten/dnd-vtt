import { useGameStore } from '../store/useGameStore';
import { activeMapOf } from '../store/selectors';

export default function WallsPanel() {
  const mode = useGameStore((s) => s.wallsMode);
  const setWallsMode = useGameStore((s) => s.setWallsMode);
  const updateWalls = useGameStore((s) => s.updateWalls);
  const map = useGameStore(activeMapOf);

  return (
    <div className="fog-panel">
      <div className="fog-group">
        <button className={mode.tool === 'wall' ? 'active' : ''} onClick={() => setWallsMode({ tool: 'wall' })}>
          Стена
        </button>
        <button className={mode.tool === 'door' ? 'active' : ''} onClick={() => setWallsMode({ tool: 'door' })}>
          Дверь
        </button>
      </div>
      <span className="fog-label">Клик по узлам — сегменты цепочкой; клик по двери — открыть/закрыть; ПКМ — удалить.</span>
      <button
        title="Убрать все стены на карте"
        onClick={() => {
          if (map) updateWalls(map.id, []);
        }}
      >
        Очистить
      </button>
      <button onClick={() => setWallsMode({ active: false })}>Готово</button>
    </div>
  );
}
