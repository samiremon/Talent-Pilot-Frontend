/**
 * A box for entering a list of short words, like skills: "React", "TypeScript".
 * Type a word and press Enter or comma to add it as a chip; click × to remove one;
 * Backspace on an empty box removes the last chip. Pasting "React, Node, SQL" adds all three.
 */
import { X } from 'lucide-react';
import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';

interface TagInputProps {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
}

export function TagInput({ id, value, onChange, placeholder, max = 30 }: TagInputProps) {
  const [draft, setDraft] = useState('');

  /** Adds words, skipping blanks and ones already there (ignoring upper/lower case). */
  function add(words: string[]) {
    const next = [...value];
    for (const word of words.map((w) => w.trim()).filter(Boolean)) {
      if (next.length >= max) break;
      if (!next.some((existing) => existing.toLowerCase() === word.toLowerCase())) next.push(word);
    }
    onChange(next);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault(); // don't submit the form / don't type the comma
      add([draft]);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text');
    if (text.includes(',') || text.includes('\n')) {
      event.preventDefault();
      add(text.split(/[,\n]/));
    }
  }

  return (
    <div className="tag-input">
      {value.map((tag) => (
        <span key={tag} className="tag-input__tag">
          {tag}
          <button
            type="button"
            className="tag-input__remove"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        className="tag-input__field"
        value={draft}
        placeholder={value.length === 0 ? placeholder : ''}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        // Leaving the box with a half-typed word keeps it instead of losing it.
        onBlur={() => draft.trim() && add([draft])}
      />
    </div>
  );
}
