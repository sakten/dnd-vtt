import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, DiceRollResult } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { formatRoll } from '../lib/format';
import RollMenu from './RollMenu';
import CharacterSheetModal from './CharacterSheetModal';

const DIE_POINTS: Record<number, string> = {
  4: '0,-14 13,10 -13,10',
  6: '-11,-11 11,-11 11,11 -11,11',
  8: '0,-14 11,0 0,14 -11,0',
  10: '0,-14 10,-2 4,13 -4,13 -10,-2',
  12: '0,-14 13,-4 8,11 -8,11 -13,-4',
  20: '0,-14 12,-7 12,7 0,14 -12,7 -12,-7',
};

function DieIcon({ sides, value, dropped }: { sides: number; value: number; dropped: boolean }) {
  const points = DIE_POINTS[sides] ?? DIE_POINTS[6];
  let fill = '#2b3039';
  if (sides === 20 && value === 20) fill = '#4ecb71';
  else if (sides === 20 && value === 1) fill = '#ff6b6b';
  return (
    <svg className="die-icon" viewBox="-16 -16 32 32" width="28" height="28" opacity={dropped ? 0.55 : 1}>
      <polygon points={points} fill={fill} stroke="#7c9cff" strokeWidth="1.5" />
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
}

type Term = DieEntry | { kind: 'bonus'; value: number };

function buildTerms(roll: DiceRollResult): Term[] {
  const terms: Term[] = [];
  for (const group of roll.dice) {
    for (const v of group.values) terms.push({ kind: 'die', sides: group.sides, value: v, dropped: false });
    for (const v of group.dropped) terms.push({ kind: 'die', sides: group.sides, value: v, dropped: true });
  }
  if (roll.modifier !== 0) terms.push({ kind: 'bonus', value: roll.modifier });
  return terms;
}

function rollLabelType(label?: string): 'attack' | 'save' | 'check' | 'plain' {
  if (!label) return 'plain';
  if (label.startsWith('Атака') || label.startsWith('Урон')) return 'attack';
  if (label.startsWith('Спасбросок')) return 'save';
  if (label.startsWith('Проверка')) return 'check';
  return 'plain';
}

function formulaFromRoll(roll: DiceRollResult): string {
  const groups = [...roll.dice].sort((a, b) => b.sides - a.sides);
  const parts = groups.map((d) => {
    if (d.advantage) return `${d.values.length}d${d.sides}${d.advantage}`;
    const total = d.values.length + d.dropped.length;
    if (d.dropped.length > 0) return `${total}d${d.sides}k${d.values.length}`;
    return total === 1 ? `d${d.sides}` : `${total}d${d.sides}`;
  });
  let out = parts.join(' + ');
  if (roll.modifier > 0) out += ` + ${roll.modifier}`;
  else if (roll.modifier < 0) out += ` - ${Math.abs(roll.modifier)}`;
  return out;
}

function MessageView({ message }: { message: ChatMessage }) {
  const rollDice = useGameStore((s) => s.rollDice);
  if (message.kind === 'text') {
    return (
      <div className="chat-msg">
        <span className="chat-author">{message.author}:</span>
        <span className="chat-text"> {message.text}</span>
      </div>
    );
  }
  const crit = message.crit ? 'crit' : formatRoll(message.roll).crit;
  const labelType = rollLabelType(message.label);
  const dice = buildTerms(message.roll)
    .filter((t): t is DieEntry => t.kind === 'die')
    .sort((a, b) => b.sides - a.sides || b.value - a.value || (a.dropped ? 1 : 0) - (b.dropped ? 1 : 0));

  return (
    <div
      className={`chat-msg roll roll-card ${labelType}`}
      title="Клик — повторить бросок"
      onClick={() => rollDice(message.roll.expression, message.label)}
    >
      <div className="roll-head-left">{message.author}</div>
      <div className="roll-head-divider" />
      <div className="roll-head-right">
        {message.label && <span className="roll-label">{message.label}</span>}
      </div>
      <div className={`roll-total-big ${crit ?? ''}`}>{message.roll.total}</div>
      <div className="roll-divider" />
      <div className="roll-right-col">
        <div className="roll-formula">{formulaFromRoll(message.roll)}</div>
        <div className="roll-terms">
          {dice.map((d, i) => (
            <DieIcon key={i} sides={d.sides} value={d.value} dropped={d.dropped} />
          ))}
          {message.roll.modifier > 0 && <span className="roll-plus">+</span>}
          {message.roll.modifier !== 0 && (
            <span className="roll-bonus">{message.roll.modifier}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const chat = useGameStore((s) => s.chat);
  const chatError = useGameStore((s) => s.chatError);
  const players = useGameStore((s) => s.players);
  const roomCode = useGameStore((s) => s.roomCode);
  const roomName = useGameStore((s) => s.roomName);
  const shortCode = roomCode && roomCode.length > 8 ? `${roomCode.slice(0, 6)}…` : roomCode;
  const sendChat = useGameStore((s) => s.sendChat);
  const [text, setText] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length, chatError]);

  const send = () => {
    if (!text.trim()) return;
    sendChat(text);
    setHistory((h) => [...h, text]);
    setHistoryIndex(-1);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      send();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(idx);
      setText(history[idx]);
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
        setText(history[idx]);
      }
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <strong title={`${roomName ?? ''} (${roomCode ?? ''})`}>Комната: {roomName || shortCode}</strong>
        <div className="chat-header-actions">
          <button className="sheet-button" title="Карточка персонажа" onClick={() => setSheetOpen(true)}>
            Персонаж
          </button>
          <span>{players.length} игрок(ов)</span>
        </div>
      </div>
      <div className="chat-players">
        {players.map((p) => (
          <span key={p.id} className={`player-chip ${p.isConnected ? 'online' : 'offline'}`}>
            {p.name}
            {p.role === 'dm' ? ' (DM)' : ''}
          </span>
        ))}
      </div>
      <div className="chat-messages" ref={listRef}>
        {chat.map((m) => (
          <MessageView key={m.id} message={m} />
        ))}
        {chatError && <div className="chat-error">{chatError}</div>}
      </div>
      <div className="chat-input">
        <RollMenu />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Сообщение или бросок: d20 + 3"
        />
        <button onClick={send}>→</button>
      </div>
      <CharacterSheetModal open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
