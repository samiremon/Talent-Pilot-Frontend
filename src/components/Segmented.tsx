/**
 * A row of buttons where exactly one is chosen (a "segmented control"), e.g.
 *
 *   Show   [ All | Top 5 | Top 10 | Top 20 | Top 50 ]
 *   Email  [ All | Found 31 | Missing 48 ]
 *
 * One click to change (no dropdown to open), and the chosen one is highlighted in the
 * app's accent colour. Keyboard: Tab to the group, arrow keys to move, like radio buttons.
 */
import { useRef, type KeyboardEvent } from 'react';

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
