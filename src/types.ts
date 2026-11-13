/**
 * The shapes of the data the backend sends us. Matching the backend's jobs/service.ts.
 * `null` always means "unknown": we show that as "Unknown", never a made-up value.
 */

export type CandidateStatus =
  | 'sourced'
  | 'accepted'
  | 'rejected'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'not_interested'
  | 'meeting_booked'
  | 'interviewed'
  | 'shortlisted'
  | 'hired'
  | 'unsubscribed';

/** How many candidates are at each status. */
export type StatusCounts = Record<CandidateStatus, number>;

export interface Job {
  id: string;
  /** Short readable id, e.g. "JOB-0007" (used by people and the AI). */
  jobCode: string | null;
  jobNumber: number | null;
  title: string;
  company: string | null;
  description?: string; // only on the single-job endpoint
  descriptionPreview: string;
  sourceUrl: string | null;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  seniority: string | null;
  location: string | null;
  salary: string | null;
  remotePolicy: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  status: 'active' | 'paused' | 'closed';
  /** Token meter: AI tokens used for this job (input = sent to the AI, output = written by it). */
  aiUsage: { inputTokens: number; outputTokens: number; calls: number };
  counts: StatusCounts;
  totalCandidates: number;
  createdAt: string;
}

export interface Candidate {
  id: string;
  jobId: string;
  name: string;
  email: string | null;
  profileUrl: string | null;
  headline: string | null;
  location: string | null;
  source: 'web' | 'csv' | 'manual';
  score: number | null;
  scoreReason: string | null;
  evidence: string[];
  status: CandidateStatus;
}

export interface ActivityItem {
  id: string;
  jobId: string;
  jobTitle: string;
  candidateId: string | null;
  /** The person behind it: the recruiter, or the recruiter whose AI did it. Null = system. */
  userId: string | null;
  userName: string | null;
  type: string;
  actor: 'recruiter' | 'ai' | 'system';
  message: string;
  fromStatus: CandidateStatus | null;
  toStatus: CandidateStatus | null;
  undone: boolean;
  createdAt: string;
}

export interface Overview {
  activeJobs: number;
  totalCandidates: number;
  hires: number;
  replyRate: number | null;
  aiTokens: { inputTokens: number; outputTokens: number };
  counts: StatusCounts;
  recentActivity: ActivityItem[];
  jobs: { id: string; title: string; status: string; totalCandidates: number; hired: number }[];
}

/** One AI call in the token log (Activity → Token usage). */
export interface TokenUsageItem {
  id: string;
  createdAt: string;
  userId: string | null;
  userName: string;
  task: string;
  taskLabel: string;
  model: string;
  role: 'agent' | 'bulk' | 'safety';
  jobId: string | null;
  jobTitle: string | null;
  inputTokens: number;
  outputTokens: number;
}

export interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

/** Activity → Token dashboard. */
export interface TokenDashboard {
  days: number;
  since: string;
  totals: { allTime: TokenTotals; lastDays: TokenTotals };
  users: { userId: string; name: string; email: string | null; allTime: TokenTotals; lastDays: TokenTotals }[];
}

/** A page of a long list; ask for the next page with ?before=nextBefore. */
export interface Page<T> {
  items: T[];
  nextBefore: string | null;
}
