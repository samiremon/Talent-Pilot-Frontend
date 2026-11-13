/**
 * One job's page, with tabs. Each tab has its own address so a refresh (or a shared link)
 * opens the same tab:
 *
 *   /jobs/:jobId              Candidates  (table: score, reason, evidence, status)
 *   /jobs/:jobId/pipeline     Pipeline    (kanban board, one column per status: from idea 4)
 *   /jobs/:jobId/replies      Replies     (inbox: reply list + AI draft answer: from idea 6)
 *   /jobs/:jobId/emails       Emails      (the outreach sequence)
 *   /jobs/:jobId/activity     Activity    (every change)
 *
 * This component loads the job and its candidates ONCE and hands them to whichever tab
 * is open (through react-router's "outlet context"), so switching tabs is instant.
 */
import { Check, ExternalLink, History, Inbox, Info, Mail, Pencil, Search, Trash2, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ActivityList, LoadState, ScoreBadge, StatusChip } from '../components/DataParts';
import { JobDetailsDialog } from '../components/JobDetailsDialog';
import { CandidateDetailsDialog } from '../components/CandidateDetailsDialog';
import { SourcingBar } from '../components/SourcingBar';
import { useDeleteJob } from '../components/useDeleteJob';
import { useDeleteCandidate } from '../components/useDeleteCandidate';
import { useStatusChange } from '../components/useStatusChange';
import { EmailsTab } from './EmailsTab';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Segmented, TopPicker } from '../components/Segmented';
import { EditContactDialog } from '../components/EditContactDialog';
import { api, ApiError } from '../api';
import { useJobTasks, type JobTask } from '../useJobTasks';
import { EmptyState, PageHeader } from '../components/PageParts';
import { orUnknown, profileSite } from '../format';
import { ALL_STATUSES, EXIT_STATUSES, PIPELINE_STATUSES, STATUS_LABELS } from '../pipeline';
import { rankCandidates } from '../ranking';
import type { ActivityItem, Candidate, CandidateStatus, Job } from '../types';
import { notifyDataChanged, useApi } from '../useApi';

const TABS = [
  { to: '', label: 'Candidates' },
  { to: 'pipeline', label: 'Pipeline' },
  { to: 'replies', label: 'Replies' },
  { to: 'emails', label: 'Emails' },
  { to: 'activity', label: 'Activity' },
];

/** What every tab receives from the job page. */
interface JobContext {
  job: Job;
  candidates: Candidate[];
  /** The newest background task (e.g. scoring), updated live. */
  latestTask: JobTask | null;
}

export function JobPage() {
  const { jobId = '' } = useParams();
  const jobRequest = useApi<{ job: Job }>(`/jobs/${jobId}`);
  // "Job details" panel open? (Declared before the early return below: React's rule that
  // hooks always run in the same order.)
  const [showDetails, setShowDetails] = useState(false);
  const navigate = useNavigate();
  // Live background-task progress for this job (Server-Sent Events).
  const { latest: latestTask } = useJobTasks(jobRequest.data?.job.id);
  // After deleting, this page has nothing to show: go back to the list.
  const deleteJob = useDeleteJob({ onDeleted: () => navigate('/jobs') });
  const candidatesRequest = useApi<{ candidates: Candidate[] }>(`/jobs/${jobId}/candidates`);

  const job = jobRequest.data?.job;
  const candidates = candidatesRequest.data?.candidates ?? [];

  if (!job) {
    return <LoadState loading={jobRequest.loading} error={jobRequest.error} />;
  }

  return (
    <>
      {/* Kept short on purpose: all the job's fields are one click away in "Job details". */}
      <PageHeader
        title={job.title}
        subtitle={[job.jobCode, job.company].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <button type="button" className="button button--ghost" onClick={() => setShowDetails(true)}>
              <Info size={16} aria-hidden="true" /> Job details
            </button>
            <Link to={`/jobs/${job.id}/edit`} className="button button--ghost">
              <Pencil size={16} aria-hidden="true" /> Edit
            </Link>
            <button type="button" className="button button--ghost button--ghost-danger" onClick={() => deleteJob.ask(job)}>
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          </>
        }
      />
      <JobDetailsDialog job={job} open={showDetails} onClose={() => setShowDetails(false)} />
      {deleteJob.dialog}

      <nav className="tabs" aria-label="Job sections">
        {TABS.map((tab) => (
          // `end` on the first tab: otherwise "Candidates" would stay active on every tab.
          <NavLink key={tab.label} to={tab.to} end={tab.to === ''} className="tab">
            {tab.label}
            {tab.to === '' && <span className="tab__count">{job.totalCandidates}</span>}
          </NavLink>
        ))}
      </nav>

      <LoadState loading={candidatesRequest.loading && !candidatesRequest.data} error={candidatesRequest.error} />
      {/* The selected tab's component is shown here, with the job + candidates handed down. */}
      <Outlet context={{ job, candidates, latestTask } satisfies JobContext} />
    </>
  );
}

function useJob(): JobContext {
  return useOutletContext<JobContext>();
}

export function JobCandidatesTab() {
  const { job, candidates, latestTask } = useJob();
  // The candidate whose details popup is open (null = closed).
  const [selected, setSelected] = useState<Candidate | null>(null);
  // Filters: search by name, and "show only the top N by score" (0 = everyone).
  const [search, setSearch] = useState('');
  const [top, setTop] = useState(0);
  // Email filter: everyone, only people whose email we have, or only those without one
  // (web search results never include an email).
  const [emailFilter, setEmailFilter] = useState<'all' | 'found' | 'missing'>('all');
  // Rank by score (#1 = best). Computed on ALL candidates, so filtering never changes ranks.
  const ranks = useMemo(() => rankCandidates(candidates), [candidates]);
  const scoredCount = ranks.size;

  // The list arrives best score first (unscored last). Top N = exactly ranks 1..N (ranks are
  // never shared), then the email filter and the name search narrow it further.
  const query = search.trim().toLowerCase();
  const shown = candidates.filter((c) => {
    if (top > 0) {
      const rank = ranks.get(c.id);
      if (rank === undefined || rank > top) return false;
    }
    if (emailFilter === 'found' && !c.email) return false;
    if (emailFilter === 'missing' && c.email) return false;
    return !query || c.name.toLowerCase().includes(query);
  });
  const withEmail = candidates.filter((c) => c.email).length;

  // Remove a candidate (trash button / popup), with a confirmation popup first.
  const deleteCandidate = useDeleteCandidate(job.id, { onDeleted: () => setSelected(null) });
  // "Delete all": removes every candidate of this job (asks first; the job stays).
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  // Review & status changes: ticked rows, and the Accept / Reject / Move to actions.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const status = useStatusChange(job.id);
  const togglePick = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // "Email them": a campaign for the ticked people (only Accepted ones with an email are
  // added; the server checks), then over to the Emails tab to review the drafts.
  const navigate = useNavigate();
  const [emailError, setEmailError] = useState<string | null>(null);
  async function emailSelected(sequence: 'single' | 'sequence') {
    setEmailError(null);
    try {
      await api(`/jobs/${job.id}/campaigns`, { method: 'POST', body: { sequence, candidateIds: [...picked] } });
      setPicked(new Set());
      notifyDataChanged();
      navigate(`/jobs/${job.id}/emails`);
    } catch (err) {
      setEmailError(err instanceof ApiError ? err.message : 'Could not create the campaign.');
    }
  }
  async function moveSelected(to: CandidateStatus) {
    await status.move([...picked], to);
    setPicked(new Set());
  }
  // The candidate whose email / profile link is being edited (null = closed).
  const [editing, setEditing] = useState<Candidate | null>(null);

  // No score AND no reason = the AI hasn't scored them yet (e.g. a run hit a problem).
  const unscored = candidates.filter((c) => c.score === null && !c.scoreReason).length;
  const bar = <SourcingBar jobId={job.id} latest={latestTask} unscored={unscored} />;
  if (candidates.length === 0) {
    return (
      <>
        {bar}
        <div className="card">
          <EmptyState icon={Users} title="No candidates for this job yet">
            Upload a CSV, or attach one in the chat with 📎. Each candidate gets a 0–100 score with the reason and the
            evidence behind it.
          </EmptyState>
        </div>
      </>
    );
  }
  return (
    <>
    {bar}
    <div className="table-filters" role="search">
      <label className="table-filters__search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          aria-label="Search candidates by name"
        />
      </label>
      <TopPicker value={top} onChange={setTop} />
      <Segmented
        label="Email"
        value={emailFilter}
        onChange={setEmailFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'found', label: 'Found', count: withEmail },
          { value: 'missing', label: 'Missing', count: candidates.length - withEmail },
        ]}
      />
      <span className="muted small table-filters__count">
        Showing {shown.length} of {candidates.length} · {scoredCount} scored
      </span>
      <button type="button" className="button button--danger-ghost button--small" onClick={() => setConfirmDeleteAll(true)}>
        <Trash2 size={14} aria-hidden="true" /> Delete all
      </button>
    </div>
    <ConfirmDialog
      open={confirmDeleteAll}
      danger
      title={`Delete all ${candidates.length} candidate${candidates.length === 1 ? '' : 's'} of ${job.jobCode ?? 'this job'}?`}
      confirmLabel="Delete all candidates"
      onCancel={() => setConfirmDeleteAll(false)}
      onConfirm={async () => {
        await api(`/jobs/${job.id}/candidates`, { method: 'DELETE' });
        setConfirmDeleteAll(false);
        notifyDataChanged();
      }}
    >
      <p>
        Every candidate of <strong>{job.title}</strong> will be removed: <strong>{candidates.length}</strong> people, with their
        scores. The job itself stays.
      </p>
      <p className="muted">This can't be undone. The activity log keeps a note of it.</p>
    </ConfirmDialog>
    {picked.size > 0 && (
      <div className="bulk-bar" role="region" aria-label="Actions for the selected candidates">
        <strong>{picked.size} selected</strong>
        <button type="button" className="button button--small" onClick={() => moveSelected('accepted')} disabled={status.busy}>
          <Check size={14} aria-hidden="true" /> Accept
        </button>
        <button type="button" className="button button--small button--danger-ghost" onClick={() => moveSelected('not_accepted')} disabled={status.busy}>
          <X size={14} aria-hidden="true" /> Not accepted
        </button>
        <label className="bulk-bar__move">
          Move to
          <select
            value=""
            onChange={(e) => e.target.value && moveSelected(e.target.value as CandidateStatus)}
            disabled={status.busy}
            aria-label="Move the selected candidates to"
          >
            <option value="">Choose…</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="bulk-bar__move">
          Email them
          <select
            value=""
            onChange={(e) => e.target.value && emailSelected(e.target.value as 'single' | 'sequence')}
            aria-label="Create an email campaign for the selected candidates"
          >
            <option value="">Choose…</option>
            <option value="single">Single email</option>
            <option value="sequence">Day 0 / 3 / 7 sequence</option>
          </select>
        </label>
        <button type="button" className="link-button" onClick={() => setPicked(new Set())}>
          Clear
        </button>
      </div>
    )}
    {emailError && (
      <p className="form-error" role="alert">
        {emailError}
      </p>
    )}
    {status.notice}
    <div className="card table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col" className="pick-cell">
              <input
                type="checkbox"
                aria-label="Select all shown candidates"
                checked={shown.length > 0 && shown.every((c) => picked.has(c.id))}
                onChange={(e) => setPicked(e.target.checked ? new Set(shown.map((c) => c.id)) : new Set())}
              />
            </th>
            <th scope="col" title="Rank by AI score: #1 = best match">
              Rank
            </th>
            <th scope="col">Score</th>
            <th scope="col" className="candidate-col">Candidate</th>
            <th scope="col">Why</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && (
            <tr>
              <td colSpan={6} className="muted table__empty">
                {query
                  ? `No candidate named "${search.trim()}"${top ? ` in the top ${top}` : ''}${emailFilter !== 'all' ? ` with the email filter on` : ''}.`
                  : emailFilter === 'found'
                    ? 'No candidates with an email found.'
                    : emailFilter === 'missing'
                      ? 'Every candidate has an email.'
                      : 'No scored candidates yet.'}
              </td>
            </tr>
          )}
          {shown.map((c) => (
            <tr
              key={c.id}
              // Red row = their profile tried to instruct the AI (it was ignored, but look twice).
              className={`row-link${c.flagged ? ' row--flagged' : ''}`}
              // The whole row opens the details popup (click, or Tab + Enter).
              tabIndex={0}
              aria-label={`Show details for ${c.name}${c.flagged ? ' (flagged: profile contains instructions aimed at the AI)' : ''}`}
              onClick={() => setSelected(c)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setSelected(c);
              }}
            >
              <td className="pick-cell" onClick={(event) => event.stopPropagation()}>
                <input type="checkbox" checked={picked.has(c.id)} onChange={() => togglePick(c.id)} aria-label={`Select ${c.name}`} />
              </td>
              <td className="rank-cell">
                {ranks.has(c.id) ? `#${ranks.get(c.id)}` : <span className="muted" title="Not scored yet, so no rank">–</span>}
              </td>
              <td>
                <ScoreBadge score={c.score} />
              </td>
              <td>
                <div className="table__title">{c.name}</div>
                <div className="muted small">{orUnknown(c.headline)}</div>
                {/* Contact: their profile (LinkedIn, GitHub, ...) in a new tab, and their email. */}
                <div className="small candidate-contact">
                  {c.profileUrl ? (
                    <a
                      href={c.profileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      title={c.profileUrl}
                    >
                      {profileSite(c.profileUrl)} <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="muted">No profile link</span>
                  )}
                </div>
                <div className="small muted candidate-email">{c.email ?? 'Email unknown'}</div>
              </td>
              <td>
                <div>{c.scoreReason ?? <span className="muted">Not scored yet</span>}</div>
                {/* The exact words from their profile that back up the score. */}
                {c.evidence.map((quote) => (
                  <q key={quote} className="evidence">
                    {quote}
                  </q>
                ))}
              </td>
              <td>
                <StatusChip status={c.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <CandidateDetailsDialog
      candidate={selected}
      rank={selected ? ranks.get(selected.id) : undefined}
      rankedCount={scoredCount}
      onClose={() => setSelected(null)}
      onRemove={deleteCandidate.ask}
      onMove={(c, to) => {
        setSelected(null);
        void status.move([c.id], to);
      }}
      onEdit={(c) => {
        setSelected(null);
        setEditing(c);
      }}
    />
    <EditContactDialog jobId={job.id} candidate={editing} onClose={() => setEditing(null)} />
    {deleteCandidate.dialog}
    </>
  );
}

/** Kanban board: one column per status, a card for each candidate in it. */
export function JobPipelineTab() {
  const { candidates } = useJob();
  const [selected, setSelected] = useState<Candidate | null>(null);
  const columns = [...PIPELINE_STATUSES, ...EXIT_STATUSES];
  return (
    <div className="board" role="list" aria-label="Pipeline board">
      {columns.map((status) => {
        const inColumn = candidates.filter((c) => c.status === status.id);
        return (
          <section key={status.id} className="board__column" role="listitem" aria-label={status.label}>
            <div className="board__heading">
              <span>{status.label}</span>
              <span className="board__count">{inColumn.length}</span>
            </div>
            {inColumn.length === 0 ? (
              <div className="board__empty">No candidates</div>
            ) : (
              inColumn.map((c) => (
                <article
                  key={c.id}
                  className={`board__card board__card--link${c.flagged ? ' board__card--flagged' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Show details for ${c.name}`}
                  onClick={() => setSelected(c)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelected(c);
                  }}
                >
                  <div className="board__card-top">
                    <span className="board__name">{c.name}</span>
                    <ScoreBadge score={c.score} />
                  </div>
                  <div className="muted small">{orUnknown(c.headline)}</div>
                </article>
              ))
            )}
          </section>
        );
      })}
      <CandidateDetailsDialog candidate={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/** Inbox: replies list on the left, the selected conversation + AI draft on the right. */
export function JobRepliesTab() {
  return (
    <div className="card inbox">
      <div className="inbox__list">
        <div className="inbox__list-header">Replies</div>
        <EmptyState icon={Inbox} title="No replies yet">
          Candidate replies will be listed here, labelled by the AI.
        </EmptyState>
      </div>
      <EmptyState icon={Mail} title="Select a reply">
        You'll see the conversation and the AI's drafted answer, ready to approve, edit or discard.
      </EmptyState>
    </div>
  );
}

export function JobEmailsTab() {
  const { job } = useJob();
  return <EmailsTab jobId={job.id} />;
}

export function JobActivityTab() {
  const { job } = useJob();
  const { data, error, loading } = useApi<{ activity: ActivityItem[] }>(`/jobs/${job.id}/activity`);
  if (!data) return <LoadState loading={loading} error={error} />;
  if (data.activity.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={History} title="No activity yet">
          Every change to this job is recorded here: who did it (you, the AI or the system) and when.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="card panel">
      <ActivityList items={data.activity} />
    </div>
  );
}
