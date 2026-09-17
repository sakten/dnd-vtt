import { type LightAreaKind } from 'shared';
import { t } from '../i18n';
import { lightAreaLabel } from '../i18n/domain';
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
    <div className="fog-panel" data-testid="light-panel">
      <div className="fog-group">
        <span className="fog-label">{t('ui.light.kindLabel')}</span>
        {KINDS.map((k) => (
          <button key={k} className={lightMode.kind === k ? 'active' : ''} onClick={() => setLightMode({ kind: k })}>
            {lightAreaLabel(k)}
          </button>
        ))}
      </div>
      <div className="fog-group">
        <button
          title={t('ui.light.clearTitle')}
          disabled={!map?.lightAreas.length}
          onClick={() => {
            if (map) updateAreas(map.id, []);
          }}
        >
          {t('ui.common.clear')}
        </button>
      </div>
      <span className="fog-label">{t('ui.light.hint')}</span>
      <button onClick={() => setLightMode({ active: false })}>{t('ui.common.done')}</button>
    </div>
  );
}
