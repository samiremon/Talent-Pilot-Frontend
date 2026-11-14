/**
 * The shapes of the data the backend sends us. Matching the backend's jobs/service.ts.
 * `null` always means "unknown": we show that as "Unknown", never a made-up value.
 */

export type CandidateStatus =
  | 'sourced'
  | 'accepted'
  | 'not_accepted'
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
  /** The profile tried to give the AI instructions (ignored). Shown in red. */
  flagged?: boolean;
  /** Rejected people: the status "Restore" takes them back to. */
  restoreTo?: CandidateStatus | null;
  /** They unsubscribed: never email them. */
  doNotEmail?: boolean;
  /** Their seniority as the AI read it from their text (null = not scored yet). */
  level?: 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'unknown' | null;
  status: CandidateStatus;
  /** Everything we know about them as text: from the CSV ("summary: ...", "skills: ...") or a search snippet. */
  profileText: string | null;
  createdAt: string;
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

/** The funnel stages (the main path, no side exits), as the backend counts them. */
export type FunnelStage =
  | 'sourced'
  | 'accepted'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'meeting_booked'
  | 'interviewed'
  | 'shortlisted'
  | 'hired';

/** How many candidates EVER reached each stage (a later rejection doesn't remove them). */
export type FunnelCounts = Record<FunnelStage, number>;

/** One job's dashboard numbers (a row of the per-job table). */
export interface JobStatsRow {
  id: string;
  jobCode: string | null;
  title: string;
  status: string;
  createdAt: string;
  funnel: FunnelCounts;
  current: StatusCounts;
  totalCandidates: number;
  /** replied ÷ contacted (null = nobody contacted yet) */
  replyRate: number | null;
  /** interested ÷ replied (null = nobody replied yet) */
  interestedRate: number | null;
  meetings: number;
  hires: number;
}

export interface Overview {
  activeJobs: number;
  totalCandidates: number;
  hires: number;
  meetings: number;
  replyRate: number | null;
  interestedRate: number | null;
  aiTokens: { inputTokens: number; outputTokens: number };
  /** Where candidates are right now. */
  counts: StatusCounts;
  /** Cumulative funnel across all jobs. */
  funnel: FunnelCounts;
  recentActivity: ActivityItem[];
  /** Every job with its own funnel and rates, newest first. */
  perJob: JobStatsRow[];
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
