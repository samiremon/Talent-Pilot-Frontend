/**
 * The AI chat panel on the right side of every page, connected to the backend:
 *
 *   - On load it fetches the saved conversation (GET /api/chat/messages), so a refresh
 *     keeps everything. The header shows the real AI status: Online (Groq) or Mock mode.
 *   - Sending a message shows it straight away plus a "typing" indicator, then posts it
 *     (POST /api/chat/messages) together with the job you're looking at, and shows the
 *     AI's reply and any cards (e.g. the job card) it returns.
 *   - Confirming a card changes data, so it tells the rest of the app to reload
 *     (see notifyDataChanged in useApi.ts).
 *
 * The parent (AppShell) decides whether it's docked, expanded or minimized. When minimized
 * the panel is only HIDDEN, not removed, so the conversation is still there when it reopens.
 */
import { Bot, Maximize2, Minimize2, Minus, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { notifyDataChanged } from '../useApi';
import { JobDeleteCard, JobEditCard } from './ActionCards';
import { JobCard, type ActionCard, type DecisionResult } from './JobCard';
import { RichText } from './RichText';
import type { ChatMode } from './useChatPanel';
import './chat.css';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  card: ActionCard | null;
  /** Shown in red: something went wrong sending/answering (not saved on the server). */
  failed?: boolean;
}

interface ChatPanelProps {
  mode: ChatMode;
  onMinimize: () => void;
  onToggleExpanded: () => void;
  /** Called when the AI adds a message (so the bot button can show a red dot if minimized). */
  onAiMessage: () => void;
  /** What the recruiter is looking at, e.g. "Jobs". Shown under the title. */
  context: string;
  /** The job open on screen, if any: sent with each message so the AI knows. */
  jobId?: string;
}

type AiStatus = 'loading' | 'groq' | 'mock' | 'offline';

// Ideas shown above the input box, to help a first-time user get started.
const SUGGESTIONS = ['What can you do?', 'How are my jobs going?', 'Show the candidates for this job'];

export function ChatPanel({ mode, onMinimize, onToggleExpanded, onAiMessage, context, jobId }: ChatPanelProps) {
  const { user } = useAuth();
  const expanded = mode === 'expanded';
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<AiStatus>('loading');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Load the saved conversation (and the AI mode) once.
  useEffect(() => {
    const controller = new AbortController();
    api<{ messages: ChatMessage[]; ai: { mode: 'groq' | 'mock' } }>('/chat/messages', { signal: controller.signal })
      .then((data) => {
        setMessages(data.messages);
        setStatus(data.ai.mode);
      })
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setStatus('offline');
      });
    return () => controller.abort();
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, thinking]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setDraft('');

    // Show the recruiter's message immediately (temporary id until the server saves it).
    const tempId = `temp-${Date.now()}`;
    setMessages((current) => [...current, { id: tempId, role: 'user', text: trimmed, card: null }]);
    setThinking(true);
    try {
      const result = await api<{ messages: ChatMessage[] }>('/chat/messages', {
        method: 'POST',
        body: { text: trimmed, jobId },
      });
      // Replace the temporary bubble with the saved one, and add the AI's answer(s).
      setMessages((current) => [...current.filter((m) => m.id !== tempId), ...result.messages]);
      onAiMessage();
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : 'Could not reach the server.';
      setMessages((current) => [
        ...current,
        { id: `error-${Date.now()}`, role: 'assistant', text: reason, card: null, failed: true },
      ]);
    } finally {
      setThinking(false);
    }
  }

  /** A card was confirmed/cancelled: update it, add the server's note, refresh pages. */
  function handleDecided(result: DecisionResult) {
    setMessages((current) => [
      ...current.map((m) => (m.card?.id === result.card.id ? { ...m, card: result.card } : m)),
      result.message as ChatMessage,
    ]);
    if (result.card.status === 'confirmed') notifyDataChanged();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  // Enter sends; Shift+Enter makes a new line (like most chat apps).
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  }

  const pill = {
    loading: { cls: 'pill--muted', label: 'Connecting…' },
    groq: { cls: 'pill--ok', label: 'Online' },
    mock: { cls: 'pill--warn', label: 'Mock mode' },
    offline: { cls: 'pill--bad', label: 'Offline' },
  }[status];

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
            TalentPilot AI{' '}
            <span className={`pill ${pill.cls}`} title={status === 'mock' ? 'No AI key set: sample answers' : undefined}>
              {pill.label}
            </span>
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
        {/* A friendly start when there's no conversation yet (not saved). */}
        {messages.length === 0 && (
          <div className="message message--assistant">
            <div className="message__bubble">
              <RichText
                text={`Hi ${user?.name ?? 'there'}! I'm TalentPilot, your recruiting co-worker.\n\nPaste a job description and I'll turn it into a job for you to confirm. I never change anything without your OK.`}
              />
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`message message--${message.role}`}>
            <div className="message__content">
              {message.text && (
                <div className={`message__bubble ${message.failed ? 'message__bubble--failed' : ''}`}>
                  {message.role === 'assistant' ? <RichText text={message.text} /> : message.text}
                </div>
              )}
              {/* Cards: something to fill in / approve (different look from chat bubbles). */}
              {message.card?.type === 'create_job' && <JobCard card={message.card} onDecided={handleDecided} />}
              {message.card?.type === 'update_job' && <JobEditCard card={message.card} onDecided={handleDecided} />}
              {message.card?.type === 'delete_job' && <JobDeleteCard card={message.card} onDecided={handleDecided} />}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="message message--assistant" role="status">
            <div className="message__bubble message__typing" aria-label="TalentPilot is thinking">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      <div className="chat__composer">
        <div className="chat__suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" className="chip" onClick={() => void send(suggestion)} disabled={thinking}>
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
            placeholder="Ask TalentPilot, or paste a job description…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" className="chat__send" disabled={!draft.trim() || thinking} aria-label="Send message">
            <Send size={16} />
          </button>
        </form>
        <p className="chat__hint">TalentPilot asks before any action that changes data or sends email.</p>
      </div>
    </aside>
  );
}
