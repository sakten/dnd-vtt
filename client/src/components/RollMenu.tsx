import { useState } from 'react';
import { ABILITIES, SKILLS, activeAttacks, type AbilityKey, type AttackEntry } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { checkExpression, defaultSheet, saveExpression, weaponRolls } from '../lib/sheet';

type MenuLevel = 'root' | 'save' | 'check' | 'attack' | `ability:${AbilityKey}`;

function applyAdvantage(expression: string, adv: boolean, dis: boolean): string {
  if (adv === dis) return expression;
  const suffix = adv ? 'a' : 'd';
  return expression.replace(/^d20(?![0-9])/, `d20${suffix}`);
}

export default function RollMenu() {
  const stored = useGameStore((s) => s.sheet);
  const rollDice = useGameStore((s) => s.rollDice);
  const sendAttack = useGameStore((s) => s.rollAttack);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<MenuLevel>('root');
  const [adv, setAdv] = useState(false);
  const [dis, setDis] = useState(false);

  const sheet = stored ?? defaultSheet();

  const close = () => {
    setOpen(false);
    setLevel('root');
  };

  const doRoll = (expression: string, label: string) => {
    rollDice(applyAdvantage(expression, adv, dis), label);
    setAdv(false);
    setDis(false);
    close();
  };

  const doWeapon = (weapon: AttackEntry) => {
    const { hit, damage } = weaponRolls(weapon);
    if (!hit && !damage) return;
    const hitRoll = hit ? { ...hit, expression: applyAdvantage(hit.expression, adv, dis) } : null;
    sendAttack(hitRoll, damage);
    setAdv(false);
    setDis(false);
    close();
  };

  const chooseAttack = () => {
    const weapons = activeAttacks(sheet);
    if (weapons.length === 0) return;
    if (weapons.length === 1) doWeapon(weapons[0]);
    else setLevel('attack');
  };

  const back = (to: MenuLevel) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setLevel(to);
  };

  return (
    <div className="roll-menu-wrap">
      <div className="roll-adv">
        <label className="adv-check" title="Бросок с преимуществом (d20a)">
          <input
            type="checkbox"
            checked={adv}
            onChange={(e) => {
              setAdv(e.target.checked);
              if (e.target.checked) setDis(false);
            }}
          />
          Adv
        </label>
        <label className="adv-check" title="Бросок с помехой (d20d)">
          <input
            type="checkbox"
            checked={dis}
            onChange={(e) => {
              setDis(e.target.checked);
              if (e.target.checked) setAdv(false);
            }}
          />
          Dis
        </label>
      </div>
      <button
        className="roll-button"
        title="Броски из карточки персонажа"
        onClick={() => setOpen((v) => !v)}
      >
        ROLL
      </button>
      {open && (
        <>
          <div className="roll-menu-backdrop" onMouseDown={close} />
          <div className="roll-menu">
            {level === 'root' && (
              <>
                <button className="roll-menu-item" onClick={chooseAttack}>
                  Attack
                </button>
                <button className="roll-menu-item" onClick={() => setLevel('save')}>
                  Save
                </button>
                <button className="roll-menu-item" onClick={() => setLevel('check')}>
                  Check
                </button>
              </>
            )}
            {level === 'attack' && (
              <>
                <button className="roll-menu-item back" onClick={back('root')}>
                  ← назад
                </button>
                {activeAttacks(sheet).map((weapon, i) => (
                  <button className="roll-menu-item" key={i} onClick={() => doWeapon(weapon)}>
                    {weapon.name.trim() || `Оружие ${i + 1}`}
                  </button>
                ))}
              </>
            )}
            {level === 'save' && (
              <>
                <button className="roll-menu-item back" onClick={back('root')}>
                  ← назад
                </button>
                {ABILITIES.map((a) => (
                  <button
                    className="roll-menu-item"
                    key={a.key}
                    onClick={() => doRoll(saveExpression(sheet, a.key), `Спасбросок: ${a.name}`)}
                  >
                    {a.name}
                  </button>
                ))}
              </>
            )}
            {level === 'check' && (
              <>
                <button className="roll-menu-item back" onClick={back('root')}>
                  ← назад
                </button>
                {ABILITIES.map((a) => (
                  <button className="roll-menu-item" key={a.key} onClick={() => setLevel(`ability:${a.key}`)}>
                    {a.name}
                  </button>
                ))}
              </>
            )}
            {level.startsWith('ability:') && (
              <>
                <button className="roll-menu-item back" onClick={back('check')}>
                  ← назад
                </button>
                {SKILLS.filter((s) => s.ability === (level.slice(8) as AbilityKey)).map((s) => (
                  <button
                    className="roll-menu-item"
                    key={s.key}
                    onClick={() => doRoll(checkExpression(sheet, s.key), `Проверка: ${s.name}`)}
                  >
                    {s.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
