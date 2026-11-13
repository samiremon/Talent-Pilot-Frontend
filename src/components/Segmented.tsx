/**
 * A row of buttons where exactly one is chosen (a "segmented control"), e.g.
 *
 *   Email  [ All | Found 31 | Missing 48 ]
 *   Show   [ All | Top [ 15 ] ]          (TopPicker below: type any number)
 *
 * One click to change (no dropdown to open), and the chosen one is highlighted in the
 * app's accent colour. Keyboard: Tab to the group, arrow keys to move, like radio buttons.
 */
import { useRef, useState, type KeyboardEvent } from 'react';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  /** Optional number shown in a small badge, e.g. how many candidates match. */
  count?: number;
}

interface Props<T extends string | number> {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string | number>({ label, options, value, onChange }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);

  // Arrow keys move the choice (and focus) like a radio group.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = options.findIndex((o) => o.value === value);
    const next = options[(index + (event.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length]!;
    onChange(next.value);
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button');
    buttons?.[options.indexOf(next)]?.focus();
  }

  return (
    <div className="segmented-field">
      <span className="segmented-field__label">{label}</span>
      <div ref={ref} className="segmented" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              className={`segmented__option${active ? ' segmented__option--active' : ''}`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
              {option.count !== undefined && <span className="segmented__count">{option.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * "Show:  [ All | Top [ 15 ] ]": everyone, or only the best N, with N typed in.
 * value 0 = everyone. Typing a number switches to "Top N"; All clears it.
 */
export function TopPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(value ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const isTop = value > 0;

  function typed(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setText(digits);
    onChange(digits ? Math.max(1, Number(digits)) : 0);
  }

  return (
    <div className="segmented-field">
      <span className="segmented-field__label">Show</span>
      <div className="segmented" role="group" aria-label="Show">
        <button
          type="button"
          aria-pressed={!isTop}
          className={`segmented__option${!isTop ? ' segmented__option--active' : ''}`}
          onClick={() => {
            setText('');
            onChange(0);
          }}
        >
          All
        </button>
        <label
          className={`segmented__option segmented__option--input${isTop ? ' segmented__option--active' : ''}`}
          onClick={() => inputRef.current?.focus()}
        >
          Top
          <input
            ref={inputRef}
            inputMode="numeric"
            className="segmented__number"
            value={text}
            onChange={(e) => typed(e.target.value)}
            placeholder="N"
            aria-label="Show only the top N candidates"
          />
        </label>
      </div>
    </div>
  );
}
