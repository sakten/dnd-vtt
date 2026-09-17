import { useGameStore } from '../store/useGameStore';
import { activeMapOf } from '../store/selectors';
import { useIsDm, useIsRealDm } from '../lib/control';

export default function Toolbar() {
  const setGridModalOpen = useGameStore((s) => s.setGridModalOpen);
  const setRoomSettingsOpen = useGameStore((s) => s.setRoomSettingsOpen);
  const fitView = useGameStore((s) => s.fitView);
  const isRealDm = useIsRealDm();
  const isDm = useIsDm();
  const fogActive = useGameStore((s) => s.fogMode.active);
  const setFogMode = useGameStore((s) => s.setFogMode);
  const wallsActive = useGameStore((s) => s.wallsMode.active);
  const setWallsMode = useGameStore((s) => s.setWallsMode);
  const lightActive = useGameStore((s) => s.lightMode.active);
  const setLightMode = useGameStore((s) => s.setLightMode);
  const setVisionModalOpen = useGameStore((s) => s.setVisionModalOpen);
  const combatActive = useGameStore((s) => activeMapOf(s)?.combat.active ?? false);
  const startCombat = useGameStore((s) => s.startCombat);
  const endCombat = useGameStore((s) => s.endCombat);
  const hasMap = useGameStore((s) => activeMapOf(s) !== null);

  return (
    <div className="toolbar" data-testid="toolbar">
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
          onClick={() => {
            setFogMode({ active: !fogActive });
            if (!fogActive) {
              setWallsMode({ active: false });
              setLightMode({ active: false });
            }
          }}
        >
          Туман
        </button>
      )}
      {isDm && (
        <button
          className={wallsActive ? 'active' : ''}
          title="Стены: клик по узлам — сегменты, ПКМ по пустому месту — завершить цепочку, ПКМ по сегменту — удалить"
          onClick={() => {
            setWallsMode({ active: !wallsActive });
            if (!wallsActive) {
              setFogMode({ active: false });
              setLightMode({ active: false });
            }
          }}
        >
          Стены
        </button>
      )}
      {isDm && (
        <button
          className={lightActive ? 'active' : ''}
          title="Области тьмы, магической тьмы и мглы"
          onClick={() => {
            setLightMode({ active: !lightActive });
            if (!lightActive) {
              setFogMode({ active: false });
              setWallsMode({ active: false });
            }
          }}
        >
          Тьма
        </button>
      )}
      {isDm && (
        <button title="Обзор: туман видимости и темнота на карте" onClick={() => setVisionModalOpen(true)}>
          Обзор
        </button>
      )}
      {isRealDm && (
        <button title="Настройки комнаты" onClick={() => setRoomSettingsOpen(true)}>
          Комната
        </button>
      )}
    </div>
  );
}
