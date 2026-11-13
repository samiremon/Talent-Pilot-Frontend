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
 * 📎 Attach: pick a CSV of candidates. On a job's page it's for that job; elsewhere a small
 * "Which job?" picker appears first. The AI answers with an "Import CSV" card to confirm
 * (nothing is imported before that).
 *
 * The parent (AppShell) decides whether it's docked, expanded or minimized. When minimized
 * the panel is only HIDDEN, not removed, so the conversation is still there when it reopens.
 */
import { Bot, Maximize2, Minimize2, Minus, Paperclip, Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { api, API_BASE, ApiError } from '../api';
import type { Job } from '../types';
import { useAuth } from '../auth/AuthContext';
import { notifyDataChanged } from '../useApi';
import { AddCandidateCard, DeleteCandidateCard, FindCandidatesCard, ScoreAgainCard, JobDeleteCard, JobEditCard } from './ActionCards';
import { ImportCsvCard } from './ImportCsvCard';
import { JobCard, type ActionCard, type DecisionResult } from './JobCard';
import { RichText } from './RichText';
import type { ChatMode } from './useChatPanel';
import './chat.css';

/** Longest message the AI accepts (the backend checks the same number). */
const MAX_MESSAGE_CHARS = 12_000;

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

  // ---------- 📎 Attach a CSV ----------
  const fileRef = useRef<HTMLInputElement>(null);
  // Chosen file waiting for "which job?" (only when no job page is open).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [pickedJob, setPickedJob] = useState('');

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // so the same file can be picked again later
    if (!file) return;
    if (jobId) {
      void attach(file, jobId);
      return;
    }
    // Not on a job page: ask which job it's for.
    setPendingFile(file);
    api<{ jobs: Job[] }>('/jobs')
      .then((res) => {
        setJobs(res.jobs);
        setPickedJob(res.jobs[0]?.id ?? '');
      })
      .catch(() => setJobs([]));
  }

  async function attach(file: File, forJob: string) {
    setPendingFile(null);
    setThinking(true);
    try {
      // A file upload: multipart form data, so fetch directly (api() sends JSON).
      const form = new FormData();
      form.append('jobId', forJob);
      form.append('file', file);
      const res = await fetch(`${API_BASE}/chat/attachments/csv`, { method: 'POST', body: form, credentials: 'same-origin' });
      const data = (await res.json().catch(() => ({}))) as { messages?: ChatMessage[]; error?: { message?: string } };
      if (!res.ok || !data.messages) throw new ApiError(res.status, 'UPLOAD', data.error?.message ?? 'Could not read the file.');
      setMessages((current) => [...current, ...data.messages!]);
      onAiMessage();
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : 'Could not reach the server.';
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', text: reason, card: null, failed: true }]);
    } finally {
      setThinking(false);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking || trimmed.length > MAX_MESSAGE_CHARS) return;
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

  /** A message posted later by a card (e.g. "scored 72/100, rank #5"). Shown once. */
  const handleCardMessage = useCallback((message: ChatMessage) => {
    setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
    notifyDataChanged();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  // Enter sends; Shift+Enter makes a new line (like most chat apps).
  // Same limit as the server (about 4 pages): keeps each AI call inside Groq's per-minute budget.
  const tooLong = draft.trim().length > MAX_MESSAGE_CHARS;

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
              {message.card?.type === 'import_csv' && <ImportCsvCard card={message.card} onDecided={handleDecided} onMessage={handleCardMessage} />}
              {message.card?.type === 'score_candidates' && <ScoreAgainCard card={message.card} onDecided={handleDecided} onMessage={handleCardMessage} />}
              {message.card?.type === 'find_candidates' && <FindCandidatesCard card={message.card} onDecided={handleDecided} onMessage={handleCardMessage} />}
              {message.card?.type === 'delete_candidate' && <DeleteCandidateCard card={message.card} onDecided={handleDecided} />}
              {message.card?.type === 'add_candidate' && <AddCandidateCard card={message.card} onDecided={handleDecided} onMessage={handleCardMessage} />}
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
        {/* "Which job is this CSV for?" (only when the file was chosen outside a job page). */}
        {pendingFile && (
          <div className="attach-picker" role="group" aria-label="Choose the job for this CSV">
            <span className="attach-picker__file">📎 {pendingFile.name}</span>
            {jobs === null ? (
              <span className="muted small">Loading jobs…</span>
            ) : jobs.length === 0 ? (
              <span className="muted small">Create a job first, then attach the CSV.</span>
            ) : (
              <>
                <label className="sr-only" htmlFor="attach-job">
                  Job
                </label>
                <select id="attach-job" value={pickedJob} onChange={(e) => setPickedJob(e.target.value)}>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.jobCode} · {j.title}
                    </option>
                  ))}
                </select>
                <button type="button" className="button button--small" onClick={() => void attach(pendingFile, pickedJob)} disabled={!pickedJob}>
                  Attach
                </button>
              </>
            )}
            <button type="button" className="icon-button" onClick={() => setPendingFile(null)} aria-label="Remove attachment">
              <X size={16} />
            </button>
          </div>
        )}

        <form className="chat__form" onSubmit={handleSubmit}>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={chooseFile} />
          <button
            type="button"
            className="chat__attach"
            onClick={() => fileRef.current?.click()}
            disabled={thinking}
            aria-label="Attach a CSV of candidates"
            title="Attach a CSV of candidates"
          >
            <Paperclip size={18} />
          </button>
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
          <button type="submit" className="chat__send" disabled={!draft.trim() || thinking || tooLong} aria-label="Send message">
            <Send size={16} />
          </button>
        </form>
        {tooLong ? (
          <p className="chat__hint chat__hint--error" role="alert">
            Too long for the AI: {draft.trim().length.toLocaleString()} / {MAX_MESSAGE_CHARS.toLocaleString()} characters. Please
            shorten it (e.g. paste only the job description).
          </p>
        ) : (
          <p className="chat__hint">TalentPilot asks before any action that changes data or sends email.</p>
        )}
      </div>
    </aside>
  );
}
