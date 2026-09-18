import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';
import { useGameStore } from '../store/useGameStore';

/** Меню «Кости»: личные настройки бросков игрока (ручные d20-атаки и проверки). */
export default function DiceMenu() {
  const selfId = useGameStore((s) => s.selfId);
  const players = useGameStore((s) => s.players);
  const setRollAnimChance = useGameStore((s) => s.setRollAnimChance);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const chance = players.find((p) => p.id === selfId)?.rollAnimChance ?? 0;

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  };

  return (
    <div className="dice-menu-wrap">
      <button
        ref={btnRef}
        className={open ? 'active' : ''}
        data-testid="dice-menu-btn"
        title={t('ui.toolbar.diceTitle')}
        onClick={toggle}
      >
        {t('ui.toolbar.dice')}
      </button>
      {open &&
        createPortal(
          <>
            <div className="roll-menu-backdrop" onMouseDown={() => setOpen(false)} />
            <div
              className="roll-menu dice-menu"
              data-testid="dice-menu"
              style={pos ? { top: pos.top, left: pos.left } : undefined}
            >
              <label className="dice-check" title={t('ui.roll.animHint')}>
                <span>{t('ui.roll.anim')}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={chance}
                  data-testid="roll-anim-chance"
                  onChange={(e) => setRollAnimChance(Number(e.target.value))}
                />
                <span className="dice-chance">{chance}%</span>
              </label>
              <div className="dice-hint">{t('ui.roll.animHint')}</div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
