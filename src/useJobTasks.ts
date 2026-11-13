/**
 * Live background-task updates ("Scored 15 of 23…", "LinkedIn page 1 of 2…").
 *
 *   const { latest, tasks } = useJobTasks(jobId);
 *
 * ONE live connection for the whole app, shared by every progress bar and chat card:
 *   - the browser opens a single Server-Sent Events stream, GET /api/jobs/events, which
 *     carries the updates of ALL jobs; every component reads from the shared store below
 *   - a job's recent tasks are loaded ONCE with a normal request (GET /jobs/:id/tasks)
 *
 * Why it matters: browsers allow only about 6 open connections per website (HTTP/1.1),
 * counted over ALL tabs of the site together.
 * Before, every progress bar and every confirmed card in the chat history kept its own
 * live connection open; after a few searches/scorings they used all 6 and the whole page
 * froze (nothing loaded, not even a refresh). Now it's exactly one per tab, and a tab in
 * the background closes its stream (and catches up when you come back), so many open tabs
 * can't use up the connections either.
 *
 * When a task finishes (or makes progress), the rest of the page is told to reload
 * (notifyDataChanged), at most once a second, so new scores appear without a refresh.
 */
import { useEffect, useState } from 'react';
import { api, API_BASE } from './api';
import { notifyDataChanged } from './useApi';

export interface JobTask {
  id: string;
  jobId: string;
  type: 'score_candidates' | 'source_candidates' | 'draft_outreach' | 'send_outreach';
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: { total: number; done: number; found: number; duplicates: number; failed: number };
  message: string;
  error: string | null;
  createdAt: string | null;
  finishedAt: string | null;
}

// ---------- The shared store (one per browser tab) ----------

const tasks = new Map<string, JobTask>();
const listeners = new Set<() => void>();
/** Jobs whose recent tasks were already loaded (or are loading). */
const loadedJobs = new Set<string>();
let stream: EventSource | null = null;
let users = 0; // components using the store; the stream closes when nobody needs it
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

/** Tell the page to reload its data, but at most once a second (not once per update). */
function refreshSoon() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    notifyDataChanged();
  }, 1000);
}

/** A task update from the stream or a fetch. */
function upsert(task: JobTask, live: boolean) {
  const before = tasks.get(task.id);
  tasks.set(task.id, task);
  if (live && before) {
    const finished = before.status !== 'done' && task.status === 'done';
    const progressed = task.status === 'running' && task.progress.done > before.progress.done;
    if (finished || progressed) refreshSoon();
  }
  // A task we hadn't seen (e.g. scoring that a finished web search just started): reload too.
  if (live && !before) refreshSoon();
}

async function loadJob(jobId: string, force = false) {
  if (loadedJobs.has(jobId) && !force) return;
  loadedJobs.add(jobId);
  try {
    const data = await api<{ tasks: JobTask[] }>(`/jobs/${jobId}/tasks`);
    for (const task of data.tasks) upsert(task, false);
    emit();
  } catch {
    loadedJobs.delete(jobId); // try again next time someone asks
  }
}

function openStream() {
  if (stream || document.visibilityState === 'hidden') return;
  stream = new EventSource(`${API_BASE}/jobs/events`, { withCredentials: true });
  stream.addEventListener('task', (event) => {
    upsert(JSON.parse((event as MessageEvent<string>).data) as JobTask, true);
    emit();
  });
  // (Re)connected: something may have finished while we were offline, so reload the jobs
  // we show. (EventSource reconnects by itself after a dropped connection.)
  stream.addEventListener('open', () => {
    for (const jobId of loadedJobs) void loadJob(jobId, true);
  });
}

function startUsing() {
  users++;
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  openStream();
}

function stopUsing() {
  users--;
  // Close a moment later, so moving between pages doesn't reconnect every time.
  if (users <= 0 && !closeTimer) {
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (users <= 0 && stream) {
        stream.close();
        stream = null;
      }
    }, 5000);
  }
}

// A tab in the background lets go of its connection; back in front, it reconnects (the
// 'open' handler then reloads the jobs on screen, so nothing is missed).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stream?.close();
      stream = null;
    } else if (users > 0) {
      openStream();
    }
  });
}

// ---------- The hook ----------

export function useJobTasks(jobId: string | undefined) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    startUsing();
    return () => {
      listeners.delete(listener);
      stopUsing();
    };
  }, []);

  useEffect(() => {
    if (jobId) void loadJob(jobId);
  }, [jobId]);

  const list = jobId
    ? [...tasks.values()].filter((t) => t.jobId === jobId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    : [];
  return { latest: list[0] ?? null, tasks: list };
}
