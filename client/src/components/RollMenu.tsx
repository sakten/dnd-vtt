import { useMemo, useState } from 'react';
import {
  ABILITIES,
  SKILLS,
  attackIsActive,
  type AbilityKey,
  type AttackEntry,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { activeMapOf, characterTokenOf } from '../store/selectors';
import { canControlWith } from '../lib/control';
import { advantagedExpression } from '../lib/rollMode';
import { checkExpression, defaultSheet, saveExpression } from '../lib/sheet';
import { t } from '../i18n';
import { abilityName, skillName } from '../i18n/domain';

type MenuLevel = 'root' | 'source' | 'attack' | 'save' | 'check' | `ability:${AbilityKey}`;

interface AttackSource {
  key: string;
  label: string;
  tokenId?: string;
  attacks: AttackEntry[];
}

function applyAdvantage(expression: string, adv: boolean, dis: boolean): string {
  return advantagedExpression(expression, adv, dis);
}

export default function RollMenu() {
  const stored = useGameStore((s) => s.sheet);
  const scene = useGameStore((s) => s.scene);
  const viewMapId = useGameStore((s) => s.viewMapId);
  const currentCharacterId = useGameStore((s) => s.currentCharacterId);
  const role = useGameStore((s) => s.role);
  const lang = useGameStore((s) => s.lang);
  const library = useGameStore((s) => s.library);
  const rollDice = useGameStore((s) => s.rollDice);
  const startTargeting = useGameStore((s) => s.startTargeting);
  const rollDeathSave = useGameStore((s) => s.rollDeathSave);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<MenuLevel>('root');
  const [adv, setAdv] = useState(false);
  const [dis, setDis] = useState(false);
  const [sourceKey, setSourceKey] = useState<string | null>(null);

  const sheet = stored ?? defaultSheet();

  const sources = useMemo(() => {
    const out: AttackSource[] = [];
    const state = useGameStore.getState();
    const map = activeMapOf(state);
    if (sheet.attacks.filter(attackIsActive).length > 0) {
      const charToken = characterTokenOf(map, currentCharacterId);
      out.push({ key: 'sheet', label: t('ui.roll.myCharacter'), tokenId: charToken?.id, attacks: sheet.attacks });
    }
    for (const token of map?.tokens ?? []) {
      if (token.libraryItemId === currentCharacterId) continue;
      if (!canControlWith(state, token)) continue;
      const attacks = token.attacks ?? [];
      if (attacks.filter(attackIsActive).length === 0) continue;
      out.push({ key: token.id, label: token.name || t('ui.roll.token'), tokenId: token.id, attacks });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- состояние берём через getState()
  }, [sheet, scene, viewMapId, currentCharacterId, role, library, lang]);

  const activeWithIndex = (attacks: AttackEntry[]) =>
    attacks.map((attack, index) => ({ attack, index })).filter((x) => attackIsActive(x.attack));

  const close = () => {
    setOpen(false);
    setLevel('root');
    setSourceKey(null);
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
    const entry = source.attacks[index];
    const label = entry?.name.trim() || t('ui.roll.weapon', { n: index + 1 });
    startTargeting({
      kind: 'rollAttack',
      tokenId: source.tokenId,
      attackIndex: index,
      advantage: mode,
      label: t('ui.roll.attackLabel', { name: label }),
    });
    resetAdv();
    close();
  };

  const pickSource = (source: AttackSource) => {
    const active = activeWithIndex(source.attacks);
    if (active.length === 0) return;
    if (active.length === 1) {
      doWeapon(source, active[0]!.index);
      return;
    }
    setSourceKey(source.key);
    setLevel('attack');
  };

  const chooseAttack = () => {
    const list = sources.filter((s) => activeWithIndex(s.attacks).length > 0);
    if (list.length === 0) return;
    if (list.length === 1) pickSource(list[0]!);
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
        <label className="adv-check" data-testid="adv-check" title={t('ui.roll.advTitle')}>
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
        <label className="adv-check" data-testid="adv-check" title={t('ui.roll.disTitle')}>
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
        data-testid="roll-button"
        title={t('ui.roll.title')}
        onClick={() => setOpen((v) => !v)}
      >
        ROLL
      </button>
      {open && (
        <>
          <div className="roll-menu-backdrop" onMouseDown={close} />
          <div className="roll-menu" data-testid="roll-menu">
            {level === 'root' && (
              <>
                <button className="roll-menu-item" data-testid="roll-menu-item" onClick={chooseAttack}>
                  Attack
                </button>
                <button className="roll-menu-item" data-testid="roll-menu-item" onClick={() => setLevel('save')}>
                  Save
                </button>
                <button className="roll-menu-item" data-testid="roll-menu-item" onClick={() => setLevel('check')}>
                  Check
                </button>
              </>
            )}
            {level === 'source' && (
              <>
                <button className="roll-menu-item back" onClick={back('root')}>
                  {t('ui.roll.back')}
                </button>
                {sources
                  .filter((s) => activeWithIndex(s.attacks).length > 0)
                  .map((source) => (
                    <button className="roll-menu-item" data-testid="roll-menu-item" key={source.key} onClick={() => pickSource(source)}>
                      {source.label}
                    </button>
                  ))}
              </>
            )}
            {level === 'attack' && currentSource && (
              <>
                <button className="roll-menu-item back" onClick={back(sources.length > 1 ? 'source' : 'root')}>
                  {t('ui.roll.back')}
                </button>
                {activeWithIndex(currentSource.attacks).map(({ attack, index }) => (
                  <button
                    className="roll-menu-item" data-testid="roll-menu-item"
                    key={index}
                    onClick={() => doWeapon(currentSource, index)}
                  >
                    {attack.name.trim() || t('ui.roll.weapon', { n: index + 1 })}
                  </button>
                ))}
              </>
            )}
            {level === 'save' && (
              <>
                <button className="roll-menu-item back" onClick={back('root')}>
                  {t('ui.roll.back')}
                </button>
                <button
                  className="roll-menu-item" data-testid="roll-menu-item"
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
                    className="roll-menu-item" data-testid="roll-menu-item"
                    key={a.key}
                    onClick={() => doRoll(saveExpression(sheet, a.key), 'save', abilityName(a.key))}
                  >
                    {abilityName(a.key)}
                  </button>
                ))}
              </>
            )}
            {level === 'check' && (
              <>
                <button className="roll-menu-item back" onClick={back('root')}>
                  {t('ui.roll.back')}
                </button>
                {ABILITIES.map((a) => (
                  <button className="roll-menu-item" data-testid="roll-menu-item" key={a.key} onClick={() => setLevel(`ability:${a.key}`)}>
                    {abilityName(a.key)}
                  </button>
                ))}
              </>
            )}
            {level.startsWith('ability:') && (
              <>
                <button className="roll-menu-item back" onClick={back('check')}>
                  {t('ui.roll.back')}
                </button>
                {SKILLS.filter((s) => s.ability === (level.slice(8) as AbilityKey)).map((s) => (
                  <button
                    className="roll-menu-item" data-testid="roll-menu-item"
                    key={s.key}
                    onClick={() => doRoll(checkExpression(sheet, s.key), 'check', skillName(s.key))}
                  >
                    {skillName(s.key)}
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
