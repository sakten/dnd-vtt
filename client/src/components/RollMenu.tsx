import { useMemo, useState } from 'react';
import {
  ABILITIES,
  SKILLS,
  attackIsActive,
  attackRange,
  gridDistanceFeet,
  statNumber,
  type AbilityKey,
  type AttackEntry,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { canControlWith } from '../lib/control';
import { checkExpression, defaultSheet, saveExpression } from '../lib/sheet';

type MenuLevel = 'root' | 'source' | 'attack' | 'save' | 'check' | `ability:${AbilityKey}`;

interface AttackSource {
  key: string;
  label: string;
  tokenId?: string;
  attacks: AttackEntry[];
}

function applyAdvantage(expression: string, adv: boolean, dis: boolean): string {
  if (adv === dis) return expression;
  const suffix = adv ? 'a' : 'd';
  return expression.replace(/^d20(?![0-9])/, `d20${suffix}`);
}

export default function RollMenu() {
  const stored = useGameStore((s) => s.sheet);
  const scene = useGameStore((s) => s.scene);
  const viewMapId = useGameStore((s) => s.viewMapId);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const targetTokenId = useGameStore((s) => s.targetTokenId);
  const role = useGameStore((s) => s.role);
  const library = useGameStore((s) => s.library);
  const rollDice = useGameStore((s) => s.rollDice);
  const sendAttack = useGameStore((s) => s.rollAttack);
  const setMeasureFrom = useGameStore((s) => s.setMeasureFrom);
  const rollDeathSave = useGameStore((s) => s.rollDeathSave);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<MenuLevel>('root');
  const [adv, setAdv] = useState(false);
  const [dis, setDis] = useState(false);
  const [sourceKey, setSourceKey] = useState<string | null>(null);

  const sheet = stored ?? defaultSheet();

  const sources = useMemo(() => {
    const out: AttackSource[] = [];
    const map = scene.maps.find((m) => m.id === viewMapId);
    if (sheet.attacks.filter(attackIsActive).length > 0) {
      const charToken = map?.tokens.find((t) => t.libraryItemId === currentCharacterId);
      out.push({ key: 'sheet', label: 'Мой персонаж', tokenId: charToken?.id, attacks: sheet.attacks });
    }
    const state = useGameStore.getState();
    for (const token of map?.tokens ?? []) {
      if (token.libraryItemId === currentCharacterId) continue;
      if (!canControlWith(state, token)) continue;
      const attacks = token.attacks ?? [];
      if (attacks.filter(attackIsActive).length === 0) continue;
      out.push({ key: token.id, label: token.name || 'Токен', tokenId: token.id, attacks });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- состояние берём через getState()
  }, [sheet, scene, viewMapId, currentCharacterId, role, library]);

  const currentMap = scene.maps.find((m) => m.id === viewMapId);
  const targetToken = currentMap?.tokens.find((t) => t.id === targetTokenId) ?? null;
  const targetName = targetToken?.name ?? '';
  const targetAc = targetToken && statNumber(targetToken.ac) > 0 ? statNumber(targetToken.ac) : 0;

  const rangeInfo = (source: AttackSource, attack: AttackEntry) => {
    if (!targetTokenId || !currentMap) return null;
    const attacker = currentMap.tokens.find((t) => t.id === source.tokenId);
    const target = currentMap.tokens.find((t) => t.id === targetTokenId);
    if (!attacker || !target || target.id === attacker.id) return null;
    const size = scene.grid.size || 50;
    const distanceFeet = gridDistanceFeet(attacker, target, size);
    const adjacentEnemy = currentMap.tokens.some(
      (t) => t.id !== attacker.id && !t.isPlayerToken && gridDistanceFeet(attacker, t, size) <= 5
    );
    return attackRange(attack, distanceFeet, adjacentEnemy);
  };

  const activeWithIndex = (attacks: AttackEntry[]) =>
    attacks.map((attack, index) => ({ attack, index })).filter((x) => attackIsActive(x.attack));

  const close = () => {
    setOpen(false);
    setLevel('root');
    setSourceKey(null);
    setMeasureFrom(null);
  };

  const resetAdv = () => {
    setAdv(false);
    setDis(false);
  };

  const doRoll = (expression: string, rollKind: 'save' | 'check', subject: string) => {
    rollDice(applyAdvantage(expression, adv, dis), undefined, { rollKind, subject });
    resetAdv();
    close();
  };

  const doWeapon = (source: AttackSource, index: number) => {
    const mode = adv && !dis ? 'a' : dis && !adv ? 'd' : undefined;
    sendAttack({ tokenId: source.tokenId, targetId: targetTokenId ?? undefined, attackIndex: index, advantage: mode });
    resetAdv();
    close();
  };

  const pickSource = (source: AttackSource) => {
    const active = activeWithIndex(source.attacks);
    if (active.length === 0) return;
    setMeasureFrom(source.tokenId ?? null);
    if (active.length === 1) {
      doWeapon(source, active[0].index);
      return;
    }
    setSourceKey(source.key);
    setLevel('attack');
  };

  const chooseAttack = () => {
    const list = sources.filter((s) => activeWithIndex(s.attacks).length > 0);
    if (list.length === 0) return;
    if (list.length === 1) pickSource(list[0]);
    else setLevel('source');
  };

  const currentSource = sources.find((s) => s.key === sourceKey) ?? null;

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
        title="Броски персонажа и его призывов"
        onClick={() => setOpen((v) => !v)}
      >
        ROLL
      </button>
      {open && (
        <>
          <div className="roll-menu-backdrop" onMouseDown={close} />
          <div className="roll-menu">
            {targetTokenId && targetName && (
              <div className="roll-menu-target">
                Цель: {targetName}
                {targetAc > 0 ? ` · AC ${targetAc}` : ''}
              </div>
            )}
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
            {level === 'source' && (
              <>
                <button className="roll-menu-item back" onClick={back('root')}>
                  ← назад
                </button>
                {sources
                  .filter((s) => activeWithIndex(s.attacks).length > 0)
                  .map((source) => (
                    <button className="roll-menu-item" key={source.key} onClick={() => pickSource(source)}>
                      {source.label}
                    </button>
                  ))}
              </>
            )}
            {level === 'attack' && currentSource && (
              <>
                <button className="roll-menu-item back" onClick={back(sources.length > 1 ? 'source' : 'root')}>
                  ← назад
                </button>
                {activeWithIndex(currentSource.attacks).map(({ attack, index }) => {
                  const info = rangeInfo(currentSource, attack);
                  const blocked = !!info?.outOfRange;
                  const note = info
                    ? blocked
                      ? ` · ${info.reason}`
                      : ` · ${Math.round(info.distanceFeet)} фт${
                          info.disadvantage
                            ? ` (помеха${info.disadvantageReason ? `: ${info.disadvantageReason}` : ''})`
                            : ''
                        }`
                    : '';
                  return (
                    <button
                      className="roll-menu-item"
                      key={index}
                      disabled={blocked}
                      title={blocked ? `${info?.reason}: ${Math.round(info?.distanceFeet ?? 0)} фт` : undefined}
                      onClick={() => doWeapon(currentSource, index)}
                    >
                      {(attack.name.trim() || `Оружие ${index + 1}`) + note}
                    </button>
                  );
                })}
              </>
            )}
            {level === 'save' && (
              <>
                <button className="roll-menu-item back" onClick={back('root')}>
                  ← назад
                </button>
                <button
                  className="roll-menu-item"
                  onClick={() => {
                    rollDeathSave(applyAdvantage('d20', adv, dis));
                    resetAdv();
                    close();
                  }}
                >
                  Death Save
                </button>
                {ABILITIES.map((a) => (
                  <button
                    className="roll-menu-item"
                    key={a.key}
                    onClick={() => doRoll(saveExpression(sheet, a.key), 'save', a.name)}
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
                    onClick={() => doRoll(checkExpression(sheet, s.key), 'check', s.name)}
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
