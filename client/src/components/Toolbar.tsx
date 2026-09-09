import { useGameStore } from '../store/useGameStore';

export default function Toolbar() {
  const setGridModalOpen = useGameStore((s) => s.setGridModalOpen);
  const fitView = useGameStore((s) => s.fitView);
  const role = useGameStore((s) => s.role);
  const fogActive = useGameStore((s) => s.fogMode.active);
  const setFogMode = useGameStore((s) => s.setFogMode);
  const hasMap = useGameStore((s) => s.scene.maps.some((m) => m.id === s.viewMapId));

  return (
    <div className="toolbar">
      <button onClick={() => setGridModalOpen(true)}>Сетка</button>
      <button onClick={fitView} disabled={!hasMap}>
        По размеру
      </button>
      {role === 'dm' && (
        <button
          className={fogActive ? 'active' : ''}
          title="Туман войны"
          onClick={() => setFogMode({ active: !fogActive })}
        >
          Туман
        </button>
      )}
    </div>
  );
}
