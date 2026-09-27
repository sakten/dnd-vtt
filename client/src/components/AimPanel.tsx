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
  ring: 'ui.aim.shape.ring',
};

/** Подсказка активного режима взаимодействия: клик по карте/цели применяет, Esc — отмена. */
export default function AimPanel() {
  const interaction = useGameStore((s) => s.interaction);
  const cancel = useGameStore((s) => s.cancelInteraction);
  const finish = useGameStore((s) => s.finishMultiTarget);
  const finishWall = useGameStore((s) => s.finishWall);
  const cycleWallPush = useGameStore((s) => s.cycleWallPush);
  const toPlaces = useGameStore((s) => s.scatterToPlaces);
  const back = useGameStore((s) => s.scatterBack);
  const skipPassenger = useGameStore((s) => s.skipPassenger);
  const map = useActiveMap();

  if (!interaction) return null;
  // Выбор состояния показывается модалкой ConditionChoicePrompt — панель не нужна.
  if (interaction.mode === 'condition') return null;

  if (interaction.mode === 'target') {
    const target = interaction.target;
    const passenger = target.kind === 'passenger';
    return (
      <div className="aim-panel" data-testid="aim-panel">
        <span className="aim-title">{passenger ? t('ui.aim.passenger') : target.label}</span>
        <span className="aim-hint">{passenger ? t('ui.aim.passengerHint') : t('ui.aim.targetHint')}</span>
        {passenger && (
          <button className="aim-apply" onClick={skipPassenger}>
            {t('ui.aim.withoutPassenger')}
          </button>
        )}
        <button className="aim-cancel" onClick={cancel}>
          {t('ui.common.cancel')}
        </button>
      </div>
    );
  }

  if (interaction.mode === 'aim') {
    const aim = interaction.aim;
    // Тонкая стена цепочкой (Wall of Ice): секции ставятся кликами, «Готово» завершает.
    if (aim.chain) {
      const placed = Math.max(0, (aim.wallPath?.length ?? 0) - 1);
      const max = aim.wallMax ?? 1;
      const pushLabel =
        aim.pushSide === 'a'
          ? t('ui.aim.wallPushA')
          : aim.pushSide === 'b'
            ? t('ui.aim.wallPushB')
            : t('ui.aim.wallPushAuto');
      return (
        <div className="aim-panel" data-testid="aim-panel">
          <span className="aim-title">{t('ui.aim.wallChain', { n: placed, max })}</span>
          <span className={`aim-hint${aim.blocked ? ' aim-blocked' : ''}`}>
            {aim.blocked
              ? t('ui.aim.blocked')
              : placed === 0
                ? t('ui.aim.wallStart')
                : t('ui.aim.wallNext')}
          </span>
          <button className="aim-apply aim-push" onClick={cycleWallPush}>
            {t('ui.aim.wallPush', { side: pushLabel })}
          </button>
          <button className="aim-apply" disabled={placed < 1} onClick={finishWall}>
            {t('ui.common.done')}
          </button>
          <button className="aim-cancel" onClick={cancel}>
            {t('ui.common.cancel')}
          </button>
        </div>
      );
    }
    return (
      <div className="aim-panel" data-testid="aim-panel">
        <span className="aim-title">
          {aim.nearTargets
            ? t('ui.aim.teleport')
            : t('ui.aim.areaLabel', { shape: t(SHAPE_RU[aim.spec.shape] ?? 'ui.aim.area'), size: aim.spec.size })}
        </span>
        <span className={`aim-hint${aim.blocked ? ' aim-blocked' : ''}`}>
          {aim.blocked
            ? t(aim.nearTargets ? 'ui.aim.nearTargetsInvalid' : 'ui.aim.blocked')
            : aim.nearTargets
              ? t('ui.aim.nearTargets')
              : t('ui.aim.aimHint')}
        </span>
        <button className="aim-cancel" onClick={cancel}>
          {t('ui.common.cancel')}
        </button>
      </div>
    );
  }

  if (interaction.mode === 'scatter') {
    const s = interaction.scatter;
    const tk = s.kind === 'telekinesis';
    if (s.phase === 'targets') {
      return (
        <div className="aim-panel" data-testid="aim-panel">
          <span className="aim-title">
            {t(tk ? 'ui.aim.tkTargets' : 'ui.aim.scatterTargets', { n: s.targets.length, max: s.maxTargets })}
          </span>
          <span className="aim-hint">{t(tk ? 'ui.aim.tkHintTargets' : 'ui.aim.scatterHintTargets')}</span>
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
          {t(tk ? 'ui.aim.tkPlace' : 'ui.aim.scatterPlace', { name, i: s.placements.length + 1, n: s.targets.length })}
        </span>
        <span className="aim-hint">{t(tk ? 'ui.aim.tkHintPlace' : 'ui.aim.scatterHintPlace')}</span>
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
