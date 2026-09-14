import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useIsDm } from '../lib/control';
import { useSpells } from '../lib/useSpells';
import ActionIcon from './ActionIcon';
import SpellIcon from './SpellIcon';

const TRIGGER_RU: Record<string, string> = {
  attackHit: 'попадание по нему',
  damage: 'получен урон',
  leaveReach: 'выход из зоны досягаемости',
  spellCast: 'накладывают заклинание',
};

/** Окно реакции (R1): первый оффер из очереди, клик = реакция, без подтверждения. */
export default function ReactionPrompt() {
  const offers = useGameStore((s) => s.reactionOffers);
  const respond = useGameStore((s) => s.respondReaction);
  const forceSkip = useGameStore((s) => s.forceSkipReaction);
  const isDm = useIsDm();
  const spells = useSpells();
  const [, tick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(timer);
  }, []);

  const offer = offers[0];
  if (!offer) return null;

  const left = Math.max(0, Math.ceil((offer.expiresAt - Date.now()) / 1000));
  const byKey = new Map(spells.map((s) => [s.key, s]));

  return (
    <>
      <div className="reaction-backdrop" />
      <div className="reaction-prompt" role="dialog" aria-label="Окно реакции">
        <div className="rp-head">
          <span className="rp-title">Реакция</span>
          <span className="rp-token">{offer.tokenName}</span>
          {offer.sourceName && (
            <span className="rp-source">
              {offer.sourceName}: {TRIGGER_RU[offer.trigger] ?? 'триггер'}
            </span>
          )}
          <span className="rp-timer">{left} с</span>
          {isDm && (
            <button className="rp-force-link" onClick={() => forceSkip(offer.id)}>
              Пропустить все
            </button>
          )}
        </div>
        <div className="rp-options">
          {offer.options.map((option) => {
            const spell = option.spellKey ? byKey.get(option.spellKey) : undefined;
            return (
              <button key={option.id} className="rp-option" onClick={() => respond(offer.id, option.id)}>
                {spell ? (
                  <SpellIcon spell={spell} className="rp-icon" />
                ) : (
                  <ActionIcon id="sword" className="rp-icon" />
                )}
                <span className="rp-name">{option.name}</span>
              </button>
            );
          })}
          <button className="rp-option rp-ignore" onClick={() => respond(offer.id, null)}>
            <span className="rp-name">Игнорировать</span>
          </button>
        </div>
      </div>
    </>
  );
}
