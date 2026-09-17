import { useGameStore } from '../store/useGameStore';
import { activeMapOf } from '../store/selectors';
import { useIsDm, useIsRealDm } from '../lib/control';
import { t } from '../i18n';

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
      <button onClick={() => setGridModalOpen(true)}>{t('ui.toolbar.grid')}</button>
      <button onClick={fitView} disabled={!hasMap}>
        {t('ui.toolbar.fit')}
      </button>
      {isDm && (
        <button
          className={combatActive ? 'active' : ''}
          title={t('ui.toolbar.combatTitle')}
          onClick={() => (combatActive ? endCombat() : startCombat())}
        >
          {combatActive ? t('ui.toolbar.combatEnd') : t('ui.toolbar.combat')}
        </button>
      )}
      {isDm && (
        <button
          className={fogActive ? 'active' : ''}
          title={t('ui.toolbar.fogTitle')}
          onClick={() => {
            setFogMode({ active: !fogActive });
            if (!fogActive) {
              setWallsMode({ active: false });
              setLightMode({ active: false });
            }
          }}
        >
          {t('ui.toolbar.fog')}
        </button>
      )}
      {isDm && (
        <button
          className={wallsActive ? 'active' : ''}
          title={t('ui.toolbar.wallsTitle')}
          onClick={() => {
            setWallsMode({ active: !wallsActive });
            if (!wallsActive) {
              setFogMode({ active: false });
              setLightMode({ active: false });
            }
          }}
        >
          {t('ui.toolbar.walls')}
        </button>
      )}
      {isDm && (
        <button
          className={lightActive ? 'active' : ''}
          title={t('ui.toolbar.lightTitle')}
          onClick={() => {
            setLightMode({ active: !lightActive });
            if (!lightActive) {
              setFogMode({ active: false });
              setWallsMode({ active: false });
            }
          }}
        >
          {t('ui.toolbar.light')}
        </button>
      )}
      {isDm && (
        <button title={t('ui.toolbar.visionTitle')} onClick={() => setVisionModalOpen(true)}>
          {t('ui.toolbar.vision')}
        </button>
      )}
      {isRealDm && (
        <button title={t('ui.toolbar.roomTitle')} onClick={() => setRoomSettingsOpen(true)}>
          {t('ui.toolbar.room')}
        </button>
      )}
    </div>
  );
}
