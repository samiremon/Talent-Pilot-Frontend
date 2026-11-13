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

/** Side exits: shown separately because they're not steps forward. */
export const EXIT_STATUSES = [
  { id: 'not_interested', label: 'Not interested' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'unsubscribed', label: 'Unsubscribed' },
] as const satisfies readonly { id: CandidateStatus; label: string }[];

export const STATUS_LABELS = Object.fromEntries(
  [...PIPELINE_STATUSES, ...EXIT_STATUSES].map((s) => [s.id, s.label]),
) as Record<CandidateStatus, string>;
