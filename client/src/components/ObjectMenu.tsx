import type { ReactNode } from 'react';
import { useGameStore } from '../store/useGameStore';

interface Props {
  title: string;
  /** Мировые координаты объекта: карточка позиционируется над ним. */
  world: { x: number; y: number };
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Каркас мини-UI интерактивного объекта (дверь и будущие предметы):
 * плавающая карточка над объектом, шапка с закрытием и произвольное содержимое.
 */
export default function ObjectMenu({ title, world, onClose, actions, children }: Props) {
  const view = useGameStore((s) => s.view);
  const viewport = useGameStore((s) => s.viewport);
  const left = Math.min(
    Math.max(world.x * view.scale + view.x, 160),
    Math.max(160, viewport.w - 160)
  );
  const top = Math.min(Math.max(world.y * view.scale + view.y, 120), Math.max(120, viewport.h - 120));

  return (
    <div className="object-menu" data-testid="object-menu" style={{ left, top }}>
      <div className="object-menu-header">
        <span>{title}</span>
        <button
          className="icon"
          title="Закрыть"
          aria-label="Закрыть"
          data-testid="object-menu-close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="object-menu-body">{children}</div>
      {actions && <div className="object-menu-actions">{actions}</div>}
    </div>
  );
}
