import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { tokenById } from '../store/selectors';
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
  const toPlaces = useGameStore((s) => s.scatterToPlaces);
  const back = useGameStore((s) => s.scatterBack);
  const map = useActiveMap();

  if (!interaction) return null;
  // Выбор состояния показывается модалкой ConditionChoicePrompt — панель не нужна.
  if (interaction.mode === 'condition') return null;

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
        <span className={`aim-hint${aim.blocked ? ' aim-blocked' : ''}`}>
          {aim.blocked ? t('ui.aim.blocked') : t('ui.aim.aimHint')}
        </span>
        <button className="aim-cancel" onClick={cancel}>
          {t('ui.common.cancel')}
        </button>
      </div>
    );
  }

  if (interaction.mode === 'scatter') {
    const s = interaction.scatter;
    if (s.phase === 'targets') {
      return (
        <div className="aim-panel" data-testid="aim-panel">
          <span className="aim-title">{t('ui.aim.scatterTargets', { n: s.targets.length, max: s.maxTargets })}</span>
          <span className="aim-hint">{t('ui.aim.scatterHintTargets')}</span>
          <button className="aim-apply" disabled={!s.targets.length} onClick={toPlaces}>
            {t('ui.aim.next')}
          </button>
          <button className="aim-cancel" onClick={cancel}>
            {t('ui.common.cancel')}
          </button>
        </div>
      );
    }
    const current = s.targets[s.placements.length];
    const name = (current ? tokenById(map, current)?.name : '') ?? '';
    return (
      <div className="aim-panel" data-testid="aim-panel">
        <span className="aim-title">
          {t('ui.aim.scatterPlace', { name, i: s.placements.length + 1, n: s.targets.length })}
        </span>
        <span className="aim-hint">{t('ui.aim.scatterHintPlace')}</span>
        <button className="aim-cancel" onClick={back}>
          {t('ui.aim.back')}
        </button>
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
