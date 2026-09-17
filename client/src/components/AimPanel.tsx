import { useGameStore } from '../store/useGameStore';
import { t, type MessageKey } from '../i18n';

const SHAPE_RU: Record<string, MessageKey> = {
  sphere: 'ui.aim.shape.sphere',
  cone: 'ui.aim.shape.cone',
  line: 'ui.aim.shape.line',
  cube: 'ui.aim.shape.cube',
  cylinder: 'ui.aim.shape.cylinder',
};

/** Подсказка активного режима взаимодействия: клик по карте/цели применяет, Esc — отмена. */
export default function AimPanel() {
  const interaction = useGameStore((s) => s.interaction);
  const cancel = useGameStore((s) => s.cancelInteraction);
  const finish = useGameStore((s) => s.finishMultiTarget);

  if (!interaction) return null;

  if (interaction.mode === 'target') {
    return (
      <div className="aim-panel" data-testid="aim-panel">
        <span className="aim-title">{interaction.target.label}</span>
        <span className="aim-hint">{t('ui.aim.targetHint')}</span>
        <button className="aim-cancel" onClick={cancel}>
          {t('ui.common.cancel')}
        </button>
      </div>
    );
  }

  if (interaction.mode === 'aim') {
    const aim = interaction.aim;
    return (
      <div className="aim-panel" data-testid="aim-panel">
        <span className="aim-title">
          {t('ui.aim.areaLabel', { shape: t(SHAPE_RU[aim.spec.shape] ?? 'ui.aim.area'), size: aim.spec.size })}
        </span>
        <span className="aim-hint">{t('ui.aim.aimHint')}</span>
        <button className="aim-cancel" onClick={cancel}>
          {t('ui.common.cancel')}
        </button>
      </div>
    );
  }

  const multi = interaction.multi;
  const left = multi.count - multi.targets.length;
  return (
    <div className="aim-panel">
      <span className="aim-title">
        {t('ui.aim.multiTitle', {
          kind: multi.distinct ? t('ui.common.targets') : t('ui.common.projectiles'),
          n: multi.targets.length,
          count: multi.count,
        })}
      </span>
      <span className="aim-hint">
        {left > 0 ? t('ui.aim.multiRemaining', { n: left }) : t('ui.aim.allChosen')}
      </span>
      <button className="aim-apply" disabled={!multi.targets.length} onClick={finish}>
        {t('ui.common.apply')}
      </button>
      <button className="aim-cancel" onClick={cancel}>
        {t('ui.common.cancel')}
      </button>
    </div>
  );
}
