import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { damageLabel } from '../i18n/domain';
import { damageTypeColor } from '../lib/damageColors';
import { applyDamageHint, damageTypeHint } from '../lib/damageHint';
import { damageDiceText, parseDamageDiceText, type DamageDiceValue } from '../lib/damageDice';
import { Field } from './Field';

/** Поле костей с типами урона в стиле чата: `3d6fi` → fire (Tab/Enter/клик). */
export default function DamageDiceField({
  value,
  onChange,
  placeholder,
}: {
  value: DamageDiceValue;
  onChange: (value: DamageDiceValue) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => damageDiceText(value));
  const [caret, setCaret] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const signature = JSON.stringify([value.dice, value.types]);
  const lastSignature = useRef(signature);
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setText(damageDiceText(value));
  }, [signature, value]);

  const hint = damageTypeHint(text, caret);
  const update = (next: string) => {
    const parsed = parseDamageDiceText(next, value.types);
    lastSignature.current = JSON.stringify([parsed.dice, parsed.types]);
    onChange(parsed);
  };
  const accept = (option: string) => {
    if (!hint) return;
    const next = applyDamageHint(text, hint, option);
    setText(next.text);
    setCaret(next.caret);
    update(next.text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <Field label={t('ui.constructor.damageDice')}>
      <span className="damage-dice-field">
        <input
          ref={inputRef}
          type="text"
          value={text}
          placeholder={placeholder}
          title={t('ui.chat.damageHint')}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            update(e.target.value);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={(e) => {
            if ((e.key === 'Tab' || e.key === 'Enter') && hint) {
              e.preventDefault();
              accept(hint.options[0]!);
            }
          }}
        />
        {hint && (
          <span className="chat-hints" title={t('ui.chat.damageHint')}>
            {hint.options.map((option) => (
              <button
                key={option}
                type="button"
                className="chat-hint"
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(option);
                }}
              >
                <i style={{ background: damageTypeColor(option) ?? 'var(--accent, #7c9cff)' }} />
                {damageLabel(option)}
              </button>
            ))}
          </span>
        )}
      </span>
    </Field>
  );
}
