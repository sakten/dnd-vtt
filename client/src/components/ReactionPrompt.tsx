import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { t, type MessageKey } from '../i18n';
import { reactionLabel } from '../i18n/domain';
import { useIsDm } from '../lib/control';
import { useSpellByKey } from '../lib/useSpells';
import { spellDisplayName } from '../i18n/names';
import ActionIcon from './ActionIcon';
import SpellIcon from './SpellIcon';

const TRIGGER_RU: Partial<Record<string, MessageKey>> = {
  saveFail: 'ui.reaction.trigger.saveFail',
  attackHit: 'ui.reaction.trigger.attackHit',
  damage: 'ui.reaction.trigger.damage',
  leaveReach: 'ui.reaction.trigger.leaveReach',
  spellCast: 'ui.reaction.trigger.spellCast',
};

/**
 * Окно реакции: очередь сервера спрашивает по одному реактору. Видно всем,
 * но варианты и кнопки — только у реактора и DM; остальные наблюдают.
 */
export default function ReactionPrompt() {
  const offer = useGameStore((s) => s.reactionOffer);
  const respond = useGameStore((s) => s.respondReaction);
  const forceSkip = useGameStore((s) => s.forceSkipReaction);
  const isDm = useIsDm();
  const byKey = useSpellByKey();
  const [, tick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(timer);
  }, []);

  if (!offer) return null;

  const left = Math.max(0, Math.ceil((offer.expiresAt - Date.now()) / 1000));

  return (
    <>
      <div className="reaction-backdrop" />
      <div
        className={`reaction-prompt${offer.active ? '' : ' rp-spectator'}`}
        role="dialog"
        aria-label={t('ui.reaction.dialogLabel')}
      >
        <div className="rp-head">
          <span className="rp-title">{t('ui.reaction.title')}</span>
          <span className="rp-token">{offer.tokenName}</span>
          {offer.sourceName && (
            <span className="rp-source">
              {offer.sourceName}: {t(TRIGGER_RU[offer.trigger] ?? 'ui.reaction.triggerFallback')}
            </span>
          )}
          <span className="rp-timer">{t('ui.reaction.timer', { seconds: left })}</span>
          {isDm && offer.active && (
            <button className="rp-force-link" onClick={() => forceSkip(offer.id)}>
              {t('ui.reaction.skip')}
            </button>
          )}
        </div>
        {offer.active ? (
          <div className="rp-options">
            {offer.options.map((option) => {
              const spell = option.spellKey ? byKey.get(option.spellKey) : undefined;
              // Смайт: один пункт на заклинание, круги — рядом (`levels`), клик по кругу кастует им.
              const levels = option.levels ?? [];
              const label = spell ? spellDisplayName(spell) : reactionLabel(option.id, option.name);
              return (
                <div key={option.id} className="rp-option-row">
                  <button className="rp-option" onClick={() => respond(offer.id, option.id)}>
                    {spell ? (
                      <SpellIcon spell={spell} className="rp-icon" />
                    ) : (
                      <ActionIcon id="sword" className="rp-icon" />
                    )}
                    <span className="rp-name">{label}</span>
                  </button>
                  {levels.length > 1 && option.spellKey && (
                    <div className="rp-levels">
                      {levels.map((level) => (
                        <button
                          key={level}
                          className="rp-level"
                          title={t('ui.reaction.levelShort', { level })}
                          onClick={() => respond(offer.id, `smite:${option.spellKey}@${level}`)}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button className="rp-option rp-ignore" onClick={() => respond(offer.id, null)}>
              <span className="rp-name">{t('ui.reaction.ignore')}</span>
            </button>
          </div>
        ) : (
          <div className="rp-waiting">{t('ui.reaction.waiting', { name: offer.tokenName })}</div>
        )}
      </div>
    </>
  );
}
