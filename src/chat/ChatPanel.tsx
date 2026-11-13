/**
 * The AI chat panel on the right side of every page.
 *
 * Right now it's the FRAME only: you can type and see your message, and a placeholder
 * reply explains that the AI isn't connected yet. A later step connects it to the
 * backend (Groq + LangGraph) and adds the interactive cards (job card, candidate table,
 * email preview, approval buttons).
 *
 * The parent (AppShell) decides whether it's docked, expanded or minimized. When minimized
 * the panel is only HIDDEN, not removed, so the conversation is still there when it reopens.
 */
import { Bot, Maximize2, Minimize2, Minus, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { ChatMode } from './useChatPanel';
import './chat.css';

export interface ChatMessage {
  id: number;
  from: 'ai' | 'user';
  text: string;
}

interface ChatPanelProps {
  mode: ChatMode;
  onMinimize: () => void;
  onToggleExpanded: () => void;
  /** Called when the AI adds a message (so the bot button can show a red dot if minimized). */
  onAiMessage: () => void;
  /** What the recruiter is looking at, e.g. "Jobs". Shown under the title. */
  context: string;
}

// Ideas shown above the input box, to help a first-time user get started.
const SUGGESTIONS = ['Create a job from a description', 'Find candidates', 'How are my jobs going?'];

export function ChatPanel({ mode, onMinimize, onToggleExpanded, onAiMessage, context }: ChatPanelProps) {
  const { user } = useAuth();
  const expanded = mode === 'expanded';
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 1,
      from: 'ai',
      text: `Hi ${user?.name ?? 'there'}! I'm TalentPilot, your recruiting co-worker.\n\nPaste a job description (or a link to one) and I'll turn it into a job, find candidates, and help you reach out. I never change anything without your OK.`,
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(2);

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, { id: nextId.current++, from: 'user', text: trimmed }]);
    setDraft('');

    // Placeholder reply until the real AI is connected.
    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          from: 'ai',
          text: "I'm not connected yet: the AI is added in a later step. For now this panel shows where we'll talk.",
        },
      ]);
      onAiMessage();
    }, 500);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(draft);
  }

  // Enter sends; Shift+Enter makes a new line (like most chat apps).
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(draft);
    }
  }

  return (
    <aside
      className={`chat ${expanded ? 'chat--expanded' : 'chat--open'}`}
      aria-label="TalentPilot AI chat"
      hidden={mode === 'minimized'}
    >
      <header className="chat__header">
        <span className="chat__avatar" aria-hidden="true">
          <Bot size={18} />
        </span>
        <div>
          <div className="chat__title">
            TalentPilot AI <span className="pill pill--warn">Not connected yet</span>
          </div>
          <div className="chat__subtitle">Looking at: {context}</div>
        </div>
        <div className="chat__actions">
          <button
            type="button"
            className="icon-button chat__expand"
            onClick={onToggleExpanded}
            aria-label={expanded ? 'Shrink chat to the side' : 'Expand chat to full width'}
            title={expanded ? 'Shrink' : 'Expand'}
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button type="button" className="icon-button" onClick={onMinimize} aria-label="Minimize chat" title="Minimize">
            <Minus size={16} />
          </button>
        </div>
      </header>

      {/* aria-live: screen readers announce new messages as they arrive. */}
      <div className="chat__messages" ref={listRef} aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`message message--${message.from}`}>
            <div className="message__bubble">{message.text}</div>
          </div>
        ))}
      </div>

      <div className="chat__composer">
        <div className="chat__suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" className="chip" onClick={() => send(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
        <form className="chat__form" onSubmit={handleSubmit}>
          <label htmlFor="chat-input" className="sr-only">
            Message TalentPilot
          </label>
          <textarea
            id="chat-input"
            className="chat__input"
            rows={1}
            placeholder="Ask TalentPilot…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" className="chat__send" disabled={!draft.trim()} aria-label="Send message">
            <Send size={16} />
          </button>
        </form>
        <p className="chat__hint">TalentPilot asks before any action that changes data or sends email.</p>
      </div>
    </aside>
  );
}
