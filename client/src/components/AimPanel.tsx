import { useGameStore } from '../store/useGameStore';

const SHAPE_RU: Record<string, string> = {
  sphere: 'Сфера',
  cone: 'Конус',
  line: 'Линия',
  cube: 'Куб',
  cylinder: 'Цилиндр',
};

/** Подсказка активного режима взаимодействия: клик по карте/цели применяет, Esc — отмена. */
export default function AimPanel() {
  const interaction = useGameStore((s) => s.interaction);
  const cancel = useGameStore((s) => s.cancelInteraction);

  if (!interaction) return null;

  if (interaction.mode === 'target') {
    return (
      <div className="aim-panel">
        <span className="aim-title">{interaction.target.label}</span>
        <span className="aim-hint">Кликните цель · Esc или клик по пустому месту — отмена</span>
        <button className="aim-cancel" onClick={cancel}>
          Отмена
        </button>
      </div>
    );
  }

  if (interaction.mode === 'aim') {
    const aim = interaction.aim;
    return (
      <div className="aim-panel">
        <span className="aim-title">
          {SHAPE_RU[aim.spec.shape] ?? 'Область'} {aim.spec.size} фт
        </span>
        <span className="aim-hint">Клик по карте — применить · Esc — отмена</span>
        <button className="aim-cancel" onClick={cancel}>
          Отмена
        </button>
      </div>
    );
  }

  const multi = interaction.multi;
  const left = multi.count - multi.targets.length;
  return (
    <div className="aim-panel">
      <span className="aim-title">
        Снаряды {multi.targets.length}/{multi.count}
      </span>
      <span className="aim-hint">
        {left > 0 ? `Кликните цель (ещё ${left})` : 'Атаки…'} · Esc — отмена
      </span>
      <button className="aim-cancel" onClick={cancel}>
        Отмена
      </button>
    </div>
  );
}
