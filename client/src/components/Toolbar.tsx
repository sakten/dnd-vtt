import { useGameStore } from '../store/useGameStore';
import { activeMapOf } from '../store/selectors';
import { useIsDm } from '../lib/control';

export default function Toolbar() {
  const setGridModalOpen = useGameStore((s) => s.setGridModalOpen);
  const setRoomSettingsOpen = useGameStore((s) => s.setRoomSettingsOpen);
  const fitView = useGameStore((s) => s.fitView);
  const role = useGameStore((s) => s.role);
  const isDm = useIsDm();
  const fogActive = useGameStore((s) => s.fogMode.active);
  const setFogMode = useGameStore((s) => s.setFogMode);
  const combatActive = useGameStore((s) => activeMapOf(s)?.combat.active ?? false);
  const startCombat = useGameStore((s) => s.startCombat);
  const endCombat = useGameStore((s) => s.endCombat);
  const hasMap = useGameStore((s) => activeMapOf(s) !== null);

  return (
    <div className="toolbar">
      <button onClick={() => setGridModalOpen(true)}>Сетка</button>
      <button onClick={fitView} disabled={!hasMap}>
        По размеру
      </button>
      {isDm && (
        <button
          className={combatActive ? 'active' : ''}
          title="Начать или закончить бой"
          onClick={() => (combatActive ? endCombat() : startCombat())}
        >
          {combatActive ? 'Конец боя' : 'Бой'}
        </button>
      )}
      {isDm && (
        <button
          className={fogActive ? 'active' : ''}
          title="Туман войны"
          onClick={() => setFogMode({ active: !fogActive })}
        >
          Туман
        </button>
      )}
      {role === 'dm' && (
        <button title="Настройки комнаты" onClick={() => setRoomSettingsOpen(true)}>
          Комната
        </button>
      )}
    </div>
  );
}
