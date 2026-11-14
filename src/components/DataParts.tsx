/**
 * Pieces that show real data, shared across pages:
 *   <LoadState>     spinner text / error message while data loads
 *   <ScoreBadge>    the 0–100 score in green / amber / red
 *   <StatusChip>    a candidate's status as a coloured label
 *   <ActorTag>      who did something: Recruiter / AI / System
 *   <ActivityList>  the history list (used on the dashboard and the job page)
 *   <Funnel>        bars showing how many candidates are at each status
 */
import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { percent, timeAgo } from '../format';
import { PIPELINE_STATUSES, STATUS_LABELS } from '../pipeline';
import type { ActivityItem, CandidateStatus, FunnelStage } from '../types';
import { EmptyState } from './PageParts';

export function LoadState({ loading, error }: { loading: boolean; error: string | null }) {
  if (error) {
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  }
  if (loading) {
    return (
      <p className="muted" role="status">
        Loading…
      </p>
    );
  }
  return null;
}

/** 80+ green, 60–79 amber, below 60 red. No score yet -> "–". */
export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="score score--none" title="Not scored yet">–</span>;
  const level = score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low';
  return (
    <span className={`score score--${level}`} title={`Score ${score} out of 100`}>
      {score}
    </span>
  );
}

export function StatusChip({ status }: { status: CandidateStatus }) {
  return <span className={`chip-status chip-status--${status}`}>{STATUS_LABELS[status]}</span>;
}

/**
 * Who did it, with their real name:
 *   recruiter -> "Rina"        (green)
 *   ai        -> "AI for Rina" (purple)
 *   system    -> "System"      (grey; background work nobody clicked)
 */
export function ActorTag({ actor, name }: { actor: ActivityItem['actor']; name?: string | null }) {
  const label =
    actor === 'recruiter' ? (name ?? 'A recruiter') : actor === 'ai' ? (name ? `AI for ${name}` : 'AI') : 'System';
  return <span className={`actor actor--${actor}`}>{label}</span>;
}

export function ActivityList({ items, showJob = false }: { items: ActivityItem[]; showJob?: boolean }) {
  if (items.length === 0) {
    return (
      <EmptyState icon={Activity} title="Nothing yet">
        Every change (by you, the AI or the system) will be listed here.
      </EmptyState>
    );
  }
  return (
    <ul className="activity">
      {items.map((item) => (
        <li key={item.id} className="activity__item">
          <span className={item.undone ? 'activity__message activity__message--undone' : 'activity__message'}>
            {item.message}
          </span>
          <span className="activity__meta">
            <ActorTag actor={item.actor} name={item.userName} /> · {timeAgo(item.createdAt)}
            {showJob && (
              <>
                {' · '}
                <Link to={`/jobs/${item.jobId}`}>{item.jobTitle}</Link>
              </>
            )}
            {item.undone && ' · undone'}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One bar per pipeline stage; bar length is relative to the biggest count.
 *
 * Works for both kinds of numbers:
 *   - today's statuses (StatusCounts), or
 *   - the cumulative funnel from the dashboard (FunnelCounts: who ever reached each stage).
 * With `showConversion`, each row also says what share of the stage above got this far
 * (e.g. Replied "50%" = half of the contacted people replied).
 */
export function Funnel({ counts, showConversion = false }: { counts: Record<FunnelStage, number>; showConversion?: boolean }) {
  const largest = Math.max(1, ...PIPELINE_STATUSES.map((s) => counts[s.id]));
  return (
    <div className={showConversion ? 'funnel funnel--conversion' : 'funnel'}>
      {PIPELINE_STATUSES.map((status, index) => {
        const previous = index > 0 ? counts[PIPELINE_STATUSES[index - 1]!.id] : null;
        // Share of the stage above that made it here ("–" when the stage above is empty).
        const conversion = previous === null ? null : previous > 0 ? counts[status.id] / previous : null;
        return (
          <div key={status.id} className="funnel__row">
            <span>{status.label}</span>
            <span className="funnel__track">
              <span className="funnel__bar" style={{ width: `${(counts[status.id] / largest) * 100}%` }} />
            </span>
            <span className="funnel__count">{counts[status.id]}</span>
            {showConversion && (
              <span
                className="funnel__conversion"
                title={previous === null ? 'Everyone starts here' : `Share of the ${PIPELINE_STATUSES[index - 1]!.label} stage that got this far`}
              >
                {previous === null ? '' : percent(conversion)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
