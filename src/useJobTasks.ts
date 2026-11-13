/**
 * Live background-task updates for one job (Server-Sent Events).
 *
 *   const { latest } = useJobTasks(jobId);
 *   latest?.message  -> "Scored 15 of 23…"
 *
 * The browser keeps one connection open to GET /api/jobs/:id/events; the server pushes each
 * change as it happens (and the current state first). EventSource reconnects by itself if
 * the connection drops. When a task finishes, the rest of the page is told to reload
 * (notifyDataChanged), so new scores appear without a refresh.
 */
import { useEffect, useState } from 'react';
import { API_BASE } from './api';
import { notifyDataChanged } from './useApi';

export interface JobTask {
  id: string;
  jobId: string;
  type: 'score_candidates' | 'source_candidates';
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: { total: number; done: number; found: number; duplicates: number; failed: number };
  message: string;
  error: string | null;
  createdAt: string | null;
  finishedAt: string | null;
}

export function useJobTasks(jobId: string | undefined) {
  // Newest task per id (a map, so updates replace the old copy).
  const [tasks, setTasks] = useState<Record<string, JobTask>>({});

  useEffect(() => {
    if (!jobId) return;
    setTasks({});
    const source = new EventSource(`${API_BASE}/jobs/${jobId}/events`, { withCredentials: true });
    source.addEventListener('task', (event) => {
      const task = JSON.parse((event as MessageEvent<string>).data) as JobTask;
      setTasks((current) => {
        const before = current[task.id];
        // Just finished (and we saw it running): refresh the candidates and numbers.
        if (before && before.status !== 'done' && task.status === 'done') notifyDataChanged();
        // Progress while running: refresh now and then so scores appear as they arrive.
        if (before && task.status === 'running' && task.progress.done > before.progress.done) notifyDataChanged();
        return { ...current, [task.id]: task };
      });
    });
    return () => source.close();
  }, [jobId]);

  const list = Object.values(tasks).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { latest: list[0] ?? null, tasks: list };
}
