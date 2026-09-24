import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { type ChatMessage, type DiceRollResult, type RollKind } from 'shared';
import { rollMessageLabel } from '../i18n/rolls';
import { systemText } from '../i18n/system';
import { nextLang, t } from '../i18n';
import { useGameStore } from '../store/useGameStore';
import { formatRoll } from '../lib/format';
import { damageTypeColor } from '../lib/damageColors';
import { damageTypeHint, applyDamageHint } from '../lib/damageHint';
import { damageLabel } from '../i18n/domain';
import { rollOutcome } from '../lib/rollOutcome';
import { useDragSize } from '../lib/useDragSize';
import RollMenu from './RollMenu';
import CharacterSheetModal from './CharacterSheetModal';
import PlayersDrawer from './PlayersDrawer';

const DIE_POINTS: Record<number, string> = {
  4: '0,-14 13,10 -13,10',
  6: '-11,-11 11,-11 11,11 -11,11',
  8: '0,-14 11,0 0,14 -11,0',
  10: '0,-14 10,-2 4,13 -4,13 -10,-2',
  12: '0,-14 13,-4 8,11 -8,11 -13,-4',
  20: '0,-14 12,-7 12,7 0,14 -12,7 -12,-7',
};

function DieIcon({ sides, value, dropped, tint }: { sides: number; value: number; dropped: boolean; tint?: string }) {
  const points = DIE_POINTS[sides] ?? DIE_POINTS[6];
  let fill = tint ? `${tint}3d` : '#2b3039';
  if (sides === 20 && value === 20) fill = '#4ecb71';
  else if (sides === 20 && value === 1) fill = '#ff6b6b';
  return (
    <svg className="die-icon" viewBox="-16 -16 32 32" width="26" height="26" opacity={dropped ? 0.55 : 1}>
      <polygon points={points} fill={fill} stroke={tint ?? '#7c9cff'} strokeWidth="1.5" />
      {dropped && <line x1="-14" y1="-14" x2="14" y2="14" stroke="#ff6b6b" strokeWidth="3" />}
      <text x="0" y="4.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">
        {value}
      </text>
    </svg>
  );
}

interface DieEntry {
  kind: 'die';
  sides: number;
  value: number;
  dropped: boolean;
  negative: boolean;
  /** Тип урона терма (`1d6fire`); нет — основной тип броска. */
  damageType?: string;
}

type Term = DieEntry | { kind: 'bonus'; value: number };

function buildTerms(roll: DiceRollResult): Term[] {
  const terms: Term[] = [];
  for (const group of roll.dice) {
    const negative = group.sign === -1;
    for (const v of group.values)
      terms.push({ kind: 'die', sides: group.sides, value: v, dropped: false, negative, ...(group.damageType ? { damageType: group.damageType } : {}) });
    for (const v of group.dropped)
      terms.push({ kind: 'die', sides: group.sides, value: v, dropped: true, negative, ...(group.damageType ? { damageType: group.damageType } : {}) });
  }
  if (roll.modifier !== 0) terms.push({ kind: 'bonus', value: roll.modifier });
  return terms;
}

function rollLabelType(kind?: RollKind, label?: string): 'attack' | 'save' | 'check' | 'plain' {
  if (kind && kind !== 'plain') {
    if (kind === 'attack' || kind === 'damage') return 'attack';
    if (kind === 'save' || kind === 'death') return 'save';
    if (kind === 'check') return 'check';
    return 'plain';
  }
  if (!label) return 'plain';
  if (label.startsWith('Атака') || label.startsWith('Урон')) return 'attack';
  if (label.startsWith('Спасбросок')) return 'save';
  if (label.startsWith('Проверка')) return 'check';
  return 'plain';
}

/** Галочка/крестик исхода правее кубиков. */
function OutcomeMark({ outcome }: { outcome: 'success' | 'fail' }) {
  const ok = outcome === 'success';
  const title = ok ? t('ui.roll.outcomeOk') : t('ui.roll.outcomeFail');
  return (
    <span className={`roll-outcome ${ok ? 'ok' : 'bad'}`} data-testid="roll-outcome" title={title} aria-label={title}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        {ok ? (
          <path
            d="M4 12.5l5 5L20 6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}

function authorLabel(author: string): string {
  return author === 'Система' ? t('ui.chat.system') : author;
}

function formulaFromRoll(roll: DiceRollResult): string {
  const groups = [...roll.dice].sort((a, b) => b.sides - a.sides);
  let out = '';
  for (const d of groups) {
    const core = d.advantage
      ? `${d.values.length}d${d.sides}${d.advantage}`
      : d.dropped.length > 0
        ? `${d.values.length + d.dropped.length}d${d.sides}k${d.values.length}`
        : d.values.length === 1
          ? `d${d.sides}`
          : `${d.values.length}d${d.sides}`;
    if (!out) out = d.sign === -1 ? `-${core}` : core;
    else out += d.sign === -1 ? ` - ${core}` : ` + ${core}`;
  }
  if (roll.modifier > 0) out += ` + ${roll.modifier}`;
  else if (roll.modifier < 0) out += ` - ${Math.abs(roll.modifier)}`;
  return out;
}

function MessageView({ message, grouped }: { message: ChatMessage; grouped?: boolean }) {
  const rollDice = useGameStore((s) => s.rollDice);
  if (message.kind === 'text') {
    return (
      <div className={`chat-msg${grouped ? ' grouped' : ''}`} data-testid="chat-msg">
        {!grouped && <span className="chat-author">{authorLabel(message.author)}:</span>}
        <span className="chat-text"> {systemText(message)}</span>
      </div>
    );
  }
  const crit = message.crit ? 'crit' : formatRoll(message.roll);
  const label = rollMessageLabel(message);
  const labelType = rollLabelType(message.rollKind, message.label);
  const outcome = rollOutcome(message);
  const dice = buildTerms(message.roll)
    .filter((t): t is DieEntry => t.kind === 'die')
    .sort((a, b) => b.sides - a.sides || b.value - a.value || (a.dropped ? 1 : 0) - (b.dropped ? 1 : 0));
  // Кубики урона — по типу: свой у терма, иначе основной тип броска урона.
  const tintOf = (d: DieEntry): string | undefined =>
    damageTypeColor(d.damageType ?? (message.rollKind === 'damage' ? message.labelParams?.damageType : undefined));

  return (
    <div
      className={`chat-msg roll roll-card ${labelType}${grouped ? ' grouped' : ''}`}
      data-testid="chat-msg-roll"
      title={label ? t('ui.chat.replayLabel', { label }) : t('ui.chat.replay')}
      onClick={() => rollDice(message.roll.expression, label)}
    >
      {label && (
        <div className="roll-label-row">
          <span className="roll-label">{label}</span>
        </div>
      )}
      <div className={`roll-total-big ${crit ?? ''}`} data-testid="roll-total-big">{message.roll.total}</div>
      <div className="roll-divider" />
      <div className="roll-right-col">
        <div className="roll-formula">{formulaFromRoll(message.roll)}</div>
        <div className="roll-terms-row">
          <div className="roll-terms">
            {dice.map((d, i) => (
              <Fragment key={i}>
                {d.negative && <span className="roll-minus">−</span>}
                <DieIcon sides={d.sides} value={d.value} dropped={d.dropped} tint={tintOf(d)} />
              </Fragment>
            ))}
            {message.roll.modifier > 0 && <span className="roll-plus">+</span>}
            {message.roll.modifier !== 0 && (
              <span className="roll-bonus">{message.roll.modifier}</span>
            )}
          </div>
          {outcome && <OutcomeMark outcome={outcome} />}
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const chat = useGameStore((s) => s.chat);
  const chatError = useGameStore((s) => s.chatError);
  const players = useGameStore((s) => s.players);
  const lang = useGameStore((s) => s.lang);
  const setLang = useGameStore((s) => s.setLang);
  const roomCode = useGameStore((s) => s.roomCode);
  const roomName = useGameStore((s) => s.roomName);
  const shortCode = roomCode && roomCode.length > 8 ? `${roomCode.slice(0, 6)}…` : roomCode;
  const sendChat = useGameStore((s) => s.sendChat);
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const damageHint = damageTypeHint(text, caret);
  const sheetOpen = useGameStore((s) => s.sheetOpen);
  const setSheetOpen = useGameStore((s) => s.setSheetOpen);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const clampWidth = useCallback(
    (v: number) => Math.max(300, Math.min(v, Math.min(900, window.innerWidth - 320))),
    []
  );
  const measureWidth = useCallback(() => panelRef.current?.offsetWidth ?? 360, []);
  const {
    size: panelWidth,
    onPointerDown: onResizeDown,
    onPointerMove: onResizeMove,
  } = useDragSize('vtt-chat-width', 'x', clampWidth, 360, measureWidth);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length, chatError]);

  useEffect(() => {
    document.documentElement.style.setProperty('--chat-w', `${panelWidth ?? 360}px`);
  }, [panelWidth]);

  const send = () => {
    if (!text.trim()) return;
    sendChat(text);
    setHistory((h) => [...h, text]);
    setHistoryIndex(-1);
    setText('');
    setCaret(0);
  };

  const acceptDamageHint = (option: string) => {
    if (!damageHint) return;
    const next = applyDamageHint(text, damageHint, option);
    setText(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && damageHint) {
      e.preventDefault();
      acceptDamageHint(damageHint.options[0]!);
      return;
    }
    if (e.key === 'Enter') {
      // Незаконченный тип после кубика: первый Enter — как Tab (автодополнение), второй — бросок.
      if (damageHint) {
        e.preventDefault();
        acceptDamageHint(damageHint.options[0]!);
        return;
      }
      send();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(idx);
      setText(history[idx] ?? '');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const idx = historyIndex + 1;
      if (idx >= history.length) {
        setHistoryIndex(-1);
        setText('');
      } else {
        setHistoryIndex(idx);
        setText(history[idx] ?? '');
      }
    }
  };

  // Серии подряд от одного автора: имя — один заголовок на серию (системные не разрывают).
  const groups: { key: string; author?: string; items: ChatMessage[] }[] = [];
  for (const m of chat) {
    const last = groups[groups.length - 1];
    if (m.author === 'Система') {
      if (last) last.items.push(m);
      else groups.push({ key: m.id, items: [m] });
      continue;
    }
    if (last?.author === m.author) last.items.push(m);
    else groups.push({ key: m.id, author: m.author, items: [m] });
  }

  const chatScale = Math.min(1.8, Math.max(0.9, (panelWidth ?? 360) / 360));
  const panelStyle = {
    ...(panelWidth != null ? { width: panelWidth } : {}),
    '--chat-scale': String(chatScale),
  } as React.CSSProperties;

  return (
    <div className="chat-panel" ref={panelRef} style={panelStyle}>
      <div className="chat-resizer" onPointerDown={onResizeDown} onPointerMove={onResizeMove} />
      <div className="chat-header">
        <strong title={`${roomName ?? ''} (${roomCode ?? ''})`}>
          {t('ui.chat.room')} {roomName || shortCode}
        </strong>
        <div className="chat-header-actions">
          <button
            className="sheet-button"
            data-testid="lang-toggle"
            title={t('ui.language')}
            onClick={() => setLang(nextLang(lang))}
          >
            {nextLang(lang).toUpperCase()}
          </button>
          <button className="sheet-button" data-testid="sheet-button" title={t('ui.chat.sheetTitle')} onClick={() => setSheetOpen(true)}>
            {t('ui.chat.sheet')}
          </button>
          <button className="sheet-button" data-testid="sheet-button" title={t('ui.chat.playersTitle')} onClick={() => setPlayersOpen(true)}>
            {t('ui.chat.players', { count: players.length })}
          </button>
        </div>
      </div>
      <div className="chat-messages" ref={listRef}>
        {groups.map((g) => (
          <div className="chat-group" key={g.key}>
            {g.author && <div className="chat-group-author">{authorLabel(g.author)}</div>}
            {g.items.map((m) => (
              <MessageView key={m.id} message={m} grouped={!!g.author} />
            ))}
          </div>
        ))}
        {chatError && <div className="chat-error">{chatError}</div>}
      </div>
      <div className="chat-input" data-testid="chat-input">
        <RollMenu />
        {damageHint && (
          <div className="chat-hints" data-testid="damage-hints" title={t('ui.chat.damageHint')}>
            {damageHint.options.map((option) => (
              <button
                key={option}
                type="button"
                className="chat-hint"
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptDamageHint(option);
                }}
              >
                <i style={{ background: damageTypeColor(option) ?? 'var(--accent, #7c9cff)' }} />
                {damageLabel(option)}
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={handleKeyDown}
          placeholder={t('ui.chat.placeholder')}
        />
        <button onClick={send}>→</button>
      </div>
      <PlayersDrawer players={players} open={playersOpen} onClose={() => setPlayersOpen(false)} />
      <CharacterSheetModal open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
