/**
 * The candidate's timeline, inside the candidate popup:
 *
 *   Sourced → Accepted → Contacted                 (the path so far; the last one is now)
 *
 *   ● Added from web search                        13 Nov, 14:02
 *   ● Sourced → Accepted · by Rina                 13 Nov, 15:10
 *   ● Emailed: step 1 (Day 0) · by the AI          13 Nov, 15:12
 *   ○ Upcoming: email step 2 (Day 3) scheduled     16 Nov, 15:12
 *
 * From GET /api/jobs/:id/candidates/:candidateId/timeline (built from the activity log, so
 * moves made in the chat and on the page both show up). Undone moves are crossed out.
 */
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { CandidateStatus } from '../types';

interface Timeline {
  current: CandidateStatus;
  path: { status: CandidateStatus; label: string }[];
  events: { id: string; kind: 'added' | 'status' | 'email' | 'other'; text: string; by: string | null; at: string; undone: boolean }[];
  upcoming: { id: string; text: string; at: string | null }[];
}

/** "13 Nov, 15:10" (adds the year only when it isn't this year). */
function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), hour: '2-digit', minute: '2-digit' });
}

export function CandidateTimeline({ jobId, candidateId }: { jobId: string; candidateId: string }) {
  const [data, setData] = useState<Timeline | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    api<Timeline>(`/jobs/${jobId}/candidates/${candidateId}/timeline`)
      .then((t) => !cancelled && setData(t))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [jobId, candidateId]);

  if (failed) return <p className="muted small">The timeline couldn't be loaded.</p>;
  if (!data) return <p className="muted small">Loading the timeline…</p>;

  return (
    <div className="timeline">
      <ol className="timeline__path" aria-label="Statuses so far">
        {data.path.map((p, i) => (
          <li key={`${p.status}-${i}`} className={i === data.path.length - 1 ? 'timeline__step timeline__step--now' : 'timeline__step'}>
            {i > 0 && <ArrowRight size={12} aria-hidden="true" className="timeline__arrow" />}
            <span>{p.label}</span>
          </li>
        ))}
      </ol>
      <ul className="timeline__events">
        {data.events.map((e) => (
          <li key={e.id} className={`timeline__event timeline__event--${e.kind}${e.undone ? ' timeline__event--undone' : ''}`}>
            <span className="timeline__dot" aria-hidden="true" />
            <span className="timeline__text">
              {e.text}
              {e.undone && <span className="muted"> (undone)</span>}
              {e.by && <span className="muted"> · by {e.by}</span>}
            </span>
            <time className="timeline__time muted small" dateTime={e.at}>
              {when(e.at)}
            </time>
          </li>
        ))}
        {data.upcoming.map((u) => (
          <li key={u.id} className="timeline__event timeline__event--upcoming">
            <span className="timeline__dot" aria-hidden="true" />
            <span className="timeline__text">Upcoming: {u.text}</span>
            <time className="timeline__time muted small" dateTime={u.at ?? undefined}>
              {when(u.at)}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}
