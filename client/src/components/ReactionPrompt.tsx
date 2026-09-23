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

/** Окно реакции (R1): первый оффер из очереди, клик = реакция, без подтверждения. */
export default function ReactionPrompt() {
  const offers = useGameStore((s) => s.reactionOffers);
  const respond = useGameStore((s) => s.respondReaction);
  const forceSkip = useGameStore((s) => s.forceSkipReaction);
  const isDm = useIsDm();
  const byKey = useSpellByKey();
  const [, tick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(timer);
  }, []);

  const offer = offers[0];
  if (!offer) return null;

  const left = Math.max(0, Math.ceil((offer.expiresAt - Date.now()) / 1000));

  return (
    <>
      <div className="reaction-backdrop" />
      <div className="reaction-prompt" role="dialog" aria-label={t('ui.reaction.dialogLabel')}>
        <div className="rp-head">
          <span className="rp-title">{t('ui.reaction.title')}</span>
          <span className="rp-token">{offer.tokenName}</span>
          {offer.sourceName && (
            <span className="rp-source">
              {offer.sourceName}: {t(TRIGGER_RU[offer.trigger] ?? 'ui.reaction.triggerFallback')}
            </span>
          )}
          <span className="rp-timer">{t('ui.reaction.timer', { seconds: left })}</span>
          {isDm && (
            <button className="rp-force-link" onClick={() => forceSkip(offer.id)}>
              {t('ui.reaction.skipAll')}
            </button>
          )}
        </div>
        <div className="rp-options">
          {offer.options.map((option) => {
            const spell = option.spellKey ? byKey.get(option.spellKey) : undefined;
            // Смайт в окне: «Searing Smite · круг 2» (круг — из id `smite:<ключ>@<круг>`).
            const level = Number(option.id.split('@')[1]);
            const label =
              spell && Number.isFinite(level) && level > 0
                ? `${spellDisplayName(spell)} · ${t('ui.reaction.levelShort', { level })}`
                : reactionLabel(option.id, option.name);
            return (
              <button key={option.id} className="rp-option" onClick={() => respond(offer.id, option.id)}>
                {spell ? (
                  <SpellIcon spell={spell} className="rp-icon" />
                ) : (
                  <ActionIcon id="sword" className="rp-icon" />
                )}
                <span className="rp-name">{label}</span>
              </button>
            );
          })}
          <button className="rp-option rp-ignore" onClick={() => respond(offer.id, null)}>
            <span className="rp-name">{t('ui.reaction.ignore')}</span>
          </button>
        </div>
      </div>
    </>
  );
}
