import { useGameStore } from '../store/useGameStore';
import { activeMapOf } from '../store/selectors';
import { t } from '../i18n';
import { DEFAULT_DEPLOYMENT } from 'shared';

export default function DeploymentPanel() {
  const mode = useGameStore((s) => s.deploymentMode);
  const setMode = useGameStore((s) => s.setDeploymentMode);
  const map = useGameStore(activeMapOf);
  const updateDeployment = useGameStore((s) => s.updateDeployment);

  if (!map) return null;
  const deployment = map.deployment ?? DEFAULT_DEPLOYMENT;

  return (
    <div className="fog-panel" data-testid="deployment-panel">
      <label className="adv-check">
        <input
          type="checkbox"
          checked={deployment.enabled}
          onChange={(e) => updateDeployment(map.id, { ...deployment, enabled: e.target.checked })}
        />
        {t('ui.deployment.hide')}
      </label>
      <button
        className={mode.draw ? 'active' : ''}
        onClick={() => setMode({ active: true, draw: !mode.draw })}
      >
        {t('ui.deployment.draw')}
      </button>
      <button
        disabled={deployment.areas.length === 0}
        onClick={() => updateDeployment(map.id, { ...deployment, areas: [] })}
      >
        {t('ui.deployment.clear')}
      </button>
      <span className="fog-label">
        {mode.draw ? t('ui.deployment.drawHint') : t('ui.deployment.panelHint')}
      </span>
      <button onClick={() => setMode({ active: false, draw: false })}>{t('ui.common.done')}</button>
    </div>
  );
}
