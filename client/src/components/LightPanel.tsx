import { type LightAreaKind } from 'shared';
import { t } from '../i18n';
import { lightAreaLabel } from '../i18n/domain';
import { useGameStore } from '../store/useGameStore';
import { activeMapOf } from '../store/selectors';

const KINDS: LightAreaKind[] = ['darkness', 'magical', 'obscured'];

/** Готовые источники света: яркий/сумеречный радиус в футах и цвет ореола. */
const PRESETS = [
  { key: 'candle', label: 'ui.light.candle' as const, bright: 5, dim: 5, color: '#ffc978' },
  { key: 'torch', label: 'ui.light.torch' as const, bright: 20, dim: 20, color: '#ffab4a' },
  { key: 'lantern', label: 'ui.light.lantern' as const, bright: 30, dim: 30, color: '#ffd479' },
  { key: 'campfire', label: 'ui.light.campfire' as const, bright: 30, dim: 30, color: '#ff8a3d' },
];

/** Панель инструмента «Свет»: области тьмы/мглы и размещение источников света (DM). */
export default function LightPanel() {
  const lightMode = useGameStore((s) => s.lightMode);
  const setLightMode = useGameStore((s) => s.setLightMode);
  const updateAreas = useGameStore((s) => s.updateAreas);
  const updateLights = useGameStore((s) => s.updateLights);
  const map = useGameStore(activeMapOf);
  const placing = lightMode.place;

  return (
    <div className="fog-panel" data-testid="light-panel">
      <div className="fog-group">
        <span className="fog-label">{t('ui.light.sources')}</span>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            className={
              placing?.bright === p.bright && placing?.dim === p.dim && placing?.color === p.color ? 'active' : ''
            }
            title={t('ui.light.presetTitle', { bright: p.bright, dim: p.dim })}
            onClick={() => setLightMode({ place: { bright: p.bright, dim: p.dim, color: p.color } })}
          >
            {t(p.label)} · {p.bright}/{p.dim}
          </button>
        ))}
      </div>
      <div className="fog-group">
        <button
          title={t('ui.light.clearSourcesTitle')}
          disabled={!map?.lights?.length}
          onClick={() => {
            if (map) updateLights(map.id, []);
          }}
        >
          {t('ui.light.clearSources')}
        </button>
      </div>
      <div className="fog-group">
        <span className="fog-label">{t('ui.light.areas')}</span>
        {KINDS.map((k) => (
          <button
            key={k}
            className={!placing && lightMode.kind === k ? 'active' : ''}
            onClick={() => setLightMode({ kind: k, place: null })}
          >
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
      <span className="fog-label">{placing ? t('ui.light.placeHint') : t('ui.light.hint')}</span>
      <button onClick={() => setLightMode({ active: false })}>{t('ui.common.done')}</button>
    </div>
  );
}
