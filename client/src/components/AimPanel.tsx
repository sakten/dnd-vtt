import { useGameStore } from '../store/useGameStore';

const SHAPE_RU: Record<string, string> = {
  sphere: 'Сфера',
  cone: 'Конус',
  line: 'Линия',
  cube: 'Куб',
  cylinder: 'Цилиндр',
};

/** Подсказка режима прицеливания (область/мульти-цели): клик по карте применяет. */
export default function AimPanel() {
  const aim = useGameStore((s) => s.aim);
  const multiTarget = useGameStore((s) => s.multiTarget);
  const cancelAim = useGameStore((s) => s.cancelAim);
  const cancelMultiTarget = useGameStore((s) => s.cancelMultiTarget);

  if (aim) {
    return (
      <div className="aim-panel">
        <span className="aim-title">
          {SHAPE_RU[aim.spec.shape] ?? 'Область'} {aim.spec.size} фт
        </span>
        <span className="aim-hint">Клик по карте — применить · Esc — отмена</span>
        <button className="aim-cancel" onClick={cancelAim}>
          Отмена
        </button>
      </div>
    );
  }

  if (multiTarget) {
    const left = multiTarget.count - multiTarget.targets.length;
    return (
      <div className="aim-panel">
        <span className="aim-title">
          Снаряды {multiTarget.targets.length}/{multiTarget.count}
        </span>
        <span className="aim-hint">
          {left > 0 ? `Кликните цель (ещё ${left})` : 'Атаки…'} · Esc — отмена
        </span>
        <button className="aim-cancel" onClick={cancelMultiTarget}>
          Отмена
        </button>
      </div>
    );
  }

  return null;
}
