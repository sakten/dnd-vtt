import { useEffect, useRef, useState } from 'react';
import { emptyCombatState } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { activeMapOf } from '../store/selectors';
import { useCanEndTurn, useIsDm } from '../lib/control';
import { useInvisibilityView } from '../lib/visibility';
import { thumbUrl } from '../lib/imageVariants';

const EMPTY_COMBAT = emptyCombatState();

export default function InitiativeBar() {
  const combat = useGameStore((s) => activeMapOf(s)?.combat ?? EMPTY_COMBAT);
  const isDm = useIsDm();
  const hoverTokenId = useGameStore((s) => s.hoverTokenId);
  const setHoverToken = useGameStore((s) => s.setHoverToken);
  const setSelected = useGameStore((s) => s.setSelected);
  const removeCombatant = useGameStore((s) => s.removeCombatant);
  const moveCombatant = useGameStore((s) => s.moveCombatant);
  const rollInitiative = useGameStore((s) => s.rollInitiative);
  const addMapCombatants = useGameStore((s) => s.addMapCombatants);
  const endTurn = useGameStore((s) => s.endTurn);
  const setTurn = useGameStore((s) => s.setTurn);
  const canEndTurn = useCanEndTurn();
  const invisibility = useInvisibilityView();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const activeId =
    combat.active && combat.currentIndex >= 0 ? combat.entries[combat.currentIndex]?.id ?? null : null;

  // Смена хода (и структуры списка) — подматываем полосу к активному чипу.
  useEffect(() => {
    const track = scrollRef.current;
    if (!track || !activeId) return;
    const index = combat.entries.findIndex((e) => e.id === activeId);
    const chip = track.children[index] as HTMLElement | undefined;
    if (index < 0 || !chip) return;
    const target = chip.offsetLeft + chip.offsetWidth / 2 - track.clientWidth / 2;
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    const behavior: ScrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    track.scrollTo({ left: Math.max(0, Math.min(max, target)), behavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries читаем на момент смены хода
  }, [activeId, combat.entries.length]);

  if (!combat.active) return null;
  const activeIndex =
    combat.currentIndex >= 0 && combat.currentIndex < combat.entries.length ? combat.currentIndex : -1;
  const activeEntry = activeIndex >= 0 ? combat.entries[activeIndex] : null;
  const turn = activeEntry ? combat.turns[activeEntry.legendaryOwnerId ?? activeEntry.id] : undefined;
  const movementLeft = turn ? turn.movementMax - turn.movementUsed : 0;

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };

  const dropOn = (targetId: string) => {
    const dragId = dragIdRef.current;
    dragIdRef.current = null;
    setDragOverId(null);
    if (!dragId || dragId === targetId) return;
    const toIndex = combat.entries.findIndex((e) => e.id === targetId);
    if (toIndex >= 0) moveCombatant(dragId, toIndex);
  };

  return (
    <div className="initiative-bar" data-testid="initiative-bar">
      <div className="initiative-turn">
        <span className="initiative-round">{t('ui.initiative.round', { n: combat.round || 1 })}</span>
        {activeEntry && <span className="initiative-active-name">{activeEntry.name}</span>}
        {turn?.movementOnly && <span className="initiative-move-only">{t('ui.initiative.movementOnly')}</span>}
        {turn && (
          <span className="initiative-resources">
            <span
              className={`res-dot action${turn.actionUsed ? ' used' : ''}`}
              title={turn.actionUsed ? t('ui.initiative.actionUsed') : t('ui.initiative.actionAvailable')}
            />
            <span
              className={`res-dot bonus${turn.bonusActionUsed ? ' used' : ''}`}
              title={
                turn.bonusActionUsed ? t('ui.initiative.bonusUsed') : t('ui.initiative.bonusAvailable')
              }
            />
            <span
              className={`res-dot reaction${turn.reactionUsed ? ' used' : ''}`}
              title={turn.reactionUsed ? t('ui.initiative.reactionUsed') : t('ui.initiative.reactionAvailable')}
            />
            {turn.legendaryMax > 0 && (
              <span
                className={`res-dot legendary${turn.legendaryRemaining === 0 ? ' used' : ''}`}
                title={t('ui.initiative.legendary', {
                  n: turn.legendaryRemaining,
                  max: turn.legendaryMax,
                })}
              >
                {turn.legendaryRemaining}
              </span>
            )}
            <span className={`res-move${movementLeft < 0 ? ' over' : ''}`} title={t('ui.common.movementLeftTitle')}>
              {movementLeft < 0
                ? t('ui.initiative.overMovement', { n: -movementLeft })
                : t('ui.common.feet', { n: movementLeft })}
            </span>
          </span>
        )}
        <button
          className="initiative-end"
          disabled={!canEndTurn}
          title={canEndTurn ? t('ui.initiative.endTurn') : t('ui.initiative.endTurnTitle')}
          onClick={endTurn}
        >
          {t('ui.initiative.endTurn')}
        </button>
      </div>
      <button className="initiative-scroll" title={t('ui.initiative.left')} onClick={() => scrollBy(-1)}>
        ◀
      </button>
      <div className="initiative-track" ref={scrollRef}>
        {combat.entries.length === 0 && (
          <span className="initiative-empty">{t('ui.initiative.noCombatants')}</span>
        )}
        {combat.entries.map((entry, index) => (
          <div
            key={entry.id}
            className={`initiative-chip${index === activeIndex ? ' active' : ''}${
              entry.legendaryOwnerId ? ' legendary' : ''
            }${hoverTokenId && hoverTokenId === entry.tokenId ? ' hovered' : ''}${
              dragOverId === entry.id ? ' drop' : ''
            }`}
            data-testid="initiative-chip"
            title={
              entry.legendaryOwnerId
                ? `${entry.name} — ${t('ui.initiative.legendaryChip')}`
                : t('ui.initiative.chipTitle', {
                    name: entry.name,
                    initiative: entry.initiative,
                    bonus: entry.bonus ? ` (${entry.bonus})` : '',
                  })
            }
            draggable={isDm}
            onMouseEnter={() => entry.tokenId && setHoverToken(entry.tokenId)}
            onMouseLeave={() => setHoverToken(null)}
            onClick={() => entry.tokenId && setSelected(entry.tokenId)}
            onDoubleClick={() => {
              if (isDm) rollInitiative(entry.id);
            }}
            onDragStart={() => {
              dragIdRef.current = entry.id;
            }}
            onDragOver={(e) => {
              if (isDm && dragIdRef.current) {
                e.preventDefault();
                setDragOverId(entry.id);
              }
            }}
            onDrop={() => dropOn(entry.id)}
            onDragEnd={() => {
              dragIdRef.current = null;
              setDragOverId(null);
            }}
          >
            {entry.tokenId && invisibility.masked.has(entry.tokenId) ? (
              <span className="initiative-mask" title={t('ui.initiative.invisible')}>
                ?
              </span>
            ) : (
              <img
                src={thumbUrl(entry.imageUrl)}
                onError={(e) => {
                  if (entry.imageUrl && e.currentTarget.src !== entry.imageUrl) e.currentTarget.src = entry.imageUrl;
                }}
                alt={entry.name}
                draggable={false}
              />
            )}
            <span className="initiative-value">{entry.initiative}</span>
            {isDm && index !== activeIndex && (
              <button
                className="initiative-set"
                title={t('ui.initiative.setActive')}
                onClick={(e) => {
                  e.stopPropagation();
                  setTurn(entry.id);
                }}
              >
                ▶
              </button>
            )}
            {isDm && (
              <button
                className="initiative-remove"
                title={t('ui.initiative.remove')}
                onClick={(e) => {
                  e.stopPropagation();
                  removeCombatant(entry.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {isDm && (
        <button className="initiative-action" title={t('ui.initiative.addTokens')} onClick={addMapCombatants}>
          +
        </button>
      )}
      <button className="initiative-scroll" title={t('ui.initiative.right')} onClick={() => scrollBy(1)}>
        ▶
      </button>
    </div>
  );
}
