import { getLocale, t } from '../i18n';
import { damageLabel, skillName } from '../i18n/domain';
import { raceDisplayName, useNames } from '../i18n/names';
import { useRaceText } from '../i18n/useLocalizedText';
import {
  RACES,
  raceByKey,
  raceChoiceDefs,
  raceDarkvision,
  raceResistances,
  raceSpeed,
  raceTraitTexts,
  type RaceSelection,
} from 'shared';

interface Props {
  value?: RaceSelection;
  onChange: (race: RaceSelection | undefined) => void;
}

export default function RaceForm({ value, onChange }: Props) {
  useNames();
  useRaceText();
  const race = raceByKey(value?.key);
  const choices = raceChoiceDefs(value?.key);
  const traits = raceTraitTexts(value?.key, getLocale()) ?? race?.traits ?? [];
  const speed = raceSpeed(value);
  const darkvision = raceDarkvision(value);
  const resistances = raceResistances(value);

  const pickRace = (key: string) => {
    if (!key) {
      onChange(undefined);
      return;
    }
    const def = raceByKey(key);
    if (!def) {
      onChange(undefined);
      return;
    }
    const next: RaceSelection = { key };
    if (def.sizes.some((size) => size !== 'M')) {
      next.choices = { size: def.sizes.includes('M') ? 'medium' : 'small' };
    }
    onChange(next);
  };

  const setChoice = (id: string, choice: string) => {
    if (!value) return;
    const next = { ...(value.choices ?? {}) };
    if (choice) next[id] = choice;
    else delete next[id];
    onChange({ ...value, ...(Object.keys(next).length ? { choices: next } : {}) });
  };

  return (
    <div className="race-form">
      <label className="field">
        <span>{t('ui.sheet.race')}</span>
        <select value={value?.key ?? ''} onChange={(e) => pickRace(e.target.value)}>
          <option value="">{t('ui.common.notChosen')}</option>
          {RACES.map((item) => (
            <option key={item.key} value={item.key}>
              {raceDisplayName(item.key, item.name)}
            </option>
          ))}
        </select>
      </label>

      {race && choices.length > 0 && (
        <div className="race-choices">
          {choices.map((choice) => (
            <label className="field" key={choice.id}>
              <span>{choice.label}</span>
              <select value={value?.choices?.[choice.id] ?? ''} onChange={(e) => setChoice(choice.id, e.target.value)}>
                <option value="">{t('ui.common.notChosen')}</option>
                {choice.options.map((option) => (
                  <option key={option.key} value={option.key}>
                    {choice.kind === 'skill' ? skillName(option.key) : option.label ?? option.key}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {race && (
        <div className="race-passives">
          {speed !== undefined && <span>{t('ui.sheet.raceSpeed', { n: speed })}</span>}
          {darkvision !== undefined && <span>{t('ui.sheet.raceDarkvision', { n: darkvision })}</span>}
          {resistances.length > 0 && (
            <span>{t('ui.sheet.raceResistances', { list: resistances.map(damageLabel).join(', ') })}</span>
          )}
        </div>
      )}

      {race && traits.length > 0 && (
        <div className="race-traits">
          {traits.map((trait) => (
            <div className="race-trait" key={trait.name}>
              <strong>{trait.name}</strong>
              <p>{trait.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
