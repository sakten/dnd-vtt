import { useState } from 'react';
import {
  HANDS_SHIELD,
  attackIsActive,
  handOf,
  isTwoHandedAttack,
  loadoutOf,
  statNumber,
  weaponByKey,
  weaponContextOf,
  type AttackEntry,
  type CharacterSheet,
  type PlayerResources,
  type SheetHands,
  type Token,
} from 'shared';
import { t } from '../i18n';
import ActionIcon from './ActionIcon';
import WeaponIcon from './WeaponIcon';

/**
 * Колонка «в руках»: портрет, хиты/КЗ и два слота (правая — основная).
 * Двуручное занимает обе руки, щит не влияет на КЗ (AC вводит игрок).
 */
interface Props {
  token: Token;
  sheet: CharacterSheet;
  resources?: PlayerResources;
  readOnly?: boolean;
  onOpenSheet?: () => void;
  onChange: (hands: SheetHands | undefined) => void;
}

type HandKey = 'right' | 'left';

export default function LoadoutPanel({ token, sheet, resources, readOnly, onOpenSheet, onChange }: Props) {
  const [picker, setPicker] = useState<HandKey | null>(null);
  const loadout = loadoutOf({
    attacks: sheet.attacks,
    hands: sheet.hands,
    effects: token.effects,
    ...weaponContextOf(sheet),
  });
  const right = handOf(loadout, 'right');
  const left = handOf(loadout, 'left');
  const leftShield = sheet.hands?.left === HANDS_SHIELD;
  const twoHanded = isTwoHandedAttack(right);
  const hp =
    resources && resources.hp.max > 0
      ? resources.hp
      : { current: token.hpCurrent, max: statNumber(token.hpMax), temp: token.hpTemp ?? 0 };
  const ac = token.ac || sheet.ac;

  const setHand = (hand: HandKey, value: string | undefined) => {
    const next: SheetHands = { ...sheet.hands };
    if (value) next[hand] = value;
    else delete next[hand];
    const attackOf = (id: string | undefined) =>
      id && id !== HANDS_SHIELD ? sheet.attacks.find((a) => a.id === id) : undefined;
    // Двуручное всегда в правой и блокирует левую.
    if (hand === 'left' && isTwoHandedAttack(attackOf(value))) {
      if (value) next.right = value;
      delete next.left;
    }
    if (hand === 'right' && isTwoHandedAttack(attackOf(value))) delete next.left;
    // Одно оружие в двух руках нельзя, два щита — тоже.
    if (next.right && next.left && next.right === next.left) delete next[hand === 'right' ? 'left' : 'right'];
    if (next.right === HANDS_SHIELD && next.left === HANDS_SHIELD) delete next.left;
    onChange(next.right || next.left ? next : undefined);
    setPicker(null);
  };

  const weaponTip = (entry: AttackEntry | undefined) => {
    if (!entry) return t('ui.hands.unarmed');
    const weapon = entry.weaponKey ? weaponByKey(entry.weaponKey) : undefined;
    const damage = entry.damage.trim();
    const base = entry.name || weapon?.name || '';
    if (!weapon) return base;
    return [`${base} · ${entry.hit}`, damage ? `${t('ui.attacks.damage')}: ${damage}` : '']
      .filter(Boolean)
      .join('\n');
  };

  const slot = (hand: HandKey) => {
    const entry = hand === 'left' ? left : right;
    const shield = hand === 'left' && leftShield;
    const locked = hand === 'left' && twoHanded;
    const icon = shield ? (
      <ActionIcon id="shield" className="ap-icon" />
    ) : entry ? (
      <WeaponIcon name={entry.name} className="ap-icon" />
    ) : hand === 'right' ? (
      <WeaponIcon name="fist" className="ap-icon" />
    ) : (
      <span className="ap-hand-empty">+</span>
    );
    const tip = [
      hand === 'right' ? t('ui.hands.right') : t('ui.hands.left'),
      twoHanded && hand === 'left'
        ? t('ui.hands.twoHanded', { name: right?.name ?? '' })
        : shield
          ? t('ui.hands.shield')
          : weaponTip(entry),
    ].join('\n');
    return (
      <button
        type="button"
        className={`ap-hand${locked ? ' locked' : ''}`}
        data-tip={tip}
        disabled={readOnly || locked}
        onClick={() => setPicker(picker === hand ? null : hand)}
      >
        {locked && right ? <WeaponIcon name={right.name} className="ap-icon" /> : icon}
        {hand === 'right' && !entry && !shield && <span className="ap-hand-mark">{t('ui.hands.primary')}</span>}
      </button>
    );
  };

  return (
    <section className="ap-panel loadout">
      <button
        type="button"
        className="ap-loadout-portrait"
        onClick={onOpenSheet}
        disabled={!onOpenSheet}
        title={t('ui.chat.sheetTitle')}
      >
        {token.imageUrl ? (
          <img className="ap-portrait" src={token.imageUrl} alt="" />
        ) : (
          <div className="ap-portrait fallback">{(token.name || '?').slice(0, 1).toUpperCase()}</div>
        )}
        <div className="ap-vitals">
          <span className="ap-vital ac" data-tip={t('ui.common.ac')}>
            <ActionIcon id="shield" className="ap-vital-icon" />
            {ac || '—'}
          </span>
        </div>
      </button>
      <div className="ap-hp" data-tip={t('ui.hands.hp')}>
        {hp.current}/{hp.max}
        {hp.temp > 0 ? ` (+${hp.temp})` : ''}
      </div>
      <div className="ap-hands">
        {slot('right')}
        {slot('left')}
      </div>
      {picker && !readOnly && (
        <div className="ap-hand-picker">
          <div className="ap-hand-picker-title">{t('ui.hands.pick')}</div>
          {sheet.attacks
            .filter((attack) => attackIsActive(attack) && attack.kind !== 'unarmed')
            .map((attack) => (
              <button
                key={attack.id ?? attack.name}
                type="button"
                className="ap-hand-option"
                onClick={() => setHand(picker, attack.id)}
              >
                <WeaponIcon name={attack.name} className="ap-icon" />
                <span>{attack.name || attack.hit}</span>
              </button>
            ))}
          <button type="button" className="ap-hand-option" onClick={() => setHand(picker, HANDS_SHIELD)}>
            <ActionIcon id="shield" className="ap-icon" />
            <span>{t('ui.hands.shield')}</span>
          </button>
          <button type="button" className="ap-hand-option dim" onClick={() => setHand(picker, undefined)}>
            <span className="ap-hand-empty">—</span>
            <span>{t('ui.hands.clear')}</span>
          </button>
        </div>
      )}
    </section>
  );
}
