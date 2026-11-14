/**
 * Candidate statuses, in pipeline order, with the names shown on screen.
 * Mirrors the backend's src/pipeline/status.ts (the backend enforces the rules;
 * the frontend only needs the list and the labels).
 */
import type { CandidateStatus } from './types';

export const PIPELINE_STATUSES = [
  { id: 'sourced', label: 'Sourced' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'replied', label: 'Replied' },
  { id: 'interested', label: 'Interested' },
  { id: 'meeting_booked', label: 'Meeting booked' },
  { id: 'interviewed', label: 'Interviewed' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'hired', label: 'Hired' },
] as const satisfies readonly { id: CandidateStatus; label: string }[];

/** Side exits: shown separately because they're not steps forward.
 *  Not accepted = the review decision; Rejected = after the interview. */
export const EXIT_STATUSES = [
  { id: 'not_accepted', label: 'Not accepted' },
  { id: 'not_interested', label: 'Not interested' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'unsubscribed', label: 'Unsubscribed' },
] as const satisfies readonly { id: CandidateStatus; label: string }[];

export const STATUS_LABELS = Object.fromEntries(
  [...PIPELINE_STATUSES, ...EXIT_STATUSES].map((s) => [s.id, s.label]),
) as Record<CandidateStatus, string>;

/**
 * Where a candidate may go NEXT from each status: a copy of the backend's rulebook
 * (src/pipeline/status.ts), used to show only the buttons that make sense. The backend
 * still checks every move, so a stale copy can never let a wrong move through.
 */
export const ALLOWED_MOVES: Record<CandidateStatus, readonly CandidateStatus[]> = {
  sourced: ['accepted', 'not_accepted', 'rejected'],
  accepted: ['contacted', 'not_accepted', 'rejected'],
  not_accepted: ['accepted', 'rejected'],
  contacted: ['replied', 'unsubscribed', 'rejected'],
  replied: ['interested', 'not_interested', 'meeting_booked', 'unsubscribed', 'rejected'],
  interested: ['meeting_booked', 'not_interested', 'unsubscribed', 'rejected'],
  not_interested: ['interested', 'unsubscribed', 'rejected'],
  meeting_booked: ['interviewed', 'unsubscribed', 'rejected'],
  interviewed: ['shortlisted', 'unsubscribed', 'rejected'],
  shortlisted: ['hired', 'unsubscribed', 'rejected'],
  hired: [],
  // Rejected goes back only to the status before the rejection: Candidate.restoreTo.
  rejected: [],
  unsubscribed: ['rejected'],
};

/** All statuses in pipeline order (for "Move to" menus). */
export const ALL_STATUSES = [...PIPELINE_STATUSES, ...EXIT_STATUSES].map((s) => s.id) as CandidateStatus[];
